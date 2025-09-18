import { NextApiRequest, NextApiResponse } from 'next'
import { verifyAdminAPI } from '@/lib/adminAuth'
import connectDB from '@/lib/mongodb'
import Payment from '@/models/Payment'
import User from '@/models/User'
import UserSubscription from '@/models/UserSubscription'

/**
 * API Admin: Analíticas generales
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

		const alertServices = ['TraderCall', 'SmartMoney', 'CashFlow'] as const
		const trainingServices = ['SwingTrading', 'DowJones'] as const
		const advisoryServices = ['ConsultorioFinanciero'] as const
		const validStatuses = ['approved', 'completed']

		const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

		const [totalRevenueAgg, monthlyRevenueAgg] = await Promise.all([
			Payment.aggregate([
				{ $match: { status: { $in: validStatuses } } },
				{ $group: { _id: null, total: { $sum: '$amount' } } }
			]),
			Payment.aggregate([
				{ $match: { status: { $in: validStatuses }, transactionDate: { $gte: startOfMonth } } },
				{ $group: { _id: null, total: { $sum: '$amount' } } }
			])
		])

		const totalRevenue = totalRevenueAgg[0]?.total || 0
		const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0

		const [totalUsers, adminUsers, suscriptorUsers, normalUsers] = await Promise.all([
			User.countDocuments({}),
			User.countDocuments({ role: 'admin' }),
			User.countDocuments({ role: 'suscriptor' }),
			User.countDocuments({ role: 'normal' })
		])

		const addCanonicalServiceStage = {
			$addFields: {
				canonicalService: {
					$switch: {
						branches: [
							{ case: { $regexMatch: { input: { $toLower: '$service' }, regex: /trader|tradercall|trader-call/ } }, then: 'TraderCall' },
							{ case: { $regexMatch: { input: { $toLower: '$service' }, regex: /smart|smartmoney|smart-money/ } }, then: 'SmartMoney' },
							{ case: { $regexMatch: { input: { $toLower: '$service' }, regex: /cash\s?flow|cash-flow/ } }, then: 'CashFlow' },
							{ case: { $regexMatch: { input: { $toLower: '$service' }, regex: /swing|swingtrading|swing-trading/ } }, then: 'SwingTrading' },
							{ case: { $regexMatch: { input: { $toLower: '$service' }, regex: /dow|dowjones|dow-jones/ } }, then: 'DowJones' },
							{ case: { $regexMatch: { input: { $toLower: '$service' }, regex: /consultorio/ } }, then: 'ConsultorioFinanciero' }
						],
						default: '$service'
					}
				}
			}
		}

		const revenueByService = await Payment.aggregate([
			{ $match: { status: { $in: validStatuses } } },
			addCanonicalServiceStage as any,
			{ $group: { _id: '$canonicalService', total: { $sum: '$amount' }, count: { $sum: 1 } } },
			{ $project: { _id: 0, service: '$_id', total: 1, count: 1 } },
			{ $sort: { total: -1 } }
		])

		const revenueByCategory = await Payment.aggregate([
			{ $match: { status: { $in: validStatuses } } },
			addCanonicalServiceStage as any,
			{
				$addFields: {
					category: {
						$switch: {
							branches: [
								{ case: { $in: ['$canonicalService', [...alertServices]] }, then: 'Alertas' },
								{ case: { $in: ['$canonicalService', [...trainingServices]] }, then: 'Entrenamientos' },
								{ case: { $in: ['$canonicalService', [...advisoryServices]] }, then: 'Asesorías' }
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

		const revenueTimeseries = await Payment.aggregate([
			{ $match: { status: { $in: validStatuses }, transactionDate: { $gte: since } } },
			{ $group: { _id: { y: { $year: '$transactionDate' }, m: { $month: '$transactionDate' }, d: { $dayOfMonth: '$transactionDate' } }, total: { $sum: '$amount' } } },
			{ $project: { _id: 0, date: { $dateFromParts: { year: '$_id.y', month: '$_id.m', day: '$_id.d' } }, total: 1 } },
			{ $sort: { date: 1 } }
		])

		// 1) Set de emails activos por servicio desde Payments
		const paymentsActiveByService = await Payment.aggregate([
			{ $match: { status: { $in: validStatuses }, expiryDate: { $gt: now } } },
			addCanonicalServiceStage as any,
			{ $group: { _id: { service: '$canonicalService', email: '$userEmail' } } },
			{ $group: { _id: '$_id.service', users: { $addToSet: '$_id.email' } } },
			{ $project: { _id: 0, service: '$_id', users: 1 } }
		])
		const paymentsSetMap = new Map<string, Set<string>>()
		paymentsActiveByService.forEach((r: any) => paymentsSetMap.set(r.service, new Set(r.users)))

		// 2) Set de emails activos por alerta desde suscripciones manuales del admin (User.subscriptions)
		const manualSubsAgg = await User.aggregate([
			{ $match: { 'subscriptions.0': { $exists: true } } },
			{ $unwind: '$subscriptions' },
			{ $match: { 'subscriptions.activa': true, $or: [ { 'subscriptions.fechaFin': { $exists: false } }, { 'subscriptions.fechaFin': null }, { 'subscriptions.fechaFin': { $gt: now } } ] } },
			{ $project: { email: '$email', tipo: '$subscriptions.tipo', precio: '$subscriptions.precio' } },
			{ $group: { _id: '$tipo', users: { $addToSet: '$email' }, totalManualRevenue: { $sum: { $ifNull: ['$precio', 0] } } } },
			{ $project: { _id: 0, service: '$_id', users: 1, totalManualRevenue: 1 } }
		])
		const manualSetMap = new Map<string, Set<string>>()
		const manualRevenueMap = new Map<string, number>()
		manualSubsAgg.forEach((r: any) => {
			manualSetMap.set(r.service, new Set(r.users))
			manualRevenueMap.set(r.service, r.totalManualRevenue || 0)
		})

		// 3) Unificar sets por servicio (Payments ⊔ Manual)
		const unionServices = new Set<string>([...alertServices, ...trainingServices, ...advisoryServices])
		const activeByServiceUnion: Array<{ service: string; users: number }> = []
		unionServices.forEach(service => {
			const p = paymentsSetMap.get(service) || new Set<string>()
			const m = manualSetMap.get(service) || new Set<string>()
			const union = new Set<string>()
			p.forEach((email) => union.add(email))
			m.forEach((email) => union.add(email))
			activeByServiceUnion.push({ service, users: union.size })
		})

		// 4) Suscripciones por alerta (solo TraderCall/SmartMoney/CashFlow) usando la unión
		const subscribersByAlert = {
			alertas_trader: activeByServiceUnion.find(s => s.service === 'TraderCall')?.users || 0,
			alertas_smart: activeByServiceUnion.find(s => s.service === 'SmartMoney')?.users || 0,
			alertas_cashflow: activeByServiceUnion.find(s => s.service === 'CashFlow')?.users || 0
		}

		const activeSubscriptionsByService = activeByServiceUnion
		const activeSubscriptionsTotal = activeSubscriptionsByService.reduce((acc, it) => acc + (it.users || 0), 0)
		const arpu = totalUsers > 0 ? totalRevenue / totalUsers : 0

		// 5) Ingresos manuales (se reportan aparte para no duplicar pagos)
		const manualRevenueByService = Array.from(manualRevenueMap.entries()).map(([service, total]) => ({ service, total }))

		const latestPayments = await Payment.find({ status: { $in: validStatuses } })
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
			subscriptionsByAlert: subscribersByAlert,
			activeSubscriptionsByService,
			manualRevenueByService,
			latestPayments
		})
	} catch (error) {
		console.error('❌ Error en admin analytics overview:', error)
		return res.status(500).json({ error: 'Error interno del servidor' })
	}
} 