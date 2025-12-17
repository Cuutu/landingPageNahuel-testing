import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { calculateReturns } from "@/lib/liquiditySnapshotService";
import { respondWithMongoCache } from "@/lib/apiMongoCache";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    await respondWithMongoCache(
      req,
      res,
      { ttlSeconds: 60, scope: 'public', cacheControl: 's-maxage=60, stale-while-revalidate=120' },
      async () => {
        await dbConnect();

        const { pool } = req.query;

        if (!pool || (pool !== "TraderCall" && pool !== "SmartMoney")) {
          return { error: "Pool inválido. Debe ser 'TraderCall' o 'SmartMoney'" };
        }

        const data = await calculateReturns(pool as "TraderCall" | "SmartMoney");

        if (!data) {
          return { error: `No se encontró liquidez para el pool ${pool}` };
        }

        return data;
      }
    );
    return;
  } catch (error) {
    console.error("Error al obtener rendimientos de liquidez:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
