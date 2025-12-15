import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Operation from '@/models/Operation';
import Alert from '@/models/Alert';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';

/**
 * Endpoint para debug: Obtener operaciones pendientes con priceRange
 * Útil para verificar si hay operaciones que no se están confirmando
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación y rol admin
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Verificar que sea admin
    const User = (await import('@/models/User')).default;
    await dbConnect();
    const user = await User.findOne({ email: session.user.email });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado - Se requiere rol admin' });
    }

    await dbConnect();

    // ✅ CONSULTA 1: Operaciones con priceRange que NO están confirmadas
    const pendingOperations = await Operation.find({
      priceRange: { $exists: true, $ne: null },
      isPriceConfirmed: { $ne: true },
      operationType: 'COMPRA'
    })
      .populate('alertId', 'symbol status currentPrice finalPrice entryPriceRange tipo')
      .select('ticker operationType price priceRange isPriceConfirmed alertId date createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    // ✅ CONSULTA 2: Operaciones con priceRange (todas, incluyendo confirmadas)
    const allOperationsWithRange = await Operation.find({
      priceRange: { $exists: true, $ne: null },
      operationType: 'COMPRA'
    })
      .select('ticker priceRange isPriceConfirmed alertId createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // ✅ CONSULTA 3: Operaciones sin confirmar (sin importar si tienen priceRange)
    const allUnconfirmedOperations = await Operation.find({
      isPriceConfirmed: { $ne: true },
      operationType: 'COMPRA'
    })
      .populate('alertId', 'symbol status currentPrice finalPrice')
      .select('ticker price priceRange isPriceConfirmed alertId date createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // ✅ CONSULTA 4: Alertas activas con rangos que deberían tener operaciones pendientes
    const alertsWithRange = await Alert.find({
      status: 'ACTIVE',
      $or: [
        { entryPriceRange: { $exists: true, $ne: null } },
        { precioMinimo: { $exists: true, $ne: null }, precioMaximo: { $exists: true, $ne: null } }
      ]
    })
      .select('symbol status entryPriceRange precioMinimo precioMaximo currentPrice finalPrice tipo')
      .lean();

    // ✅ CONSULTA 5: Verificar si las alertas con rangos tienen operaciones asociadas
    const alertsWithOperations = await Promise.all(
      alertsWithRange.map(async (alert) => {
        const operations = await Operation.find({
          alertId: alert._id,
          operationType: 'COMPRA'
        })
          .select('ticker priceRange isPriceConfirmed price createdAt')
          .lean();

        return {
          alert: {
            _id: alert._id,
            symbol: alert.symbol,
            status: alert.status,
            entryPriceRange: alert.entryPriceRange,
            precioMinimo: alert.precioMinimo,
            precioMaximo: alert.precioMaximo,
            currentPrice: alert.currentPrice,
            finalPrice: alert.finalPrice
          },
          operations: operations.map(op => ({
            ticker: op.ticker,
            hasPriceRange: !!op.priceRange,
            priceRange: op.priceRange,
            isPriceConfirmed: op.isPriceConfirmed,
            price: op.price,
            createdAt: op.createdAt
          }))
        };
      })
    );

    // ✅ RESUMEN ESTADÍSTICO
    const stats = {
      totalPendingWithRange: pendingOperations.length,
      totalWithRange: allOperationsWithRange.length,
      totalUnconfirmed: allUnconfirmedOperations.length,
      totalAlertsWithRange: alertsWithRange.length,
      pendingByStatus: {
        withRange: pendingOperations.length,
        withoutRange: allUnconfirmedOperations.filter(op => !op.priceRange).length
      },
      confirmedVsPending: {
        confirmed: allOperationsWithRange.filter(op => op.isPriceConfirmed === true).length,
        pending: allOperationsWithRange.filter(op => op.isPriceConfirmed !== true).length
      }
    };

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      data: {
        // Operaciones pendientes con priceRange (las que deberían confirmarse)
        pendingOperations: pendingOperations.map(op => ({
          _id: op._id,
          ticker: op.ticker,
          priceRange: op.priceRange,
          isPriceConfirmed: op.isPriceConfirmed,
          currentPrice: op.price,
          alert: op.alertId ? {
            _id: (op.alertId as any)._id,
            symbol: (op.alertId as any).symbol,
            status: (op.alertId as any).status,
            currentPrice: (op.alertId as any).currentPrice,
            finalPrice: (op.alertId as any).finalPrice,
            entryPriceRange: (op.alertId as any).entryPriceRange
          } : null,
          date: op.date,
          createdAt: op.createdAt,
          updatedAt: op.updatedAt,
          // ✅ Verificación: ¿El precio actual está dentro del rango?
          priceInRange: op.alertId && op.priceRange ? (() => {
            const alert = op.alertId as any;
            const price = alert.finalPrice || alert.currentPrice;
            const range = op.priceRange;
            return price && range ? (price >= range.min && price <= range.max) : null;
          })() : null
        })),
        
        // Todas las operaciones con priceRange (para comparación)
        allOperationsWithRange: allOperationsWithRange.map(op => ({
          ticker: op.ticker,
          priceRange: op.priceRange,
          isPriceConfirmed: op.isPriceConfirmed,
          createdAt: op.createdAt
        })),
        
        // Alertas con rangos y sus operaciones asociadas
        alertsWithOperations,
        
        // Muestra de operaciones sin confirmar (para debugging)
        sampleUnconfirmed: allUnconfirmedOperations.map(op => ({
          ticker: op.ticker,
          hasPriceRange: !!op.priceRange,
          priceRange: op.priceRange,
          isPriceConfirmed: op.isPriceConfirmed,
          alert: op.alertId ? {
            symbol: (op.alertId as any).symbol,
            status: (op.alertId as any).status,
            currentPrice: (op.alertId as any).currentPrice,
            finalPrice: (op.alertId as any).finalPrice
          } : null
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error en debug-pending-operations:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
  }
}

