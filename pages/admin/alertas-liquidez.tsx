import React, { useEffect, useMemo, useState } from 'react';
import AdminRouteGuard from '@/components/AdminRouteGuard';

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
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Error de red');
  return data as T;
}

const AdminLiquidityPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liquidity, setLiquidity] = useState<LiquidityData | null>(null);
  const [newTotal, setNewTotal] = useState<string>('');
  const [assignAlertId, setAssignAlertId] = useState('');
  const [assignPct, setAssignPct] = useState('');
  const [sellAlertId, setSellAlertId] = useState('');
  const [sellShares, setSellShares] = useState('');
  const [sellPrice, setSellPrice] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchJSON<{ success: boolean; liquidity: LiquidityData }>(
        '/api/liquidity'
      );
      setLiquidity(resp.liquidity);
      setNewTotal(String(resp.liquidity.totalLiquidity || ''));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleUpdateTotal = async () => {
    try {
      setSaving(true);
      setError(null);
      const totalLiquidity = Number(newTotal);
      const resp = await fetchJSON<{ success: boolean; liquidity: LiquidityData; message: string }>(
        '/api/liquidity',
        { method: 'POST', body: JSON.stringify({ totalLiquidity }) }
      );
      setLiquidity(resp.liquidity);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    try {
      setSaving(true);
      setError(null);
      const resp = await fetchJSON<{ success: boolean; distribution: any; message: string }>(
        '/api/liquidity/distribute',
        { method: 'POST', body: JSON.stringify({ alertId: assignAlertId.trim(), percentage: Number(assignPct) }) }
      );
      await loadData();
      setAssignAlertId('');
      setAssignPct('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSell = async () => {
    try {
      setSaving(true);
      setError(null);
      const resp = await fetchJSON<{ success: boolean; result: any; message: string }>(
        '/api/liquidity/sell',
        { method: 'POST', body: JSON.stringify({ alertId: sellAlertId.trim(), shares: Number(sellShares), price: Number(sellPrice) }) }
      );
      await loadData();
      setSellAlertId('');
      setSellShares('');
      setSellPrice('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (alertId: string) => {
    try {
      setSaving(true);
      setError(null);
      await fetchJSON<{ success: boolean; message: string }>(
        '/api/liquidity/remove-distribution',
        { method: 'POST', body: JSON.stringify({ alertId }) }
      );
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const totalAssignedPct = useMemo(() => {
    if (!liquidity) return 0;
    return liquidity.distributions.reduce((sum, d) => sum + (d.percentage || 0), 0);
  }, [liquidity]);

  if (loading) {
    return (
      <AdminRouteGuard>
        <div className="p-6">Cargando...</div>
      </AdminRouteGuard>
    );
  }

  if (error) {
    return (
      <AdminRouteGuard>
        <div className="p-6 text-red-500">{error}</div>
      </AdminRouteGuard>
    );
  }

  return (
    <AdminRouteGuard>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Liquidez</h1>

        {/* Resumen */}
        {liquidity && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Liquidez Total</div>
              <div className="text-xl font-semibold">${liquidity.totalLiquidity.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Disponible</div>
              <div className="text-xl font-semibold">${liquidity.availableLiquidity.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">Distribuida</div>
              <div className="text-xl font-semibold">${liquidity.distributedLiquidity.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">P&L Total</div>
              <div className="text-xl font-semibold">${liquidity.totalProfitLoss.toFixed(2)} ({liquidity.totalProfitLossPercentage.toFixed(2)}%)</div>
            </div>
          </div>
        )}

        {/* Actualizar total */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-medium">Actualizar Liquidez Total</div>
          <div className="flex gap-2">
            <input value={newTotal} onChange={e => setNewTotal(e.target.value)} type="number" step="0.01" className="border rounded px-3 py-2 w-48" placeholder="Total USD" />
            <button onClick={handleUpdateTotal} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">Guardar</button>
          </div>
        </div>

        {/* Asignar distribución */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-medium">Asignar a Alerta Activa</div>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={assignAlertId} onChange={e => setAssignAlertId(e.target.value)} className="border rounded px-3 py-2" placeholder="alertId" />
            <input value={assignPct} onChange={e => setAssignPct(e.target.value)} type="number" step="0.01" className="border rounded px-3 py-2 w-32" placeholder="%" />
            <button onClick={handleAssign} disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded">Asignar</button>
          </div>
          <div className="text-sm text-gray-500">% asignado total: {totalAssignedPct.toFixed(2)}%</div>
        </div>

        {/* Vender */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-medium">Vender (parcial o total)</div>
          <div className="flex flex-wrap gap-2 items-center">
            <input value={sellAlertId} onChange={e => setSellAlertId(e.target.value)} className="border rounded px-3 py-2" placeholder="alertId" />
            <input value={sellShares} onChange={e => setSellShares(e.target.value)} type="number" step="1" className="border rounded px-3 py-2 w-32" placeholder="shares" />
            <input value={sellPrice} onChange={e => setSellPrice(e.target.value)} type="number" step="0.01" className="border rounded px-3 py-2 w-32" placeholder="price" />
            <button onClick={handleSell} disabled={saving} className="bg-yellow-600 text-white px-4 py-2 rounded">Vender</button>
          </div>
        </div>

        {/* Distribuciones */}
        <div className="rounded-lg border p-4 space-y-4">
          <div className="font-medium">Distribuciones</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
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
                  <tr key={d.alertId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{d.symbol}</td>
                    <td className="py-2 pr-4">{d.percentage.toFixed(2)}%</td>
                    <td className="py-2 pr-4">${d.allocatedAmount.toFixed(2)}</td>
                    <td className="py-2 pr-4">{d.shares}</td>
                    <td className="py-2 pr-4">${d.entryPrice.toFixed(2)}</td>
                    <td className="py-2 pr-4">${d.currentPrice.toFixed(2)}</td>
                    <td className="py-2 pr-4">${d.profitLoss.toFixed(2)} ({d.profitLossPercentage.toFixed(2)}%)</td>
                    <td className="py-2 pr-4">${(d.realizedProfitLoss || 0).toFixed(2)}</td>
                    <td className="py-2 pr-4">
                      <button onClick={() => handleRemove(d.alertId)} className="text-red-600 hover:underline">Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default AdminLiquidityPage; 