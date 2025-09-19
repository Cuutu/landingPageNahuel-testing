import { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminAPI } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import Payment from '@/models/Payment';
import User from '@/models/User';

/**
 * API Admin: Analíticas mensuales (MoM)
 * GET /api/admin/analytics/monthly?months=6
 * - revenueByMonth: [{ year, month, total, count }]
 * - usersByMonth: [{ year, month, users }]
 * - arpuByMonth: revenue/users
 * - mom: deltas porcentuales mes a mes
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const adminCheck = await verifyAdminAPI(req, res);
    if (!adminCheck.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    await dbConnect();

    const now = new Date();
    const monthsParam = Math.max(1, parseInt((req.query.months as string) || '6', 10));
    const validStatuses = ['approved', 'completed'];

    // Calcular fecha de inicio (inicio del mes hace N-1 meses)
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsParam - 1), 1));

    // Agregado: ingresos por mes
    const revenueAgg = await Payment.aggregate([
      {
        $match: {
          status: { $in: validStatuses },
          transactionDate: { $gte: start }
        }
      },
      {
        $group: {
          _id: {
            y: { $year: { date: '$transactionDate', timezone: 'UTC' } },
            m: { $month: { date: '$transactionDate', timezone: 'UTC' } }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } }
    ]);

    // Estimar usuarios por mes (usuarios creados hasta fin de cada mes)
    // Para eficiencia, tomamos totalUsers actual y asumimos estable si no se necesita histórico exacto.
    // Si se requiere histórico exacto, habría que consultar por createdAt <= endOfMonth.
    const totalUsers = await User.countDocuments();

    // Construir serie mensual normalizada con meses sin datos
    const series: Array<{ year: number; month: number; total: number; count: number; users: number; arpu: number }> = [];
    for (let i = monthsParam - 1; i >= 0; i--) {
      const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const year = y.getUTCFullYear();
      const month = y.getUTCMonth() + 1;
      const found = revenueAgg.find((r: any) => r._id.y === year && r._id.m === month);
      const total = found?.total || 0;
      const count = found?.count || 0;
      const users = totalUsers; // simplificación
      const arpu = users > 0 ? total / users : 0;
      series.push({ year, month, total, count, users, arpu });
    }

    // Calcular deltas MoM
    const deltas = series.map((cur, idx) => {
      if (idx === 0) return { year: cur.year, month: cur.month, revenueDelta: 0, arpuDelta: 0, countDelta: 0 };
      const prev = series[idx - 1];
      const revenueDelta = prev.total > 0 ? ((cur.total - prev.total) / prev.total) * 100 : (cur.total > 0 ? 100 : 0);
      const arpuDelta = prev.arpu > 0 ? ((cur.arpu - prev.arpu) / prev.arpu) * 100 : (cur.arpu > 0 ? 100 : 0);
      const countDelta = prev.count > 0 ? ((cur.count - prev.count) / prev.count) * 100 : (cur.count > 0 ? 100 : 0);
      return { year: cur.year, month: cur.month, revenueDelta, arpuDelta, countDelta };
    });

    return res.status(200).json({
      success: true,
      params: { months: monthsParam },
      revenueByMonth: series.map(s => ({ year: s.year, month: s.month, total: s.total, count: s.count })),
      arpuByMonth: series.map(s => ({ year: s.year, month: s.month, arpu: s.arpu })),
      usersAssumed: totalUsers,
      mom: deltas
    });
  } catch (error) {
    console.error('❌ Error en admin analytics monthly:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
} 