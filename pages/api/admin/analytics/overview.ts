import { NextApiRequest, NextApiResponse } from 'next'
import { verifyAdminAPI } from '@/lib/adminAuth'
import connectDB from '@/lib/mongodb'
import Payment from '@/models/Payment'
import User from '@/models/User'
import UserSubscription from '@/models/UserSubscription'

/**
 * API Admin: Analíticas generales
 * Método: GET
 * Parámetros query opcionales:
 *  - rangeDays: número de días hacia atrás para series temporales (por defecto 30)
 * Respuesta:
 *  - kpis: métricas clave (ingresos, usuarios, suscripciones)
 *  - revenueByService: ingresos por servicio
 *  - revenueByCategory: ingresos agrupados por categoría (Alertas/Entrenamientos/Asesorías)
 *  - revenueTimeseries: ingresos diarios últimos N días
 *  - subscriptionsByAlert: cantidad de usuarios suscritos por tipo de alerta (toggles)
 *  - activeSubscriptionsByService: usuarios únicos con suscripción activa por servicio
 *  - latestPayments: últimos pagos aprobados
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Método no permitido' })
	}

	try {
		const adminCheck = await verifyAdminAPI(req, res)
		if (!adminCheck.isAdmin) {
			return res.status(403).json({ error: 'Acceso denegado' })
		}

		await connectDB()

		const now = new Date()
		const rangeDays = Math.max(1, parseInt((req.query.rangeDays as string) || '30', 10))
		const since = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000)

		// Definir categorías por servicio
		const alertServices = ['TraderCall', 'SmartMoney', 'CashFlow'] as const
		const trainingServices = ['SwingTrading', 'DowJones'] as const
		const advisoryServices = ['ConsultorioFinanciero'] as const

		// Ingresos totales y del mes actual
		const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

		const [totalRevenueAgg, monthlyRevenueAgg] = await Promise.all([
			Payment.aggregate([
				{ $match: { status: 'approved' } },
				{ $group: { _id: null, total: { $sum: '$amount' } } }
			]),
			Payment.aggregate([
				{ $match: { status: 'approved', transactionDate: { $gte: startOfMonth } } },
				{ $group: { _id: null, total: { $sum: '$amount' } } }
			])
		])

		const totalRevenue = totalRevenueAgg[0]?.total || 0
		const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0

		// Usuarios
		const [totalUsers, adminUsers, suscriptorUsers, normalUsers] = await Promise.all([
			User.countDocuments({}),
			User.countDocuments({ role: 'admin' }),
			User.countDocuments({ role: 'suscriptor' }),
			User.countDocuments({ role: 'normal' })
		])

		// Ingresos por servicio
		const revenueByService = await Payment.aggregate([
			{ $match: { status: 'approved' } },
			{ $group: { _id: '$service', total: { $sum: '$amount' }, count: { $sum: 1 } } },
			{ $project: { _id: 0, service: '$_id', total: 1, count: 1 } },
			{ $sort: { total: -1 } }
		])

		// Ingresos por categoría usando $switch
		const revenueByCategory = await Payment.aggregate([
			{ $match: { status: 'approved' } },
			{
				$addFields: {
					category: {
						$switch: {
							branches: [
								{ case: { $in: ['$service', alertServices] }, then: 'Alertas' },
								{ case: { $in: ['$service', trainingServices] }, then: 'Entrenamientos' },
								{ case: { $in: ['$service', advisoryServices] }, then: 'Asesorías' }
							],
							default: 'Otros'
						}
					}
				}
			},
			{ $group: { _id: '$category', total: { $sum: '$amount' } } },
			{ $project: { _id: 0, category: '$_id', total: 1 } },
			{ $sort: { total: -1 } }
		])

		// Serie temporal de ingresos últimos N días
		const revenueTimeseries = await Payment.aggregate([
			{ $match: { status: 'approved', transactionDate: { $gte: since } } },
			{ $group: { _id: { y: { $year: '$transactionDate' }, m: { $month: '$transactionDate' }, d: { $dayOfMonth: '$transactionDate' } }, total: { $sum: '$amount' } } },
			{ $project: { _id: 0, date: { $dateFromParts: { year: '$_id.y', month: '$_id.m', day: '$_id.d' } }, total: 1 } },
			{ $sort: { date: 1 } }
		])

		// Suscripciones por tipo de alerta (toggles)
		const [subsTrader, subsSmart, subsCashflow] = await Promise.all([
			UserSubscription.countDocuments({ 'subscriptions.alertas_trader': true }),
			UserSubscription.countDocuments({ 'subscriptions.alertas_smart': true }),
			UserSubscription.countDocuments({ 'subscriptions.alertas_cashflow': true })
		])

		// Usuarios únicos con suscripción activa por servicio (pagos no expirados)
		const activeSubscriptionsByService = await Payment.aggregate([
			{ $match: { status: 'approved', expiryDate: { $gt: now } } },
			{ $group: { _id: { service: '$service', userEmail: '$userEmail' } } },
			{ $group: { _id: '$_id.service', users: { $sum: 1 } } },
			{ $project: { _id: 0, service: '$_id', users: 1 } },
			{ $sort: { users: -1 } }
		])

		const activeSubscriptionsTotal = activeSubscriptionsByService.reduce((acc, it) => acc + (it.users || 0), 0)
		const arpu = totalUsers > 0 ? totalRevenue / totalUsers : 0

		// Últimos pagos aprobados
		const latestPayments = await Payment.find({ status: 'approved' })
			.select('userEmail service amount currency status transactionDate expiryDate')
			.sort({ transactionDate: -1 })
			.limit(10)
			.lean()

		return res.status(200).json({
			success: true,
			timestamp: now.toISOString(),
			params: { rangeDays },
			kpis: {
				totalRevenue,
				monthlyRevenue,
				activeSubscriptionsTotal,
				arpu,
				totalUsers,
				adminUsers,
				suscriptorUsers,
				normalUsers
			},
			revenueByService,
			revenueByCategory,
			revenueTimeseries,
			subscriptionsByAlert: {
				alertas_trader: subsTrader,
				alertas_smart: subsSmart,
				alertas_cashflow: subsCashflow
			},
			activeSubscriptionsByService,
			latestPayments
		})
	} catch (error) {
		console.error('❌ Error en admin analytics overview:', error)
		return res.status(500).json({ error: 'Error interno del servidor' })
	}
} 