import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { saveDailyLiquiditySnapshot } from "@/lib/liquiditySnapshotService";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    await dbConnect();

    const { pool } = req.body;

    if (!pool || (pool !== "TraderCall" && pool !== "SmartMoney")) {
      return res.status(400).json({ error: "Pool inválido. Debe ser 'TraderCall' o 'SmartMoney'" });
    }

    const saved = await saveDailyLiquiditySnapshot(pool);

    if (!saved) {
      return res.status(200).json({ 
        message: "Snapshot ya existe para hoy",
        saved: false 
      });
    }

    return res.status(201).json({ 
      message: "Snapshot guardado exitosamente",
      saved: true 
    });
  } catch (error) {
    console.error("Error al guardar snapshot:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
