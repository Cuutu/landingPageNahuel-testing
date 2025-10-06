import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    await dbConnect();

    const { symbol, newPrice } = req.body;

    if (!symbol || !newPrice) {
      return res.status(400).json({ error: 'Símbolo y precio son requeridos' });
    }

    // Buscar alertas activas para este símbolo
    const activeAlerts = await Alert.find({
      symbol: symbol.toUpperCase(),
      status: 'ACTIVE'
    });

    console.log(`🔍 Actualizando precio de ${symbol} a ${newPrice} para ${activeAlerts.length} alertas activas`);

    const results = {
      updated: 0,
      rangeBroken: 0,
      closed: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const alert of activeAlerts) {
      try {
        // Actualizar el precio actual
        const oldPrice = alert.currentPrice;
        alert.currentPrice = newPrice;
        alert.calculateProfit();
        
        // Verificar si es una alerta de rango y si rompe el rango
        if (alert.tipoAlerta === 'rango') {
          const rangeCheck = alert.checkRangeBreak(newPrice);
          
          if (rangeCheck.isBroken) {
            console.log(`⚠️ Alerta ${alert._id} (${alert.symbol}) rompió rango: ${rangeCheck.reason}`);
            
            // Cerrar la alerta como desestimada
            alert.status = 'DESESTIMADA';
            alert.exitPrice = newPrice;
            alert.exitDate = new Date();
            alert.exitReason = 'RANGE_BREAK';
            alert.desestimacionMotivo = rangeCheck.reason;
            
            results.rangeBroken++;
            results.closed++;
            
            results.details.push({
              alertId: alert._id,
              symbol: alert.symbol,
              oldPrice,
              newPrice,
              range: alert.entryPriceRange,
              reason: rangeCheck.reason,
              action: 'CLOSED_DESESTIMADA',
              closedAt: new Date()
            });
          } else {
            results.details.push({
              alertId: alert._id,
              symbol: alert.symbol,
              oldPrice,
              newPrice,
              range: alert.entryPriceRange,
              action: 'UPDATED',
              profit: alert.profit
            });
          }
        } else {
          // Alerta normal, solo actualizar precio
          results.details.push({
            alertId: alert._id,
            symbol: alert.symbol,
            oldPrice,
            newPrice,
            action: 'UPDATED',
            profit: alert.profit
          });
        }
        
        await alert.save();
        results.updated++;
        
      } catch (error) {
        console.error(`❌ Error procesando alerta ${alert._id}:`, error);
        results.errors++;
        results.details.push({
          alertId: alert._id,
          symbol: alert.symbol,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    console.log(`📊 Actualización completada: ${results.updated} actualizadas, ${results.rangeBroken} rangos rotos, ${results.closed} cerradas, ${results.errors} errores`);

    return res.status(200).json({
      success: true,
      message: 'Precios actualizados y rangos verificados',
      results
    });

  } catch (error) {
    console.error('❌ Error en actualización de precios:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
