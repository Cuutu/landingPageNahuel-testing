import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/Admin.module.css';
import { Calendar, Users, Download, RefreshCw, Clock, LinkIcon, Filter } from 'lucide-react';

interface SessionItem {
  _id: string;
  type: 'training' | 'advisory';
  serviceType: string;
  serviceName: string;
  startDate: string;
  endDate: string;
  duration: number;
  price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  user: { name: string; email: string; image?: string | null };
  meetingLink?: string | null;
  notes?: string | null;
  daysUntil: number;
}

interface ApiResponse {
  sessions: SessionItem[];
  stats: any;
  meta: any;
}

export default function UpcomingTrainingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState<'all' | 'confirmed' | 'pending'>('all');

  const swingSessions = useMemo(() => (
    sessions.filter(s => s.type === 'training' && s.serviceType === 'SwingTrading')
  ), [sessions]);

  const totals = useMemo(() => ({
    total: swingSessions.length,
    today: swingSessions.filter(s => s.daysUntil === 0).length,
    week: swingSessions.filter(s => s.daysUntil <= 7).length,
    withMeet: swingSessions.filter(s => !!s.meetingLink).length,
  }), [swingSessions]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ days: String(days), status, type: 'training', serviceType: 'SwingTrading' });
      const res = await fetch(`/api/admin/upcoming-sessions?${params.toString()}`);
      const data: ApiResponse = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Error');
      setSessions(data.sessions);
      setStats(data.stats);
    } catch (e: any) {
      setError(e.message || 'Error al cargar sesiones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, [days, status]);

  const exportCsv = () => {
    const rows = [
      ['Nombre', 'Email', 'Fecha', 'Hora', 'Duración', 'Estado', 'Meet'] as string[],
      ...swingSessions.map(s => [
        s.user.name,
        s.user.email,
        new Date(s.startDate).toLocaleDateString('es-ES'),
        new Date(s.startDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        `${s.duration} min`,
        s.status,
        s.meetingLink || ''
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swing_training_sesiones_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Head>
        <title>Próximas Sesiones - Swing Trading | Admin</title>
      </Head>
      <Navbar />
      <main className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.headerText}>
              <h1 className={styles.title}><Calendar /> Próximas Sesiones - Swing Trading</h1>
              <p className={styles.subtitle}>Listado de personas agendadas al próximo entrenamiento</p>
            </div>
            <div className={styles.actions}>
              <button className={styles.actionButton} onClick={fetchSessions} disabled={loading}>
                <RefreshCw size={16} /> Actualizar
              </button>
              <button className={styles.actionButton} onClick={exportCsv} disabled={loading || swingSessions.length === 0}>
                <Download size={16} /> Exportar CSV
              </button>
            </div>
          </div>
        </div>

        <div className={styles.filters} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Filter size={16} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Días:
            <input type="number" min={1} max={90} value={days} onChange={e => setDays(parseInt(e.target.value) || 30)} className={styles.input} style={{ width: 100 }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Estado:
            <select value={status} onChange={e => setStatus(e.target.value as any)} className={styles.input}>
              <option value="all">Todos</option>
              <option value="confirmed">Confirmados</option>
              <option value="pending">Pendientes</option>
            </select>
          </label>
          <button className={styles.actionButton} onClick={fetchSessions} disabled={loading}>Aplicar</button>
        </div>

        {/* Acciones administrativas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
          {/* Agendar manualmente */}
          <div className={styles.card} style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Agendar manualmente</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const email = (form.elements.namedItem('amail') as HTMLInputElement).value;
              const start = (form.elements.namedItem('astart') as HTMLInputElement).value;
              const dur = parseInt((form.elements.namedItem('adur') as HTMLInputElement).value || '180');
              try {
                const resp = await fetch('/api/admin/trainings/schedule/add-user', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, startDate: start, duration: dur, serviceType: 'SwingTrading' })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Error');
                await fetchSessions();
                alert('Agendado correctamente');
                form.reset();
              } catch (err: any) { alert(err.message || 'Error'); }
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                <input name="amail" className={styles.input} placeholder="Email" required />
                <input name="astart" type="datetime-local" className={styles.input} required />
                <input name="adur" type="number" className={styles.input} placeholder="Duración (min)" defaultValue={180} />
              </div>
              <button className={styles.actionButton} type="submit">Agendar</button>
            </form>
          </div>
          {/* Eliminar agenda */}
          <div className={styles.card} style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Eliminar usuario agendado</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const bookingId = (form.elements.namedItem('rbid') as HTMLInputElement).value;
              const email = (form.elements.namedItem('rmail') as HTMLInputElement).value;
              const start = (form.elements.namedItem('rstart') as HTMLInputElement).value;
              try {
                const resp = await fetch('/api/admin/trainings/schedule/remove-user', {
                  method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bookingId: bookingId || undefined, email: email || undefined, startDate: start || undefined, serviceType: 'SwingTrading' })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Error');
                await fetchSessions();
                alert('Eliminado correctamente');
                form.reset();
              } catch (err: any) { alert(err.message || 'Error'); }
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                <input name="rbid" className={styles.input} placeholder="Booking ID (opcional)" />
                <input name="rmail" className={styles.input} placeholder="Email (si no Booking ID)" />
                <input name="rstart" type="datetime-local" className={styles.input} placeholder="Fecha (si no Booking ID)" />
              </div>
              <button className={styles.actionButton} type="submit">Eliminar</button>
            </form>
          </div>
          {/* Migrar fecha */}
          <div className={styles.card} style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Migrar clase a otra fecha</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const from = (form.elements.namedItem('mfrom') as HTMLInputElement).value;
              const to = (form.elements.namedItem('mto') as HTMLInputElement).value;
              const keep = (form.elements.namedItem('mkeep') as HTMLInputElement).checked;
              try {
                const resp = await fetch('/api/admin/trainings/schedule/migrate', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fromStartDate: from, toStartDate: to, serviceType: 'SwingTrading', keepMeet: keep })
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Error');
                await fetchSessions();
                alert(`Migradas ${data.migrated} reservas`);
                form.reset();
              } catch (err: any) { alert(err.message || 'Error'); }
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input name="mfrom" type="datetime-local" className={styles.input} required />
                <input name="mto" type="datetime-local" className={styles.input} required />
              </div>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}><input type="checkbox" name="mkeep" /> Conservar Meet</label>
              <button className={styles.actionButton} type="submit">Migrar</button>
            </form>
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.kpiGrid} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
          <div className={styles.kpiCard}><Users size={16} /> Total: {totals.total}</div>
          <div className={styles.kpiCard}><Clock size={16} /> Hoy: {totals.today}</div>
          <div className={styles.kpiCard}><Clock size={16} /> Próx. 7 días: {totals.week}</div>
          <div className={styles.kpiCard}><LinkIcon size={16} /> Con Meet: {totals.withMeet}</div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Alumno</th>
                <th>Email</th>
                <th>Duración</th>
                <th>Estado</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {swingSessions.map(s => (
                <tr key={s._id}>
                  <td>{new Date(s.startDate).toLocaleDateString('es-ES')}</td>
                  <td>{new Date(s.startDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{s.user.name}</td>
                  <td>{s.user.email}</td>
                  <td>{s.duration} min</td>
                  <td>{s.status}</td>
                  <td>{s.meetingLink ? <a href={s.meetingLink} target="_blank" rel="noreferrer">Abrir</a> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p style={{ marginTop: 12 }}>Cargando…</p>}
          {!loading && swingSessions.length === 0 && <p style={{ marginTop: 12 }}>No hay sesiones en el rango seleccionado.</p>}
        </div>
      </main>
      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const adminCheck = await verifyAdminAccess(context);
  if (!adminCheck.isAdmin) {
    return {
      redirect: { destination: adminCheck.redirectTo || '/', permanent: false }
    } as any;
  }
  return { props: {} };
}; 