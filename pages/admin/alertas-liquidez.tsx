import React, { useEffect, useMemo, useState } from 'react';
import AdminRouteGuard from '@/components/AdminRouteGuard';
import { useRouter } from 'next/router';

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

  // Listas de alertas activas por tipo
  const [smartAlerts, setSmartAlerts] = useState<SimpleAlert[]>([]);
  const [traderAlerts, setTraderAlerts] = useState<SimpleAlert[]>([]);

  // Asignación
  const [smartAssignId, setSmartAssignId] = useState('');
  const [smartAssignPct, setSmartAssignPct] = useState('');
  const [traderAssignId, setTraderAssignId] = useState('');
  const [traderAssignPct, setTraderAssignPct] = useState('');

  // Venta
  const [smartSellId, setSmartSellId] = useState('');
  const [smartSellShares, setSmartSellShares] = useState('');
  const [smartSellPrice, setSmartSellPrice] = useState('');
  const [traderSellId, setTraderSellId] = useState('');
  const [traderSellShares, setTraderSellShares] = useState('');
  const [traderSellPrice, setTraderSellPrice] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchJSON<{ success: boolean; liquidity: LiquidityData }>('/api/liquidity');
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

  useEffect(() => { loadData(); loadActiveAlerts(); }, []);

  // Preseleccionar desde query cuando listas estén cargadas
  useEffect(() => {
    if (!queryAlertId || !queryTipo) return;
    if (queryTipo === 'SmartMoney') {
      setSmartAssignId(queryAlertId);
      setSmartSellId(queryAlertId);
    }
    if (queryTipo === 'TraderCall') {
      setTraderAssignId(queryAlertId);
      setTraderSellId(queryAlertId);
    }
  }, [queryAlertId, queryTipo, smartAlerts.length, traderAlerts.length]);

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
        { method: 'POST', body: JSON.stringify({ totalLiquidity }) }
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

  const handleAssign = async (alertId: string, pct: string) => {
    validateAssign(pct);
    await fetchJSON<{ success: boolean }>(
      '/api/liquidity/distribute',
      { method: 'POST', body: JSON.stringify({ alertId, percentage: Number(pct) }) }
    );
    toast?.success('Liquidez asignada');
    await Promise.all([loadData(), loadActiveAlerts()]);
  };

  const handleAssignSmart = async () => {
    try {
      setSaving(true); setError(null);
      if (!smartAssignId) throw new Error('Seleccione una alerta SmartMoney');
      await handleAssign(smartAssignId, smartAssignPct);
      setSmartAssignId(''); setSmartAssignPct('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const handleAssignTrader = async () => {
    try {
      setSaving(true); setError(null);
      if (!traderAssignId) throw new Error('Seleccione una alerta TraderCall');
      await handleAssign(traderAssignId, traderAssignPct);
      setTraderAssignId(''); setTraderAssignPct('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const validateSell = (shares: string, price: string) => {
    const s = Number(shares);
    const p = Number(price);
    if (!Number.isFinite(s) || s <= 0) throw new Error('Shares inválido');
    if (!Number.isFinite(p) || p <= 0) throw new Error('Precio inválido');
  };

  const handleSell = async (alertId: string, shares: string, price: string) => {
    validateSell(shares, price);
    await fetchJSON<{ success: boolean }>(
      '/api/liquidity/sell',
      { method: 'POST', body: JSON.stringify({ alertId, shares: Number(shares), price: Number(price) }) }
    );
    toast?.success('Venta registrada');
    await Promise.all([loadData(), loadActiveAlerts()]);
  };

  const handleSellSmart = async () => {
    try {
      setSaving(true); setError(null);
      if (!smartSellId) throw new Error('Seleccione una alerta SmartMoney');
      await handleSell(smartSellId, smartSellShares, smartSellPrice);
      setSmartSellId(''); setSmartSellShares(''); setSmartSellPrice('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const handleSellTrader = async () => {
    try {
      setSaving(true); setError(null);
      if (!traderSellId) throw new Error('Seleccione una alerta TraderCall');
      await handleSell(traderSellId, traderSellShares, traderSellPrice);
      setTraderSellId(''); setTraderSellShares(''); setTraderSellPrice('');
    } catch (e: any) { setError(e.message); toast?.error(e.message); } finally { setSaving(false); }
  };

  const totalAssignedPct = useMemo(() => {
    if (!liquidity) return 0;
    return liquidity.distributions.reduce((sum, d) => sum + (d.percentage || 0), 0);
  }, [liquidity]);

  const card = (children: React.ReactNode) => (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 shadow-sm">{children}</div>
  );

  if (loading) {
    return (
      <AdminRouteGuard>
        <div className="p-6 text-gray-200">Cargando...</div>
      </AdminRouteGuard>
    );
  }

  return (
    <AdminRouteGuard>
      <div className="p-6 space-y-6 text-gray-200">
        <h1 className="text-2xl font-semibold">Liquidez</h1>

        {/* Resumen */}
        {liquidity && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {card(<>
              <div className="text-sm text-gray-400">Liquidez Total</div>
              <div className="text-xl font-semibold">${liquidity.totalLiquidity.toFixed(2)}</div>
            </>)}
            {card(<>
              <div className="text-sm text-gray-400">Disponible</div>
              <div className="text-xl font-semibold">${liquidity.availableLiquidity.toFixed(2)}</div>
            </>)}
            {card(<>
              <div className="text-sm text-gray-400">Distribuida</div>
              <div className="text-xl font-semibold">${liquidity.distributedLiquidity.toFixed(2)}</div>
            </>)}
            {card(<>
              <div className="text-sm text-gray-400">P&L Total</div>
              <div className="text-xl font-semibold">${liquidity.totalProfitLoss.toFixed(2)} ({liquidity.totalProfitLossPercentage.toFixed(2)}%)</div>
            </>)}
          </div>
        )}

        {/* Actualizar total */}
        {card(<>
          <div className="font-medium mb-2">Actualizar Liquidez Total</div>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={newTotal} onChange={e => setNewTotal(e.target.value)} type="number" step="0.01" className="border border-gray-700 bg-gray-800 rounded px-3 py-2 w-48" placeholder="Total USD" />
            <button onClick={handleUpdateTotal} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Guardar</button>
          </div>
        </>)}

        {/* Asignar SmartMoney */}
        {card(<>
          <div className="font-medium mb-3">Asignar a Alerta Activa - SmartMoney</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={smartAssignId} onChange={e => setSmartAssignId(e.target.value)} className="border border-gray-700 bg-gray-800 rounded px-3 py-2 min-w-[220px]">
              <option value="">Seleccione alerta</option>
              {smartAlerts.map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input value={smartAssignPct} onChange={e => setSmartAssignPct(e.target.value)} type="number" step="0.01" className="border border-gray-700 bg-gray-800 rounded px-3 py-2 w-32" placeholder="%" />
            <button onClick={handleAssignSmart} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Asignar</button>
          </div>
          <div className="text-sm text-gray-400 mt-2">% asignado total: {totalAssignedPct.toFixed(2)}%</div>
        </>)}

        {/* Asignar TraderCall */}
        {card(<>
          <div className="font-medium mb-3">Asignar a Alerta Activa - TraderCall</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={traderAssignId} onChange={e => setTraderAssignId(e.target.value)} className="border border-gray-700 bg-gray-800 rounded px-3 py-2 min-w-[220px]">
              <option value="">Seleccione alerta</option>
              {traderAlerts.map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input value={traderAssignPct} onChange={e => setTraderAssignPct(e.target.value)} type="number" step="0.01" className="border border-gray-700 bg-gray-800 rounded px-3 py-2 w-32" placeholder="%" />
            <button onClick={handleAssignTrader} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Asignar</button>
          </div>
        </>)}

        {/* Vender SmartMoney */}
        {card(<>
          <div className="font-medium mb-3">Vender - SmartMoney</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={smartSellId} onChange={e => setSmartSellId(e.target.value)} className="border border-gray-700 bg-gray-800 rounded px-3 py-2 min-w-[220px]">
              <option value="">Seleccione alerta</option>
              {smartAlerts.map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input value={smartSellShares} onChange={e => setSmartSellShares(e.target.value)} type="number" step="1" className="border border-gray-700 bg-gray-800 rounded px-3 py-2 w-28" placeholder="shares" />
            <input value={smartSellPrice} onChange={e => setSmartSellPrice(e.target.value)} type="number" step="0.01" className="border border-gray-700 bg-gray-800 rounded px-3 py-2 w-28" placeholder="price" />
            <button onClick={handleSellSmart} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded">Vender</button>
          </div>
        </>)}

        {/* Vender TraderCall */}
        {card(<>
          <div className="font-medium mb-3">Vender - TraderCall</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={traderSellId} onChange={e => setTraderSellId(e.target.value)} className="border border-gray-700 bg-gray-800 rounded px-3 py-2 min-w-[220px]">
              <option value="">Seleccione alerta</option>
              {traderAlerts.map(a => (
                <option key={a.id} value={a.id}>{a.symbol} ({a.id.slice(0,6)}...)</option>
              ))}
            </select>
            <input value={traderSellShares} onChange={e => setTraderSellShares(e.target.value)} type="number" step="1" className="border border-gray-700 bg-gray-800 rounded px-3 py-2 w-28" placeholder="shares" />
            <input value={traderSellPrice} onChange={e => setTraderSellPrice(e.target.value)} type="number" step="0.01" className="border border-gray-700 bg-gray-800 rounded px-3 py-2 w-28" placeholder="price" />
            <button onClick={handleSellTrader} disabled={saving} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded">Vender</button>
          </div>
        </>)}

        {/* Distribuciones */}
        {card(<>
          <div className="font-medium mb-3">Distribuciones</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-700 text-gray-400">
                  <th className="py-2 pr-4">Símbolo</th>
                  <th className="py-2 pr-4">%</th>
                  <th className="py-2 pr-4">Asignado</th>
                  <th className="py-2 pr-4">Shares</th>
                  <th className="py-2 pr-4">Entry</th>
                  <th className="py-2 pr-4">Precio</th>
                  <th className="py-2 pr-4">P&L</th>
                  <th className="py-2 pr-4">Realizado</th>
                  <th className="py-2 pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {liquidity?.distributions.map((d) => (
                  <tr key={d.alertId} className="border-b border-gray-800">
                    <td className="py-2 pr-4 font-medium">{d.symbol}</td>
                    <td className="py-2 pr-4">{d.percentage.toFixed(2)}%</td>
                    <td className="py-2 pr-4">${d.allocatedAmount.toFixed(2)}</td>
                    <td className="py-2 pr-4">{d.shares}</td>
                    <td className="py-2 pr-4">${d.entryPrice.toFixed(2)}</td>
                    <td className="py-2 pr-4">${d.currentPrice.toFixed(2)}</td>
                    <td className="py-2 pr-4">${d.profitLoss.toFixed(2)} ({d.profitLossPercentage.toFixed(2)}%)</td>
                    <td className="py-2 pr-4">${(d.realizedProfitLoss || 0).toFixed(2)}</td>
                    <td className="py-2 pr-4 space-x-2">
                      <button onClick={() => handleSell(d.alertId, String(d.shares), String(d.currentPrice))} className="text-yellow-400 hover:underline">Vender total</button>
                      <button onClick={async () => { try { await fetchJSON('/api/liquidity/remove-distribution', { method: 'POST', body: JSON.stringify({ alertId: d.alertId }) }); toast?.success('Distribución removida'); await loadData(); } catch (e: any) { toast?.error(e.message); } }} className="text-red-400 hover:underline">Remover</button>
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