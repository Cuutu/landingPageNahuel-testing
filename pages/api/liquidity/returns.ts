import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { calculateReturns } from "@/lib/liquiditySnapshotService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    await dbConnect();

    const { pool } = req.query;

    if (!pool || (pool !== "TraderCall" && pool !== "SmartMoney")) {
      return res.status(400).json({ error: "Pool inválido. Debe ser 'TraderCall' o 'SmartMoney'" });
    }

    const data = await calculateReturns(pool as "TraderCall" | "SmartMoney");

    if (!data) {
      return res.status(404).json({ error: `No se encontró liquidez para el pool ${pool}` });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Error al obtener rendimientos de liquidez:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
