import { GetServerSideProps } from 'next'
import Head from 'next/head'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/googleAuth'
import { verifyAdminAccess } from '@/lib/adminAuth'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import styles from '@/styles/AdminDashboard.module.css'
import { useEffect, useMemo, useState } from 'react'
import { BarChart3, PieChart as PieIcon, TrendingUp, Users, DollarSign, Activity } from 'lucide-react'

// Carga condicional de recharts
let ResponsiveContainer: any, LineChart: any, Line: any, XAxis: any, YAxis: any, Tooltip: any, CartesianGrid: any, PieChart: any, Pie: any, Cell: any, Legend: any
try {
	const recharts = require('recharts')
	ResponsiveContainer = recharts.ResponsiveContainer
	LineChart = recharts.LineChart
	Line = recharts.Line
	XAxis = recharts.XAxis
	YAxis = recharts.YAxis
	Tooltip = recharts.Tooltip
	CartesianGrid = recharts.CartesianGrid
	PieChart = recharts.PieChart
	Pie = recharts.Pie
	Cell = recharts.Cell
	Legend = recharts.Legend
} catch (e) {
	console.warn('Recharts no está instalado, se mostrará estado vacío para gráficos')
}

interface AdminAnalyticsProps {
	user: any
}

export default function AdminAnalyticsPage({ user }: AdminAnalyticsProps) {
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [data, setData] = useState<any>(null)
	const [rangeDays, setRangeDays] = useState(30)

	useEffect(() => {
		const fetchData = async () => {
			try {
				setLoading(true)
				const res = await fetch(`/api/admin/analytics/overview?rangeDays=${rangeDays}`)
				if (!res.ok) throw new Error('No se pudieron cargar las analíticas')
				const json = await res.json()
				setData(json)
				setError(null)
			} catch (err: any) {
				setError(err.message || 'Error cargando datos')
			} finally {
				setLoading(false)
			}
		}
		fetchData()
	}, [rangeDays])

	const currency = (n: number) => `$${Number(n || 0).toLocaleString()}`

	const kpis = useMemo(() => [
		{ label: 'Ingresos Totales', value: currency(data?.kpis?.totalRevenue || 0), icon: <DollarSign size={20} />, color: '#059669' },
		{ label: 'Ingresos Mensuales', value: currency(data?.kpis?.monthlyRevenue || 0), icon: <TrendingUp size={20} />, color: '#10b981' },
		{ label: 'Suscripciones Activas', value: Number(data?.kpis?.activeSubscriptionsTotal || 0).toLocaleString(), icon: <Activity size={20} />, color: '#3b82f6' },
		{ label: 'Usuarios', value: Number(data?.kpis?.totalUsers || 0).toLocaleString(), icon: <Users size={20} />, color: '#6366f1' }
	], [data])

	const timeseries = (data?.revenueTimeseries || []).map((d: any) => ({
		date: new Date(d.date).toLocaleDateString('es-AR'),
		total: d.total
	}))

	const pieColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

	// Combinar ingresos por servicio: pagos + manual
	const revenueByServiceCombined = useMemo(() => {
		const base = (data?.revenueByService || []) as Array<{ service: string; total: number; count: number }>
		const manual = (data?.manualRevenueByService || []) as Array<{ service: string; total: number }>
		const manualMap = new Map(manual.map(r => [r.service, r.total]))
		return base.map(r => ({
			service: r.service,
			payments: r.total || 0,
			manual: manualMap.get(r.service) || 0,
			total: (r.total || 0) + (manualMap.get(r.service) || 0),
			count: r.count || 0
		}))
	}, [data])

	return (
		<>
			<Head>
				<title>Analíticas - Administrador</title>
				<meta name="description" content="Analíticas y métricas del sitio" />
			</Head>
			<Navbar />
			<main className={styles.main}>
				<div className={styles.container}>
					<div className={styles.header}>
						<div>
							<h1 className={styles.title}>Analíticas</h1>
							<p className={styles.subtitle}>Ingresos, suscripciones y actividad. Rango: {rangeDays} días</p>
						</div>
					</div>

					<div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
						{kpis.map((k, idx) => (
							<div key={idx} style={{ flex: '1 1 220px', background: '#0b1220', border: '1px solid #1f2a44', borderRadius: 12, padding: 16 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8, color: k.color }}>{k.icon}<span style={{ fontWeight: 600 }}>{k.label}</span></div>
								<div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>{k.value}</div>
							</div>
						))}
					</div>

					<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 16 }}>
						<div style={{ background: '#0b1220', border: '1px solid #1f2a44', borderRadius: 12, padding: 16 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
								<BarChart3 size={20} />
								<strong>Ingresos diarios</strong>
							</div>
							{ResponsiveContainer && LineChart ? (
								<div style={{ width: '100%', height: 280 }}>
									<ResponsiveContainer>
										<LineChart data={timeseries}>
											<CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
											<XAxis dataKey="date" stroke="#94a3b8" />
											<YAxis stroke="#94a3b8" />
											<Tooltip />
											<Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
										</LineChart>
									</ResponsiveContainer>
								</div>
							) : (
								<div style={{ color: '#94a3b8' }}>Instalá recharts para ver el gráfico (npm i recharts)</div>
							)}
						</div>

						<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
							<div style={{ background: '#0b1220', border: '1px solid #1f2a44', borderRadius: 12, padding: 16 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
									<PieIcon size={20} />
									<strong>Ingresos por categoría</strong>
								</div>
								{ResponsiveContainer && PieChart ? (
									<div style={{ width: '100%', height: 280 }}>
										<ResponsiveContainer>
											<PieChart>
												<Pie data={data?.revenueByCategory || []} dataKey="total" nameKey="category" outerRadius={100}>
													{(data?.revenueByCategory || []).map((_: any, i: number) => (
														<Cell key={i} fill={pieColors[i % pieColors.length]} />
													))}
												</Pie>
												<Tooltip />
												<Legend />
											</PieChart>
										</ResponsiveContainer>
									</div>
								) : (
									<div style={{ color: '#94a3b8' }}>Instalá recharts para ver el gráfico</div>
								)}
							</div>

							<div style={{ background: '#0b1220', border: '1px solid #1f2a44', borderRadius: 12, padding: 16 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
									<PieIcon size={20} />
									<strong>Suscripciones por alerta</strong>
								</div>
								<ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
									<li>TraderCall: {data?.subscriptionsByAlert?.alertas_trader || 0}</li>
									<li>SmartMoney: {data?.subscriptionsByAlert?.alertas_smart || 0}</li>
									<li>CashFlow: {data?.subscriptionsByAlert?.alertas_cashflow || 0}</li>
								</ul>
							</div>
						</div>

						<div style={{ background: '#0b1220', border: '1px solid #1f2a44', borderRadius: 12, padding: 16 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
								<BarChart3 size={20} />
								<strong>Ingresos por servicio</strong>
							</div>
							<div style={{ overflowX: 'auto' }}>
								<table style={{ width: '100%', borderCollapse: 'collapse' }}>
									<thead>
										<tr style={{ textAlign: 'left', color: '#94a3b8' }}>
											<th>Servicio</th>
											<th>Pagos</th>
											<th>Manual</th>
											<th>Total</th>
											<th>Transacciones</th>
										</tr>
									</thead>
									<tbody>
										{revenueByServiceCombined.map((row: any, i: number) => (
											<tr key={i}>
												<td>{row.service}</td>
												<td>{currency(row.payments)}</td>
												<td>{currency(row.manual)}</td>
												<td>{currency(row.total)}</td>
												<td>{row.count}</td>
											</tr>) )}
									</tbody>
								</table>
							</div>
						</div>

						<div style={{ background: '#0b1220', border: '1px solid #1f2a44', borderRadius: 12, padding: 16 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
								<Activity size={20} />
								<strong>Pagos recientes</strong>
							</div>
							<div style={{ overflowX: 'auto' }}>
								<table style={{ width: '100%', borderCollapse: 'collapse' }}>
									<thead>
										<tr style={{ textAlign: 'left', color: '#94a3b8' }}>
											<th>Fecha</th>
											<th>Email</th>
											<th>Servicio</th>
											<th>Monto</th>
											<th>Vence</th>
										</tr>
									</thead>
									<tbody>
										{(data?.latestPayments || []).map((p: any, i: number) => (
											<tr key={i}>
												<td>{new Date(p.transactionDate).toLocaleDateString('es-AR')}</td>
												<td>{p.userEmail}</td>
												<td>{p.service}</td>
												<td>{currency(p.amount)} {p.currency}</td>
												<td>{new Date(p.expiryDate).toLocaleDateString('es-AR')}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</main>
			<Footer />
		</>
	)
}

export const getServerSideProps: GetServerSideProps = async (context) => {
	const session = await getServerSession(context.req, context.res, authOptions)
	if (!session) {
		return { redirect: { destination: '/api/auth/signin', permanent: false }, props: {} as any }
	}

	const adminCheck = await verifyAdminAccess(context)
	if (!adminCheck.isAdmin) {
		return { redirect: { destination: adminCheck.redirectTo || '/', permanent: false }, props: {} as any }
	}

	return {
		props: {
			user: adminCheck.user
		}
	}
} 