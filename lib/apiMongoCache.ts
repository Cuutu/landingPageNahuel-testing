import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import ApiCache from '@/models/ApiCache';

const IGNORED_QUERY_KEYS = new Set(['_t', 't', 'ts', 'timestamp', 'cacheBust', 'cachebuster']);

function normalizeQuery(query: NextApiRequest['query']): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(query || {})) {
    if (IGNORED_QUERY_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

export function buildMongoCacheKey(opts: {
  path: string;
  query?: Record<string, any>;
  scope?: string;
}): { key: string; keyParts: { path: string; query: Record<string, any>; scope?: string } } {
  const keyParts = {
    path: opts.path,
    query: opts.query || {},
    scope: opts.scope,
  };
  const raw = JSON.stringify(keyParts);
  const key = crypto.createHash('sha256').update(raw).digest('hex');
  return { key, keyParts };
}

export async function respondWithMongoCache<T>(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: {
    ttlSeconds: number;
    scope?: string;
    cacheControl?: string;
  },
  compute: () => Promise<T>
): Promise<void> {
  // Solo cachear GET
  if (req.method !== 'GET') {
    const payload = await compute();
    res.status(200).json(payload as any);
    return;
  }

  await dbConnect();

  const path = (req.url || '').split('?')[0] || 'unknown';
  const query = normalizeQuery(req.query);
  const { key, keyParts } = buildMongoCacheKey({ path, query, scope: opts.scope });

  const now = new Date();
  const cached = (await ApiCache.findOne({ key, expiresAt: { $gt: now } }).lean()) as any;
  if (cached?.payload !== undefined) {
    if (opts.cacheControl) res.setHeader('Cache-Control', opts.cacheControl);
    res.status(200).json(cached.payload);
    return;
  }

  const payload = await compute();
  const expiresAt = new Date(Date.now() + opts.ttlSeconds * 1000);

  // upsert para evitar duplicados por concurrencia
  await ApiCache.updateOne(
    { key },
    {
      $set: {
        key,
        keyParts,
        payload,
        expiresAt,
      },
    },
    { upsert: true }
  );

  if (opts.cacheControl) res.setHeader('Cache-Control', opts.cacheControl);
  res.status(200).json(payload as any);
}

/**
 * ✅ Invalidar cache de liquidez para un pool específico
 * Se llama cuando se modifica liquidez (distribute, sell, remove-distribution)
 * para evitar inconsistencias en la UI
 */
export async function invalidateLiquidityCache(pool: 'TraderCall' | 'SmartMoney'): Promise<void> {
  try {
    await dbConnect();
    
    // Buscar todas las keys de cache relacionadas con liquidez de este pool
    // Las keys tienen keyParts.path que contiene '/api/liquidity/' y query.pool === pool
    const deleted = await ApiCache.deleteMany({
      'keyParts.path': { $regex: '^/api/liquidity/' },
      'keyParts.query.pool': pool,
    });
    
    console.log(`🗑️ [CACHE] Invalidado cache de liquidez para ${pool}: ${deleted.deletedCount} entradas eliminadas`);
  } catch (error) {
    console.error(`❌ [CACHE] Error invalidando cache de liquidez para ${pool}:`, error);
    // No fallar la operación principal si falla la invalidación
  }
}

