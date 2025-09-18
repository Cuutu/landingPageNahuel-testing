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
 *  - subscriptionsByAlert: cantidad de usuarios suscritos por tipo de alerta (activos por pagos vigentes)
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

		// Definir categorías por servicio (canónicos)
		const alertServices = ['TraderCall', 'SmartMoney', 'CashFlow'] as const
		const trainingServices = ['SwingTrading', 'DowJones'] as const
		const advisoryServices = ['ConsultorioFinanciero'] as const

		// Filtro de estados válidos (compatibilidad con datos históricos)
		const validStatuses = ['approved', 'completed']

		// Ingresos totales y del mes actual
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

		// Usuarios
		const [totalUsers, adminUsers, suscriptorUsers, normalUsers] = await Promise.all([
			User.countDocuments({}),
			User.countDocuments({ role: 'admin' }),
			User.countDocuments({ role: 'suscriptor' }),
			User.countDocuments({ role: 'normal' })
		])

		// Normalización de servicio mediante regex en Mongo
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

		// Ingresos por servicio (normalizado)
		const revenueByService = await Payment.aggregate([
			{ $match: { status: { $in: validStatuses } } },
			addCanonicalServiceStage as any,
			{ $group: { _id: '$canonicalService', total: { $sum: '$amount' }, count: { $sum: 1 } } },
			{ $project: { _id: 0, service: '$_id', total: 1, count: 1 } },
			{ $sort: { total: -1 } }
		])

		// Ingresos por categoría usando canonicalService
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

		// Serie temporal de ingresos últimos N días
		const revenueTimeseries = await Payment.aggregate([
			{ $match: { status: { $in: validStatuses }, transactionDate: { $gte: since } } },
			{ $group: { _id: { y: { $year: '$transactionDate' }, m: { $month: '$transactionDate' }, d: { $dayOfMonth: '$transactionDate' } }, total: { $sum: '$amount' } } },
			{ $project: { _id: 0, date: { $dateFromParts: { year: '$_id.y', month: '$_id.m', day: '$_id.d' } }, total: 1 } },
			{ $sort: { date: 1 } }
		])

		// Suscriptores activos por alerta (desde Payments vigentes, normalizados)
		const activeAlertSubscribersAgg = await Payment.aggregate([
			{ $match: { status: { $in: validStatuses }, expiryDate: { $gt: now } } },
			addCanonicalServiceStage as any,
			{ $match: { canonicalService: { $in: [...alertServices] } } },
			{ $group: { _id: { service: '$canonicalService', email: '$userEmail' } } },
			{ $group: { _id: '$_id.service', users: { $sum: 1 } } },
			{ $project: { _id: 0, service: '$_id', users: 1 } }
		])
		const subscribersByAlertMap: Record<string, number> = {}
		activeAlertSubscribersAgg.forEach(r => { subscribersByAlertMap[r.service] = r.users })

		// Usuarios únicos con suscripción activa por servicio (pagos no expirados, normalizados)
		const activeSubscriptionsByService = await Payment.aggregate([
			{ $match: { status: { $in: validStatuses }, expiryDate: { $gt: now } } },
			addCanonicalServiceStage as any,
			{ $group: { _id: { service: '$canonicalService', userEmail: '$userEmail' } } },
			{ $group: { _id: '$_id.service', users: { $sum: 1 } } },
			{ $project: { _id: 0, service: '$_id', users: 1 } },
			{ $sort: { users: -1 } }
		])

		const activeSubscriptionsTotal = activeSubscriptionsByService.reduce((acc, it) => acc + (it.users || 0), 0)
		const arpu = totalUsers > 0 ? totalRevenue / totalUsers : 0

		// Últimos pagos aprobados
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
			subscriptionsByAlert: {
				alertas_trader: subscribersByAlertMap['TraderCall'] || 0,
				alertas_smart: subscribersByAlertMap['SmartMoney'] || 0,
				alertas_cashflow: subscribersByAlertMap['CashFlow'] || 0
			},
			activeSubscriptionsByService,
			latestPayments
		})
	} catch (error) {
		console.error('❌ Error en admin analytics overview:', error)
		return res.status(500).json({ error: 'Error interno del servidor' })
	}
} 