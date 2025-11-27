import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
import { calculateCurrentPortfolioValue } from '@/lib/portfolioCalculator';

/**
 * API para guardar el valor de la cartera diariamente a las 16:30
 * Este endpoint se ejecuta automáticamente mediante cron job externo (cron-job.org)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Permitir GET para cronjobs externos (cron-job.org) y POST para otros usos
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Método no permitido. Use GET o POST.' 
    });
  }

  try {
    // ✅ NUEVO: Detectar cron jobs externos por User-Agent
    const authHeader = req.headers.authorization;
    const userAgent = req.headers['user-agent'] || '';
    const isCronJobOrg = userAgent.includes('cron-job.org') || userAgent.includes('curl') || userAgent.includes('wget');
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_TOKEN;
    
    // Permitir acceso manual para testing (solo en desarrollo)
    const isManualTest = req.query.test === 'true' && process.env.NODE_ENV === 'development';
    
    // Permitir cron jobs externos sin token, o con token correcto
    if (!isManualTest && cronSecret && authHeader !== `Bearer ${cronSecret}` && !isCronJobOrg) {
      console.error('❌ Acceso no autorizado a cron job de snapshot de cartera');
      return res.status(401).json({ 
        success: false,
        error: 'No autorizado',
        message: 'Este endpoint requiere autenticación o debe ser ejecutado desde cron-job.org'
      });
    }
    
    if (isCronJobOrg) {
      console.log('🌐 CRON PÚBLICO DETECTADO (save-portfolio-snapshot):', {
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        method: req.method,
        url: req.url
      });
    }

    console.log('✅ Cron job autorizado - Iniciando guardado de snapshot de cartera...');
    
    const startTime = Date.now();
    await dbConnect();

    // Crear fecha normalizada a las 16:30 de hoy
    // El cron se ejecuta a las 16:30, así que guardamos con la fecha de hoy
    const now = new Date();
    const snapshotDate = new Date(now);
    snapshotDate.setHours(16, 30, 0, 0); // 16:30:00

    const pools: ('TraderCall' | 'SmartMoney')[] = ['TraderCall', 'SmartMoney'];
    const results = [];

    for (const pool of pools) {
      try {
        console.log(`📊 Calculando valor de cartera para ${pool}...`);
        
        // Calcular valor actual de la cartera
        const portfolioValue = await calculateCurrentPortfolioValue(pool);
        
        // Log detallado del cálculo
        console.log(`📊 [${pool}] Valores calculados:`, {
          valorTotalCartera: portfolioValue.valorTotalCartera,
          liquidezInicial: portfolioValue.liquidezInicial,
          liquidezTotal: portfolioValue.liquidezTotal,
          liquidezDistribuida: portfolioValue.liquidezDistribuida,
          totalProfitLoss: portfolioValue.totalProfitLoss
        });

        // Verificar si ya existe un snapshot para esta fecha y pool
        // Buscar en un rango del mismo día
        const startOfDay = new Date(snapshotDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(snapshotDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const existingSnapshot = await PortfolioSnapshot.findOne({
          pool,
          snapshotDate: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        });

        if (existingSnapshot) {
          // Actualizar snapshot existente
          existingSnapshot.valorTotalCartera = portfolioValue.valorTotalCartera;
          existingSnapshot.liquidezInicial = portfolioValue.liquidezInicial;
          existingSnapshot.liquidezTotal = portfolioValue.liquidezTotal;
          existingSnapshot.liquidezDisponible = portfolioValue.liquidezDisponible;
          existingSnapshot.liquidezDistribuida = portfolioValue.liquidezDistribuida;
          existingSnapshot.totalProfitLoss = portfolioValue.totalProfitLoss;
          existingSnapshot.totalProfitLossPercentage = portfolioValue.totalProfitLossPercentage;
          await existingSnapshot.save();
          
          console.log(`✅ Snapshot actualizado para ${pool}: $${portfolioValue.valorTotalCartera.toFixed(2)}`);
          results.push({
            pool,
            action: 'updated',
            valorTotalCartera: portfolioValue.valorTotalCartera
          });
        } else {
          // Crear nuevo snapshot
          const snapshot = new PortfolioSnapshot({
            pool,
            valorTotalCartera: portfolioValue.valorTotalCartera,
            liquidezInicial: portfolioValue.liquidezInicial,
            liquidezTotal: portfolioValue.liquidezTotal,
            liquidezDisponible: portfolioValue.liquidezDisponible,
            liquidezDistribuida: portfolioValue.liquidezDistribuida,
            totalProfitLoss: portfolioValue.totalProfitLoss,
            totalProfitLossPercentage: portfolioValue.totalProfitLossPercentage,
            snapshotDate
          });
          
          await snapshot.save();
          
          console.log(`✅ Snapshot creado para ${pool}: $${portfolioValue.valorTotalCartera.toFixed(2)}`);
          results.push({
            pool,
            action: 'created',
            valorTotalCartera: portfolioValue.valorTotalCartera
          });
        }
      } catch (error) {
        console.error(`❌ Error procesando ${pool}:`, error);
        results.push({
          pool,
          action: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    const executionTime = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: 'Snapshots de cartera guardados correctamente',
      results,
      executionTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en cron job de snapshot de cartera:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

