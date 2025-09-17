import React, { useEffect, useMemo, useState } from 'react';
import AdminRouteGuard from '@/components/AdminRouteGuard';
import { useRouter } from 'next/router';
import styles from '@/styles/AdminLiquidity.module.css';
import Navbar from '@/components/Navbar';
import ImageUploader, { type CloudinaryImage } from '@/components/ImageUploader';

// Lazy import de toast para evitar SSR issues
let toast: any;
try { toast = require('react-hot-toast').toast; } catch {}

interface LiquidityData {
  id: string;
  totalLiquidity: number;
  availableLiquidity: number;
  distributedLiquidity: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  distributions: Array<{
    alertId: string;
    symbol: string;
    percentage: number;
    allocatedAmount: number;
    entryPrice: number;
    currentPrice: number;
    shares: number;
    profitLoss: number;
    profitLossPercentage: number;
    realizedProfitLoss?: number;
    soldShares?: number;
    isActive: boolean;
    createdAt: string;
  }>;
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    credentials: 'same-origin'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Error de red');
  return data as T;
}

interface SimpleAlert { id: string; symbol: string; status: string; tipo?: string }

const AdminLiquidityPage: React.FC = () => {
  const router = useRouter();
  const queryAlertId = (router.query.alertId as string) || '';
  const queryTipo = (router.query.tipo as string) || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liquidity, setLiquidity] = useState<LiquidityData | null>(null);
  const [newTotal, setNewTotal] = useState<string>('');
  const [selectedPool, setSelectedPool] = useState<'TraderCall' | 'SmartMoney'>('TraderCall');

  // Listas de alertas activas por tipo
  const [smartAlerts, setSmartAlerts] = useState<SimpleAlert[]>([]);
  const [traderAlerts, setTraderAlerts] = useState<SimpleAlert[]>([]);

  // Asignación
  const [smartAssignId, setSmartAssignId] = useState('');
  const [smartAssignPct, setSmartAssignPct] = useState('');
  const [smartAssignMessage, setSmartAssignMessage] = useState('');
  const [smartAssignImageUrl, setSmartAssignImageUrl] = useState('');
  const [traderAssignId, setTraderAssignId] = useState('');
  const [traderAssignPct, setTraderAssignPct] = useState('');
  const [traderAssignMessage, setTraderAssignMessage] = useState('');
  const [traderAssignImageUrl, setTraderAssignImageUrl] = useState('');

  // Venta
  const [smartSellId, setSmartSellId] = useState('');
  const [smartSellShares, setSmartSellShares] = useState('');
  const [smartSellPrice, setSmartSellPrice] = useState('');
  const [smartSellMessage, setSmartSellMessage] = useState('');
  const [smartSellImageUrl, setSmartSellImageUrl] = useState('');
  const [traderSellId, setTraderSellId] = useState('');
  const [traderSellShares, setTraderSellShares] = useState('');
  const [traderSellPrice, setTraderSellPrice] = useState('');
  const [traderSellMessage, setTraderSellMessage] = useState('');
  const [traderSellImageUrl, setTraderSellImageUrl] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchJSON<{ success: boolean; liquidity: LiquidityData }>(`/api/liquidity?pool=${selectedPool}`);
      setLiquidity(resp.liquidity);
      setNewTotal(String(resp.liquidity.totalLiquidity || ''));
    } catch (e: any) {
      setError(e.message);
      toast?.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveAlerts = async () => {
    try {
      const [smart, trader] = await Promise.all([
        fetchJSON<{ success: boolean; alerts: any[] }>(`/api/alerts/list?status=ACTIVE&tipo=SmartMoney&limit=100`),
        fetchJSON<{ success: boolean; alerts: any[] }>(`/api/alerts/list?status=ACTIVE&tipo=TraderCall&limit=100`)
      ]);
      setSmartAlerts((smart.alerts || []).map(a => ({ id: a.id, symbol: a.symbol, status: a.status, tipo: 'SmartMoney' })));
      setTraderAlerts((trader.alerts || []).map(a => ({ id: a.id, symbol: a.symbol, status: a.status, tipo: 'TraderCall' })));
    } catch (e) {
      // silencioso
    }
  };

  useEffect(() => { loadData(); loadActiveAlerts(); }, [selectedPool]);

  // Preseleccionar desde query cuando listas estén cargadas
  useEffect(() => {
    if (!queryAlertId || !queryTipo) return;
    if (queryTipo === 'SmartMoney') {
      setSmartAssignId(queryAlertId);
      setSmartSellId(queryAlertId);
      setSelectedPool('SmartMoney');
    }
    if (queryTipo === 'TraderCall') {
      setTraderAssignId(queryAlertId);
      setTraderSellId(queryAlertId);
      setSelectedPool('TraderCall');
    }
  }, [queryAlertId, queryTipo, smartAlerts.length, traderAlerts.length]);

  // Limpiar estados no relevantes al cambiar de pool
  useEffect(() => {
    if (selectedPool === 'SmartMoney') {
      setTraderAssignId('');
      setTraderAssignPct('');
      setTraderAssignMessage('');
      setTraderAssignImageUrl('');
      setTraderSellId('');
      setTraderSellShares('');
      setTraderSellPrice('');
      setTraderSellMessage('');
      setTraderSellImageUrl('');
    } else if (selectedPool === 'TraderCall') {
      setSmartAssignId('');
      setSmartAssignPct('');
      setSmartAssignMessage('');
      setSmartAssignImageUrl('');
      setSmartSellId('');
      setSmartSellShares('');
      setSmartSellPrice('');
      setSmartSellMessage('');
      setSmartSellImageUrl('');
    }
  }, [selectedPool]);

  const handleUpdateTotal = async () => {
    try {
      setSaving(true);
      setError(null);
      const totalLiquidity = Number(newTotal);
      if (!Number.isFinite(totalLiquidity) || totalLiquidity <= 0) {
        throw new Error('Ingrese un monto válido (> 0)');
      }
      const resp = await fetchJSON<{ success: boolean; liquidity: LiquidityData; message: string }>(
        '/api/liquidity',
        { method: 'POST', body: JSON.stringify({ totalLiquidity, pool: selectedPool }) }
      );
      setLiquidity(resp.liquidity);
      toast?.success('Liquidez actualizada');
    } catch (e: any) {
      setError(e.message);
      toast?.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const validateAssign = (pct: string) => {
    const n = Number(pct);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Porcentaje inválido');
    if (n > 100) throw new Error('El porcentaje no puede exceder 100%');
    // Validar disponible aproximado
    if (!liquidity) return;
    const required = (liquidity.totalLiquidity * n) / 100;
    if (required > liquidity.availableLiquidity) throw new Error('No hay liquidez suficiente disponible');
  };

  const handleAssign = async (alertId: string, pct: string, message?: string, imageUrl?: string) => {
    validateAssign(pct);
    await fetchJSON<{ success: boolean }>(
      '/api/liquidity/distribute',
      { method: 'POST', body: JSON.stringify({ alertId, percentage: Number(pct), emailMessage: message || undefined, emailImageUrl: imageUrl || undefined }) }
    );
    toast?.success('Liquidez asignada');
    await Promise.all([loadData(), loadActiveAlerts()]);
  };

  const handleAssignSmart = async () => {
    try {
      setSaving(true); setError(null);
      if (!smartAssignId) throw new Error('Seleccione una alerta SmartMoney');
      await handleAssign(smartAssignId, smartAssignPct, smartAssignMessage, smartAssignImageUrl);
      setSmartAssignId(''); setSmartAssignPct(''); setSmartAssignMessage(''); setSmartAssignImageUrl('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const handleAssignTrader = async () => {
    try {
      setSaving(true); setError(null);
      if (!traderAssignId) throw new Error('Seleccione una alerta TraderCall');
      await handleAssign(traderAssignId, traderAssignPct, traderAssignMessage, traderAssignImageUrl);
      setTraderAssignId(''); setTraderAssignPct(''); setTraderAssignMessage(''); setTraderAssignImageUrl('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const validateSell = (shares: string, price: string) => {
    const s = Number(shares);
    const p = Number(price);
    if (!Number.isFinite(s) || s <= 0) throw new Error('Shares inválido');
    if (!Number.isFinite(p) || p <= 0) throw new Error('Precio inválido');
  };

  const handleSell = async (alertId: string, shares: string, price: string, message?: string, imageUrl?: string) => {
    validateSell(shares, price);
    const result = await fetchJSON<{ success: boolean; result: { remainingShares: number } }>(
      '/api/liquidity/sell',
      { method: 'POST', body: JSON.stringify({ alertId, shares: Number(shares), price: Number(price), emailMessage: message || undefined, emailImageUrl: imageUrl || undefined }) }
    );
    toast?.success('Venta registrada');
    // Si se vendió todo, opcionalmente disparar notificación de cierre total con mensaje/imagen
    if (result?.result?.remainingShares === 0) {
      try {
        await fetchJSON('/api/alerts/close', {
          method: 'POST',
          body: JSON.stringify({ alertId, currentPrice: Number(price), reason: 'MANUAL', emailMessage: message || undefined, emailImageUrl: imageUrl || undefined })
        });
        toast?.success('Cierre total notificado');
      } catch {}
    } else if (message || imageUrl) {
      // TODO: agregar endpoint específico para notificar cierre parcial si se requiere notificación inmediata
    }
    await Promise.all([loadData(), loadActiveAlerts()]);
  };

  const handleSellSmart = async () => {
    try {
      setSaving(true); setError(null);
      if (!smartSellId) throw new Error('Seleccione una alerta SmartMoney');
      await handleSell(smartSellId, smartSellShares, smartSellPrice, smartSellMessage, smartSellImageUrl);
      setSmartSellId(''); setSmartSellShares(''); setSmartSellPrice(''); setSmartSellMessage(''); setSmartSellImageUrl('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const handleSellTrader = async () => {
    try {
      setSaving(true); setError(null);
      if (!traderSellId) throw new Error('Seleccione una alerta TraderCall');
      await handleSell(traderSellId, traderSellShares, traderSellPrice, traderSellMessage, traderSellImageUrl);
      setTraderSellId(''); setTraderSellShares(''); setTraderSellPrice(''); setTraderSellMessage(''); setTraderSellImageUrl('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const totalAssignedPct = useMemo(() => {
    if (!liquidity) return 0;
    return liquidity.distributions.reduce((sum, d) => sum + (d.percentage || 0), 0);
  }, [liquidity]);

  const card = (children: React.ReactNode) => (
    <div className={styles.card}>{children}</div>
  );

  if (loading) {
    return (
      <AdminRouteGuard>
        <div className={styles.page}>Cargando...</div>
      </AdminRouteGuard>
    );
  }

  return (
    <AdminRouteGuard>
      <Navbar />
      <div className={styles.page}>
        <div className={styles.title}>Liquidez</div>

        {/* Selector de Pool */}
        <div className={styles.card} style={{ marginBottom: 16 }}>
          <div className={styles.row}>
            <div className={styles.label}>Pool seleccionado</div>
            <div className={styles.row} style={{ gap: 8 }}>
              <button onClick={() => setSelectedPool('TraderCall')} className={`${styles.btn} ${selectedPool === 'TraderCall' ? styles.btnPrimary : ''}`}>TraderCall</button>
              <button onClick={() => setSelectedPool('SmartMoney')} className={`${styles.btn} ${selectedPool === 'SmartMoney' ? styles.btnPrimary : ''}`}>SmartMoney</button>
            </div>
          </div>
        </div>

        {/* Resumen */}
        {liquidity && (
          <div className={styles.grid}>
            {card(<>
              <div className={styles.label}>Liquidez Total ({selectedPool})</div>
              <div className={styles.value}>${liquidity.totalLiquidity.toFixed(2)}</div>
            </>)}
            {card(<>
              <div className={styles.label}>Disponible</div>
              <div className={styles.value}>${liquidity.availableLiquidity.toFixed(2)}</div>
            </>)}
            {card(<>
              <div className={styles.label}>Distribuida</div>
              <div className={styles.value}>${liquidity.distributedLiquidity.toFixed(2)}</div>
            </>)}
            {card(<>
              <div className={styles.label}>P&L Total</div>
              <div className={styles.value}>${liquidity.totalProfitLoss.toFixed(2)} ({liquidity.totalProfitLossPercentage.toFixed(2)}%)</div>
            </>)}
          </div>
        )}

        {/* Actualizar total */}
        {card(<>
          <div className="font-medium mb-2">Actualizar Liquidez Total ({selectedPool})</div>
          <div className={styles.row}>
            <input value={newTotal} onChange={e => setNewTotal(e.target.value)} type="number" step="0.01" className={styles.input} placeholder="Total USD" />
            <button onClick={handleUpdateTotal} disabled={saving} className={`${styles.btn} ${styles.btnPrimary}`}>Guardar</button>
          </div>
        </>)}

        {/* Asignar SmartMoney */}
        {selectedPool === 'SmartMoney' && card(<>
          <div className="font-medium mb-3">Asignar a Alerta Activa - SmartMoney</div>
          <div className={styles.row}>
            <select value={smartAssignId} onChange={e => setSmartAssignId(e.target.value)} className={styles.select}>
              <option value="">Seleccione alerta</option>
              {smartAlerts.map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input value={smartAssignPct} onChange={e => setSmartAssignPct(e.target.value)} type="number" step="0.01" className={styles.input} placeholder="%" />
            <button onClick={handleAssignSmart} disabled={saving} className={`${styles.btn} ${styles.btnSuccess}`}>Asignar</button>
          </div>
          <div className={styles.row} style={{ marginTop: 8, gap: 8 }}>
            <input value={smartAssignMessage} onChange={e => setSmartAssignMessage(e.target.value)} className={styles.input} placeholder="Mensaje de email (opcional)" />
            <input value={smartAssignImageUrl} onChange={e => setSmartAssignImageUrl(e.target.value)} className={styles.input} placeholder="URL imagen email (opcional)" />
            <ImageUploader
              onImageUploaded={(img: CloudinaryImage) => setSmartAssignImageUrl(img.secure_url || img.url)}
              buttonText="Subir Imagen"
              maxFiles={1}
              multiple={false}
            />
          </div>
          <div className="text-sm" style={{ color: '#9ca3af', marginTop: 8 }}>% asignado total: {totalAssignedPct.toFixed(2)}%</div>
        </>)}

        {/* Asignar TraderCall */}
        {selectedPool === 'TraderCall' && card(<>
          <div className="font-medium mb-3">Asignar a Alerta Activa - TraderCall</div>
          <div className={styles.row}>
            <select value={traderAssignId} onChange={e => setTraderAssignId(e.target.value)} className={styles.select}>
              <option value="">Seleccione alerta</option>
              {traderAlerts.map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input value={traderAssignPct} onChange={e => setTraderAssignPct(e.target.value)} type="number" step="0.01" className={styles.input} placeholder="%" />
            <button onClick={handleAssignTrader} disabled={saving} className={`${styles.btn} ${styles.btnSuccess}`}>Asignar</button>
          </div>
          <div className={styles.row} style={{ marginTop: 8, gap: 8 }}>
            <input value={traderAssignMessage} onChange={e => setTraderAssignMessage(e.target.value)} className={styles.input} placeholder="Mensaje de email (opcional)" />
            <input value={traderAssignImageUrl} onChange={e => setTraderAssignImageUrl(e.target.value)} className={styles.input} placeholder="URL imagen email (opcional)" />
            <ImageUploader
              onImageUploaded={(img: CloudinaryImage) => setTraderAssignImageUrl(img.secure_url || img.url)}
              buttonText="Subir Imagen"
              maxFiles={1}
              multiple={false}
            />
          </div>
        </>)}

        {/* Vender SmartMoney */}
        {selectedPool === 'SmartMoney' && card(<>
          <div className="font-medium mb-3">Vender - SmartMoney</div>
          <div className={styles.row}>
            <select value={smartSellId} onChange={e => setSmartSellId(e.target.value)} className={styles.select}>
              <option value="">Seleccione alerta</option>
              {smartAlerts.map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input value={smartSellShares} onChange={e => setSmartSellShares(e.target.value)} type="number" step="1" className={styles.input} placeholder="shares" />
            <input value={smartSellPrice} onChange={e => setSmartSellPrice(e.target.value)} type="number" step="0.01" className={styles.input} placeholder="price" />
            <button onClick={() => handleSellSmart()} disabled={saving} className={`${styles.btn} ${styles.btnWarn}`}>Vender</button>
          </div>
          <div className={styles.row} style={{ marginTop: 8, gap: 8 }}>
            <input value={smartSellMessage} onChange={e => setSmartSellMessage(e.target.value)} className={styles.input} placeholder="Mensaje de email (opcional)" />
            <input value={smartSellImageUrl} onChange={e => setSmartSellImageUrl(e.target.value)} className={styles.input} placeholder="URL imagen email (opcional)" />
            <ImageUploader
              onImageUploaded={(img: CloudinaryImage) => setSmartSellImageUrl(img.secure_url || img.url)}
              buttonText="Subir Imagen"
              maxFiles={1}
              multiple={false}
            />
          </div>
        </>)}

        {/* Vender TraderCall */}
        {selectedPool === 'TraderCall' && card(<>
          <div className="font-medium mb-3">Vender - TraderCall</div>
          <div className={styles.row}>
            <select value={traderSellId} onChange={e => setTraderSellId(e.target.value)} className={styles.select}>
              <option value="">Seleccione alerta</option>
              {traderAlerts.map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input value={traderSellShares} onChange={e => setTraderSellShares(e.target.value)} type="number" step="1" className={styles.input} placeholder="shares" />
            <input value={traderSellPrice} onChange={e => setTraderSellPrice(e.target.value)} type="number" step="0.01" className={styles.input} placeholder="price" />
            <button onClick={() => handleSellTrader()} disabled={saving} className={`${styles.btn} ${styles.btnWarn}`}>Vender</button>
          </div>
          <div className={styles.row} style={{ marginTop: 8, gap: 8 }}>
            <input value={traderSellMessage} onChange={e => setTraderSellMessage(e.target.value)} className={styles.input} placeholder="Mensaje de email (opcional)" />
            <input value={traderSellImageUrl} onChange={e => setTraderSellImageUrl(e.target.value)} className={styles.input} placeholder="URL imagen email (opcional)" />
            <ImageUploader
              onImageUploaded={(img: CloudinaryImage) => setTraderSellImageUrl(img.secure_url || img.url)}
              buttonText="Subir Imagen"
              maxFiles={1}
              multiple={false}
            />
          </div>
        </>)}

        {/* Distribuciones */}
        {card(<>
          <div className="font-medium mb-3">Distribuciones</div>
          <div className="overflow-auto">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Símbolo</th>
                  <th className={styles.th}>%</th>
                  <th className={styles.th}>Asignado</th>
                  <th className={styles.th}>Shares</th>
                  <th className={styles.th}>Entry</th>
                  <th className={styles.th}>Precio</th>
                  <th className={styles.th}>P&L</th>
                  <th className={styles.th}>Realizado</th>
                  <th className={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {liquidity?.distributions.map((d) => (
                  <tr key={d.alertId}>
                    <td className={styles.td}>{d.symbol}</td>
                    <td className={styles.td}>{d.percentage.toFixed(2)}%</td>
                    <td className={styles.td}>${d.allocatedAmount.toFixed(2)}</td>
                    <td className={styles.td}>{d.shares}</td>
                    <td className={styles.td}>${d.entryPrice.toFixed(2)}</td>
                    <td className={styles.td}>${d.currentPrice.toFixed(2)}</td>
                    <td className={styles.td}>${d.profitLoss.toFixed(2)} ({d.profitLossPercentage.toFixed(2)}%)</td>
                    <td className={styles.td}>${(d.realizedProfitLoss || 0).toFixed(2)}</td>
                    <td className={`${styles.td} ${styles.actions}`}>
                      <button onClick={() => handleSell(d.alertId, String(d.shares), String(d.currentPrice))} className={`${styles.btn} ${styles.btnWarn}`}>Vender total</button>
                      <button onClick={async () => { try { await fetchJSON('/api/liquidity/remove-distribution', { method: 'POST', body: JSON.stringify({ alertId: d.alertId }) }); toast?.success('Distribución removida'); await loadData(); } catch (e: any) { toast?.error(e.message); } }} className={`${styles.btn} ${styles.btnDanger}`}>Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}

        {error && <div className="text-red-400">{error}</div>}
      </div>
    </AdminRouteGuard>
  );
};

export default AdminLiquidityPage; 