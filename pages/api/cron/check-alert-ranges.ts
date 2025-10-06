import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar que sea una llamada CRON de Vercel
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    await dbConnect();

    console.log('🔄 Iniciando verificación automática de rangos de alertas...');

    // Buscar todas las alertas activas de tipo rango
    const activeRangeAlerts = await Alert.find({
      status: 'ACTIVE',
      tipoAlerta: 'rango',
      entryPriceRange: { $exists: true, $ne: null }
    });

    console.log(`🔍 Encontradas ${activeRangeAlerts.length} alertas de rango activas`);

    const results = {
      checked: 0,
      broken: 0,
      closed: 0,
      errors: 0,
      alerts: [] as any[]
    };

    for (const alert of activeRangeAlerts) {
      try {
        results.checked++;
        
        // Verificar si el precio actual rompe el rango
        const rangeCheck = alert.checkRangeBreak(alert.currentPrice);
        
        if (rangeCheck.isBroken) {
          console.log(`⚠️ Alerta ${alert._id} (${alert.symbol}) rompió rango: ${rangeCheck.reason}`);
          
          // Cerrar la alerta como desestimada
          alert.status = 'DESESTIMADA';
          alert.exitPrice = alert.currentPrice;
          alert.exitDate = new Date();
          alert.exitReason = 'RANGE_BREAK';
          alert.desestimacionMotivo = rangeCheck.reason;
          
          await alert.save();
          
          results.broken++;
          results.closed++;
          
          results.alerts.push({
            alertId: alert._id,
            symbol: alert.symbol,
            currentPrice: alert.currentPrice,
            range: alert.entryPriceRange,
            reason: rangeCheck.reason,
            closedAt: new Date()
          });
          
          console.log(`✅ Alerta ${alert._id} cerrada como DESESTIMADA`);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando alerta ${alert._id}:`, error);
        results.errors++;
      }
    }

    console.log(`📊 Verificación CRON completada: ${results.checked} verificadas, ${results.broken} rotas, ${results.closed} cerradas, ${results.errors} errores`);

    return res.status(200).json({
      success: true,
      message: 'Verificación automática de rangos completada',
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('❌ Error en verificación CRON de rangos:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
