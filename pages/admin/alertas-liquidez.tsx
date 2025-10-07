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

interface SimpleAlert { id: string; symbol: string; status: string; tipo?: string; currentPrice?: string }

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
  const [smartAssignAmount, setSmartAssignAmount] = useState('');
  const [smartAssignMessage, setSmartAssignMessage] = useState('');
  const [smartAssignImageUrl, setSmartAssignImageUrl] = useState('');
  const [traderAssignId, setTraderAssignId] = useState('');
  const [traderAssignPct, setTraderAssignPct] = useState('');
  const [traderAssignAmount, setTraderAssignAmount] = useState('');
  const [traderAssignMessage, setTraderAssignMessage] = useState('');
  const [traderAssignImageUrl, setTraderAssignImageUrl] = useState('');

  // ✅ NUEVO: Venta con rango de precios
  const [smartSellId, setSmartSellId] = useState('');
  const [smartSellPercentage, setSmartSellPercentage] = useState('50');
  const [smartSellPriceMin, setSmartSellPriceMin] = useState('');
  const [smartSellPriceMax, setSmartSellPriceMax] = useState('');
  const [smartSellMessage, setSmartSellMessage] = useState('');
  const [smartSellImageUrl, setSmartSellImageUrl] = useState('');
  const [traderSellId, setTraderSellId] = useState('');
  const [traderSellPercentage, setTraderSellPercentage] = useState('50');
  const [traderSellPriceMin, setTraderSellPriceMin] = useState('');
  const [traderSellPriceMax, setTraderSellPriceMax] = useState('');
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
      setSmartAlerts((smart.alerts || []).map(a => ({ id: a.id, symbol: a.symbol, status: a.status, tipo: 'SmartMoney', currentPrice: a.currentPrice })));
      setTraderAlerts((trader.alerts || []).map(a => ({ id: a.id, symbol: a.symbol, status: a.status, tipo: 'TraderCall', currentPrice: a.currentPrice })));
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
      setTraderAssignAmount('');
      setTraderAssignMessage('');
      setTraderAssignImageUrl('');
      setTraderSellId('');
      setTraderSellPercentage('50');
      setTraderSellPriceMin('');
      setTraderSellPriceMax('');
      setTraderSellMessage('');
      setTraderSellImageUrl('');
    } else if (selectedPool === 'TraderCall') {
      setSmartAssignId('');
      setSmartAssignPct('');
      setSmartAssignAmount('');
      setSmartAssignMessage('');
      setSmartAssignImageUrl('');
      setSmartSellId('');
      setSmartSellPercentage('50');
      setSmartSellPriceMin('');
      setSmartSellPriceMax('');
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

  const validateAssign = (pct: string, amount?: string) => {
    const n = Number(pct);
    const m = Number(amount);
    if ((!Number.isFinite(n) || n <= 0) && (!Number.isFinite(m) || m <= 0)) throw new Error('Ingrese % (>0) o monto (>0)');
    if (Number.isFinite(n) && n > 100) throw new Error('El porcentaje no puede exceder 100%');
    if (!liquidity) return;
    const required = Number.isFinite(m) && m > 0 ? m : (liquidity.totalLiquidity * n) / 100;
    if (required > liquidity.availableLiquidity) throw new Error('No hay liquidez suficiente disponible');
  };

  const handleAssign = async (alertId: string, pct: string, amount?: string, message?: string, imageUrl?: string) => {
    validateAssign(pct, amount);
    const body: any = { alertId };
    if (Number(pct) > 0) body.percentage = Number(pct);
    if (Number(amount) > 0) body.amount = Number(amount);
    if (message) body.emailMessage = message;
    if (imageUrl) body.emailImageUrl = imageUrl;
    await fetchJSON<{ success: boolean }>(
      '/api/liquidity/distribute',
      { method: 'POST', body: JSON.stringify(body) }
    );
    toast?.success('Liquidez asignada');
    await Promise.all([loadData(), loadActiveAlerts()]);
  };

  const handleAssignSmart = async () => {
    try {
      setSaving(true); setError(null);
      if (!smartAssignId) throw new Error('Seleccione una alerta SmartMoney');
      await handleAssign(smartAssignId, smartAssignPct, smartAssignAmount, smartAssignMessage, smartAssignImageUrl);
      setSmartAssignId(''); setSmartAssignPct(''); setSmartAssignAmount(''); setSmartAssignMessage(''); setSmartAssignImageUrl('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const handleAssignTrader = async () => {
    try {
      setSaving(true); setError(null);
      if (!traderAssignId) throw new Error('Seleccione una alerta TraderCall');
      await handleAssign(traderAssignId, traderAssignPct, traderAssignAmount, traderAssignMessage, traderAssignImageUrl);
      setTraderAssignId(''); setTraderAssignPct(''); setTraderAssignAmount(''); setTraderAssignMessage(''); setTraderAssignImageUrl('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  // ✅ NUEVO: Validación para venta con rango de precios
  const validateSellWithRange = (percentage: string, priceMin: string, priceMax: string) => {
    const pct = Number(percentage);
    const min = Number(priceMin);
    const max = Number(priceMax);
    
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new Error('Porcentaje debe estar entre 1 y 100');
    }
    if (!Number.isFinite(min) || min <= 0) {
      throw new Error('Precio mínimo inválido');
    }
    if (!Number.isFinite(max) || max <= 0) {
      throw new Error('Precio máximo inválido');
    }
    if (min >= max) {
      throw new Error('Precio mínimo debe ser menor al máximo');
    }
  };

  // ✅ NUEVO: Función de venta con rango de precios
  const handleSellWithRange = async (alertId: string, percentage: string, priceMin: string, priceMax: string, message?: string, imageUrl?: string) => {
    validateSellWithRange(percentage, priceMin, priceMax);
    
    const result = await fetchJSON<{ success: boolean; result: { remainingShares: number } }>(
      '/api/admin/partial-sale',
      { 
        method: 'POST', 
        body: JSON.stringify({ 
          alertId, 
          percentage: Number(percentage),
          priceRange: {
            min: Number(priceMin),
            max: Number(priceMax)
          },
          tipo: selectedPool,
          emailMessage: message || undefined, 
          emailImageUrl: imageUrl || undefined 
        }) 
      }
    );
    
    toast?.success(`Venta de ${percentage}% en rango $${priceMin}-$${priceMax} registrada`);
    
    // Si se vendió todo, opcionalmente disparar notificación de cierre total con mensaje/imagen
    if (result?.result?.remainingShares === 0) {
      try {
        await fetchJSON('/api/alerts/close', {
          method: 'POST',
          body: JSON.stringify({ 
            alertId, 
            currentPrice: Number(priceMax), // Usar precio máximo como referencia
            reason: 'MANUAL', 
            emailMessage: message || undefined, 
            emailImageUrl: imageUrl || undefined 
          })
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
      await handleSellWithRange(smartSellId, smartSellPercentage, smartSellPriceMin, smartSellPriceMax, smartSellMessage, smartSellImageUrl);
      setSmartSellId(''); setSmartSellPercentage('50'); setSmartSellPriceMin(''); setSmartSellPriceMax(''); setSmartSellMessage(''); setSmartSellImageUrl('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const handleSellTrader = async () => {
    try {
      setSaving(true); setError(null);
      if (!traderSellId) throw new Error('Seleccione una alerta TraderCall');
      await handleSellWithRange(traderSellId, traderSellPercentage, traderSellPriceMin, traderSellPriceMax, traderSellMessage, traderSellImageUrl);
      setTraderSellId(''); setTraderSellPercentage('50'); setTraderSellPriceMin(''); setTraderSellPriceMax(''); setTraderSellMessage(''); setTraderSellImageUrl('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const totalAssignedPct = useMemo(() => {
    if (!liquidity) return 0;
    return liquidity.distributions.reduce((sum, d) => sum + (d.percentage || 0), 0);
  }, [liquidity]);

  const remainingPct = useMemo(() => {
    const rem = 100 - totalAssignedPct;
    return rem < 0 ? 0 : rem;
  }, [totalAssignedPct]);

  const activeDistributionsOptions = React.useMemo(() => {
    if (!liquidity) return { smart: [], trader: [] } as { smart: Array<{ id: string; symbol: string }>; trader: Array<{ id: string; symbol: string }> };
    const dists = (liquidity.distributions || []).filter((d: any) => d.isActive && d.shares > 0);
    return {
      smart: dists
        .filter((d: any) => selectedPool === 'SmartMoney')
        .map((d: any) => ({ id: d.alertId, symbol: d.symbol })),
      trader: dists
        .filter((d: any) => selectedPool === 'TraderCall')
        .map((d: any) => ({ id: d.alertId, symbol: d.symbol }))
    };
  }, [liquidity, selectedPool]);

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
            {card(<>
              <div className={styles.label}>% restante por distribuir</div>
              <div className={styles.value}>{remainingPct.toFixed(2)}%</div>
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
            <input value={smartAssignAmount} onChange={e => setSmartAssignAmount(e.target.value)} type="number" step="0.01" className={styles.input} placeholder="$ monto" />
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
          <div className="text-sm" style={{ color: '#9ca3af', marginTop: 8 }}>
            % asignado total: {totalAssignedPct.toFixed(2)}% · % restante: {remainingPct.toFixed(2)}%
          </div>
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
            <input value={traderAssignAmount} onChange={e => setTraderAssignAmount(e.target.value)} type="number" step="0.01" className={styles.input} placeholder="$ monto" />
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
          <div className="text-sm" style={{ color: '#9ca3af', marginTop: 8 }}>
            % asignado total: {totalAssignedPct.toFixed(2)}% · % restante: {remainingPct.toFixed(2)}%
          </div>
        </>)}

        {/* ✅ NUEVO: Vender SmartMoney con rango de precios */}
        {selectedPool === 'SmartMoney' && card(<> 
          <div className="font-medium mb-3">Vender - SmartMoney</div>
          <div className={styles.row}>
            <select value={smartSellId} onChange={e => setSmartSellId(e.target.value)} className={styles.select}>
              <option value="">Seleccione alerta</option>
              {(activeDistributionsOptions.smart.length ? activeDistributionsOptions.smart : smartAlerts).map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input 
              value={smartSellPercentage} 
              onChange={e => setSmartSellPercentage(e.target.value)} 
              type="number" 
              min="1" 
              max="100" 
              step="1" 
              className={styles.input} 
              placeholder="%" 
              style={{ width: '80px' }}
            />
            <input 
              value={smartSellPriceMin} 
              onChange={e => setSmartSellPriceMin(e.target.value)} 
              type="number" 
              step="0.01" 
              min="0" 
              className={styles.input} 
              placeholder="Precio min" 
            />
            <input 
              value={smartSellPriceMax} 
              onChange={e => setSmartSellPriceMax(e.target.value)} 
              type="number" 
              step="0.01" 
              min="0" 
              className={styles.input} 
              placeholder="Precio max" 
            />
            {smartSellId && (
              <span className={styles.currentPriceSpan}>
                Actual: {smartAlerts.find(a => a.id === smartSellId)?.currentPrice || 'N/A'}
              </span>
            )}
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

        {/* ✅ NUEVO: Vender TraderCall con rango de precios */}
        {selectedPool === 'TraderCall' && card(<>
          <div className="font-medium mb-3">Vender - TraderCall</div>
          <div className={styles.row}>
            <select value={traderSellId} onChange={e => setTraderSellId(e.target.value)} className={styles.select}>
              <option value="">Seleccione alerta</option>
              {(activeDistributionsOptions.trader.length ? activeDistributionsOptions.trader : traderAlerts).map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input 
              value={traderSellPercentage} 
              onChange={e => setTraderSellPercentage(e.target.value)} 
              type="number" 
              min="1" 
              max="100" 
              step="1" 
              className={styles.input} 
              placeholder="%" 
              style={{ width: '80px' }}
            />
            <input 
              value={traderSellPriceMin} 
              onChange={e => setTraderSellPriceMin(e.target.value)} 
              type="number" 
              step="0.01" 
              min="0" 
              className={styles.input} 
              placeholder="Precio min" 
            />
            <input 
              value={traderSellPriceMax} 
              onChange={e => setTraderSellPriceMax(e.target.value)} 
              type="number" 
              step="0.01" 
              min="0" 
              className={styles.input} 
              placeholder="Precio max" 
            />
            {traderSellId && (
              <span className={styles.currentPriceSpan}>
                Actual: {traderAlerts.find(a => a.id === traderSellId)?.currentPrice || 'N/A'}
              </span>
            )}
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
                      <button onClick={() => handleSellWithRange(d.alertId, '100', String(d.currentPrice), String(d.currentPrice))} className={`${styles.btn} ${styles.btnWarn}`}>Vender total</button>
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