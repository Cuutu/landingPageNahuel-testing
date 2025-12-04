/**
 * API para limpiar distribuciones huérfanas
 * Encuentra distribuciones de liquidez cuyas alertas ya están cerradas y las remueve
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Alert from '@/models/Alert';
import Liquidity from '@/models/Liquidity';

interface CleanupResponse {
  success: boolean;
  message?: string;
  error?: string;
  dryRun?: boolean;
  orphansFound?: number;
  orphansCleaned?: number;
  details?: Array<{
    pool: string;
    alertId: string;
    symbol: string;
    alertStatus: string;
    shares: number;
    allocatedAmount: number;
    realizedProfitLoss: number;
    action: 'removed' | 'would_remove';
  }>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CleanupResponse>
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Solo administradores pueden ejecutar esta operación' });
    }

    // GET = dry run (solo muestra lo que limpiaría)
    // POST = ejecuta la limpieza
    const dryRun = req.method === 'GET';
    const details: CleanupResponse['details'] = [];

    // Buscar todos los documentos de liquidez
    const liquidityDocs = await Liquidity.find({});
    
    for (const liquidity of liquidityDocs) {
      const distributionsToRemove: string[] = [];
      
      for (const dist of liquidity.distributions) {
        // Buscar la alerta correspondiente
        const alert = await Alert.findById(dist.alertId);
        
        // Si la alerta no existe o está cerrada, marcar para limpiar
        if (!alert || alert.status === 'CLOSED') {
          distributionsToRemove.push(dist.alertId);
          
          details.push({
            pool: liquidity.pool,
            alertId: dist.alertId,
            symbol: dist.symbol,
            alertStatus: alert?.status || 'NOT_FOUND',
            shares: dist.shares,
            allocatedAmount: dist.allocatedAmount,
            realizedProfitLoss: dist.realizedProfitLoss || 0,
            action: dryRun ? 'would_remove' : 'removed'
          });
        }
      }
      
      // Si no es dry run, ejecutar la limpieza
      if (!dryRun && distributionsToRemove.length > 0) {
        for (const alertId of distributionsToRemove) {
          const dist = liquidity.distributions.find((d: any) => d.alertId === alertId);
          
          if (dist) {
            // Si tiene shares > 0, primero vender todo al precio actual
            if (dist.shares > 0) {
              try {
                // Obtener precio actual de la alerta si existe
                const alert = await Alert.findById(alertId);
                const sellPrice = alert?.currentPrice || alert?.exitPrice || dist.currentPrice || dist.entryPrice;
                
                liquidity.sellShares(alertId, dist.shares, sellPrice);
                console.log(`💰 Vendidas ${dist.shares} acciones huérfanas de ${dist.symbol} a $${sellPrice}`);
              } catch (sellError) {
                console.error(`Error vendiendo shares huérfanas de ${dist.symbol}:`, sellError);
              }
            }
            
            // Remover la distribución
            try {
              liquidity.removeDistribution(alertId);
              console.log(`🗑️ Distribución huérfana removida: ${dist.symbol} (${alertId})`);
            } catch (removeError) {
              console.error(`Error removiendo distribución de ${dist.symbol}:`, removeError);
            }
          }
        }
        
        // Guardar cambios
        await liquidity.save();
        console.log(`✅ Liquidez ${liquidity.pool} actualizada - ${distributionsToRemove.length} distribuciones huérfanas limpiadas`);
      }
    }

    const orphansFound = details.length;

    return res.status(200).json({
      success: true,
      dryRun,
      orphansFound,
      orphansCleaned: dryRun ? 0 : orphansFound,
      message: dryRun 
        ? `Se encontraron ${orphansFound} distribuciones huérfanas. Usa POST para limpiarlas.`
        : `Se limpiaron ${orphansFound} distribuciones huérfanas.`,
      details
    });

  } catch (error) {
    console.error('Error en cleanup-orphans:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error interno del servidor' 
    });
  }
}
