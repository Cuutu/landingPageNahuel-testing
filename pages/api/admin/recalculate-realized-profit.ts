import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import Alert from '@/models/Alert';
import User from '@/models/User';

/**
 * Endpoint para recalcular ganancias realizadas de todas las alertas
 * Útil después de corregir el método calculateTotalProfit
 * POST /api/admin/recalculate-realized-profit
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: `Método ${req.method} no permitido. Use POST.` 
    });
  }

  try {
    await dbConnect();

    // Verificar autenticación
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ 
        success: false, 
        message: 'Debes estar autenticado' 
      });
    }

    // Verificar que sea admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado. Solo administradores pueden ejecutar esta acción.' 
      });
    }

    console.log('🔄 [RECALCULATE] Iniciando recálculo de ganancias realizadas...');

    // Buscar todas las alertas con ventas parciales ejecutadas
    const alerts = await Alert.find({
      'liquidityData.partialSales': {
        $exists: true,
        $ne: null,
        $not: { $size: 0 }
      }
    });

    console.log(`📊 [RECALCULATE] Encontradas ${alerts.length} alertas con ventas parciales`);

    let updated = 0;
    let errors = 0;
    const results: Array<{ symbol: string; alertId: string; oldValue: number; newValue: number }> = [];

    for (const alert of alerts) {
      try {
        // Verificar que tenga ventas ejecutadas
        const executedSales = alert.liquidityData?.partialSales?.filter(
          (sale: any) => sale.executed === true && !sale.discarded
        ) || [];

        if (executedSales.length === 0) {
          continue; // Saltar si no hay ventas ejecutadas
        }

        const oldValue = alert.gananciaRealizada || 0;

        // Recalcular ganancia realizada con el nuevo método corregido
        alert.calculateTotalProfit();

        const newValue = alert.gananciaRealizada || 0;

        // Guardar siempre para asegurar que se actualice
        await alert.save();

        updated++;
        results.push({
          symbol: alert.symbol,
          alertId: alert._id.toString(),
          oldValue,
          newValue
        });

        console.log(`✅ [RECALCULATE] ${alert.symbol}: ${oldValue.toFixed(2)}% → ${newValue.toFixed(2)}%`);

      } catch (error: any) {
        errors++;
        console.error(`❌ [RECALCULATE] Error procesando ${alert.symbol}:`, error.message);
      }
    }

    console.log(`🎉 [RECALCULATE] Completado: ${updated} alertas actualizadas, ${errors} errores`);

    return res.status(200).json({
      success: true,
      message: `Recálculo completado: ${updated} alertas actualizadas`,
      updated,
      errors,
      total: alerts.length,
      results: results.slice(0, 20) // Mostrar solo las primeras 20 para no saturar la respuesta
    });

  } catch (error: any) {
    console.error('❌ [RECALCULATE] Error general:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al recalcular ganancias realizadas',
      error: error.message
    });
  }
}

