import { useState, useEffect, useCallback } from 'react';

interface RoadmapModule {
  id: number;
  titulo: string;
  descripcion: string;
  duracion: string;
  lecciones: number;
  temas: Array<{
    titulo: string;
    descripcion?: string;
  }>;
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  prerequisito?: number;
  orden: number;
  activo: boolean;
}

export const useSwingTradingData = () => {
  const [roadmapModules, setRoadmapModules] = useState<RoadmapModule[]>([]);
  const [loadingRoadmap, setLoadingRoadmap] = useState(true);
  const [roadmapError, setRoadmapError] = useState<string>('');

  const fetchRoadmaps = useCallback(async () => {
    try {
      setLoadingRoadmap(true);
      setRoadmapError('');
      
      const response = await fetch('/api/roadmaps/tipo/SwingTrading');
      const data = await response.json();
      
      if (data.success && data.data.roadmaps.length > 0) {
        // Tomar el primer roadmap activo
        const activeRoadmap = data.data.roadmaps.find((r: any) => r.activo) || data.data.roadmaps[0];
        
        if (activeRoadmap) {
          // Cargar módulos independientes del roadmap
          const modulesResponse = await fetch(`/api/modules/roadmap/${activeRoadmap._id}`);
          const modulesData = await modulesResponse.json();
          
          if (modulesData.success && modulesData.data.modules.length > 0) {
            // Transformar módulos para ser compatibles con TrainingRoadmap
            const transformedModules = modulesData.data.modules.map((module: any) => ({
              id: module._id,
              titulo: module.nombre,
              descripcion: module.descripcion,
              duracion: module.duracion,
              lecciones: module.lecciones,
              temas: module.temas,
              dificultad: module.dificultad,
              prerequisito: module.prerequisito?._id,
              orden: module.orden,
              activo: module.activo
            }));
            
            setRoadmapModules(transformedModules);
          } else {
            setRoadmapError('Este roadmap aún no tiene módulos creados. Contacta al administrador.');
          }
        } else {
          setRoadmapError('No se encontró un roadmap activo para Zero 2 Trader');
        }
      } else {
          setRoadmapError('No se encontraron roadmaps para Zero 2 Trader');
      }
    } catch (error) {
      console.error('Error al cargar roadmaps:', error);
      setRoadmapError('Error al cargar el roadmap de aprendizaje');
    } finally {
      setLoadingRoadmap(false);
    }
  }, []);

  useEffect(() => {
    fetchRoadmaps();
  }, [fetchRoadmaps]);

  return {
    roadmapModules,
    loadingRoadmap,
    roadmapError,
    fetchRoadmaps
  };
}; 