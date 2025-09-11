import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import Roadmap, { type RoadmapDocument } from '../../../../models/Roadmap';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();

    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ 
        success: false, 
        error: `Método ${req.method} no permitido` 
      });
    }

    const { tipo } = req.query;

    // Validar tipo de entrenamiento
    const tiposValidos = ['SwingTrading', 'DayTrading'];
    if (!tipo || !tiposValidos.includes(tipo as string)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de entrenamiento inválido. Debe ser: SwingTrading, DayTrading'
      });
    }

    // Obtener roadmaps activos del tipo especificado
    const roadmaps = await Roadmap.find({
      tipoEntrenamiento: tipo,
      activo: true
    })
    .sort({ orden: 1 }) as RoadmapDocument[];

    // Si no hay roadmaps, devolver array vacío
    if (!roadmaps || roadmaps.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          roadmaps: [],
          tipo,
          mensaje: `No hay roadmaps disponibles para ${tipo}`
        }
      });
    }

    // Calcular estadísticas del tipo
    const estadisticas = {
      totalRoadmaps: roadmaps.length,
      totalModulos: roadmaps.reduce((acc, roadmap) => acc + roadmap.modulos.length, 0),
      totalLecciones: roadmaps.reduce((acc, roadmap) => acc + roadmap.metadatos.totalLecciones, 0),
      totalHoras: roadmaps.reduce((acc, roadmap) => acc + roadmap.metadatos.totalHoras, 0),
      dificultadPromedio: calcularDificultadPromedio(roadmaps)
    };

    return res.status(200).json({
      success: true,
      data: {
        roadmaps,
        tipo,
        estadisticas
      }
    });

  } catch (error) {
    console.error('Error obteniendo roadmaps por tipo:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error al obtener roadmaps' 
    });
  }
}

/**
 * Calcula la dificultad promedio de los roadmaps
 */
function calcularDificultadPromedio(roadmaps: RoadmapDocument[]): string {
  if (!roadmaps.length) return 'N/A';

  const dificultades = roadmaps.flatMap(roadmap => 
    roadmap.modulos.map(modulo => modulo.dificultad)
  );

  const contadores = {
    'Básico': 0,
    'Intermedio': 0,
    'Avanzado': 0
  };

  dificultades.forEach(dificultad => {
    contadores[dificultad]++;
  });

  const total = dificultades.length;
  const porcentajes = {
    basico: Math.round((contadores['Básico'] / total) * 100),
    intermedio: Math.round((contadores['Intermedio'] / total) * 100),
    avanzado: Math.round((contadores['Avanzado'] / total) * 100)
  };

  // Determinar dificultad predominante
  if (porcentajes.basico >= 50) return 'Básico';
  if (porcentajes.avanzado >= 40) return 'Avanzado';
  return 'Intermedio';
} 