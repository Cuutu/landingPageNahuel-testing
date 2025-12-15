import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

interface PendingOperation {
  _id: string;
  ticker: string;
  priceRange: { min: number; max: number } | null;
  isPriceConfirmed: boolean;
  currentPrice: number;
  alert: {
    _id: string;
    symbol: string;
    status: string;
    currentPrice: number;
    finalPrice: number;
    entryPriceRange?: { min: number; max: number };
  } | null;
  priceInRange: boolean | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

interface DebugData {
  stats: {
    totalPendingWithRange: number;
    totalWithRange: number;
    totalUnconfirmed: number;
    totalAlertsWithRange: number;
    pendingByStatus: {
      withRange: number;
      withoutRange: number;
    };
    confirmedVsPending: {
      confirmed: number;
      pending: number;
    };
  };
  data: {
    pendingOperations: PendingOperation[];
    allOperationsWithRange: any[];
    alertsWithOperations: any[];
    sampleUnconfirmed: any[];
  };
}

export default function DebugOperations() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    fetchDebugData();
  }, [status, router]);

  const fetchDebugData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/debug-pending-operations');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener datos');
      }

      setDebugData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Cargando...</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-red-500">Error</h1>
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchDebugData}
            className="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!debugData) {
    return null;
  }

  const { stats, data } = debugData;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Debug: Operaciones Pendientes</h1>
          <button
            onClick={fetchDebugData}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            🔄 Actualizar
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">Operaciones Pendientes</h3>
            <p className="text-3xl font-bold text-yellow-400">{stats.totalPendingWithRange}</p>
            <p className="text-sm text-gray-400">Con priceRange sin confirmar</p>
          </div>
          <div className="bg-gray-800 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">Total con Range</h3>
            <p className="text-3xl font-bold">{stats.totalWithRange}</p>
            <p className="text-sm text-gray-400">
              Confirmadas: {stats.confirmedVsPending.confirmed} | 
              Pendientes: {stats.confirmedVsPending.pending}
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">Alertas con Range</h3>
            <p className="text-3xl font-bold">{stats.totalAlertsWithRange}</p>
            <p className="text-sm text-gray-400">Alertas activas con rangos</p>
          </div>
        </div>

        {/* Operaciones Pendientes */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Operaciones Pendientes con priceRange ({data.pendingOperations.length})
          </h2>
          
          {data.pendingOperations.length === 0 ? (
            <div className="bg-green-800 p-4 rounded">
              <p className="text-green-200">✅ No hay operaciones pendientes con priceRange</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full bg-gray-800 rounded">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="p-3 text-left">Ticker</th>
                    <th className="p-3 text-left">Price Range</th>
                    <th className="p-3 text-left">Precio Actual</th>
                    <th className="p-3 text-left">Alerta</th>
                    <th className="p-3 text-left">Precio en Rango</th>
                    <th className="p-3 text-left">Estado</th>
                    <th className="p-3 text-left">Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingOperations.map((op) => (
                    <tr key={op._id} className="border-b border-gray-700 hover:bg-gray-700">
                      <td className="p-3 font-mono">{op.ticker}</td>
                      <td className="p-3">
                        {op.priceRange ? (
                          <span className="font-mono">
                            ${op.priceRange.min.toFixed(2)} - ${op.priceRange.max.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-500">Sin rango</span>
                        )}
                      </td>
                      <td className="p-3">
                        {op.alert ? (
                          <span className="font-mono">
                            ${(op.alert.finalPrice || op.alert.currentPrice || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        {op.alert ? (
                          <div>
                            <div className="font-semibold">{op.alert.symbol}</div>
                            <div className="text-sm text-gray-400">{op.alert.status}</div>
                          </div>
                        ) : (
                          <span className="text-red-400">⚠️ Sin alerta</span>
                        )}
                      </td>
                      <td className="p-3">
                        {op.priceInRange === true ? (
                          <span className="text-green-400">✅ Sí</span>
                        ) : op.priceInRange === false ? (
                          <span className="text-red-400">❌ No</span>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-yellow-600 rounded text-sm">
                          Pendiente
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-400">
                        {new Date(op.createdAt).toLocaleDateString('es-ES')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alertas con Rangos y sus Operaciones */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Alertas con Rangos y sus Operaciones ({data.alertsWithOperations.length})
          </h2>
          
          {data.alertsWithOperations.map((item) => (
            <div key={item.alert._id} className="bg-gray-800 p-4 rounded mb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-semibold">{item.alert.symbol}</h3>
                  <p className="text-sm text-gray-400">Status: {item.alert.status}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    Precio Actual: <span className="font-mono">${item.alert.currentPrice?.toFixed(2) || 'N/A'}</span>
                  </p>
                  <p className="text-sm">
                    Precio Final: <span className="font-mono">${item.alert.finalPrice?.toFixed(2) || 'N/A'}</span>
                  </p>
                </div>
              </div>
              
              {item.alert.entryPriceRange && (
                <p className="text-sm mb-2">
                  Rango: <span className="font-mono">
                    ${item.alert.entryPriceRange.min} - ${item.alert.entryPriceRange.max}
                  </span>
                </p>
              )}
              
              {item.operations.length > 0 ? (
                <div className="mt-3">
                  <p className="text-sm font-semibold mb-2">Operaciones asociadas:</p>
                  <ul className="space-y-1">
                    {item.operations.map((op: any, idx: number) => (
                      <li key={idx} className="text-sm bg-gray-700 p-2 rounded">
                        {op.ticker} - 
                        {op.hasPriceRange ? (
                          <span className="ml-2">
                            Range: ${op.priceRange.min} - ${op.priceRange.max} | 
                            Confirmada: {op.isPriceConfirmed ? '✅' : '❌'}
                          </span>
                        ) : (
                          <span className="ml-2 text-gray-400">Sin range</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-yellow-400 mt-2">⚠️ No tiene operaciones asociadas</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

