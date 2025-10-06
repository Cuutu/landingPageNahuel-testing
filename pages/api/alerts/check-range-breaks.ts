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

    // Buscar todas las alertas activas de tipo rango
    const activeRangeAlerts = await Alert.find({
      status: 'ACTIVE',
      tipoAlerta: 'rango',
      entryPriceRange: { $exists: true, $ne: null }
    }).populate('createdBy', 'email name');

    console.log(`🔍 Verificando ${activeRangeAlerts.length} alertas de rango activas`);

    const results = {
      checked: 0,
      broken: 0,
      closed: 0,
      errors: 0,
      details: [] as any[]
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
          
          results.details.push({
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
        results.details.push({
          alertId: alert._id,
          symbol: alert.symbol,
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    console.log(`📊 Verificación completada: ${results.checked} verificadas, ${results.broken} rotas, ${results.closed} cerradas, ${results.errors} errores`);

    return res.status(200).json({
      success: true,
      message: 'Verificación de rangos completada',
      results
    });

  } catch (error) {
    console.error('❌ Error en verificación de rangos:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
