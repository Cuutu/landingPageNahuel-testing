import { useState, useEffect } from 'react';

interface SiteConfig {
  features: {
    mentoring: {
      enabled: boolean;
      updatedAt?: Date;
      updatedBy?: string;
    };
  };
  // Otros campos de configuración...
  [key: string]: any;
}

export const useSiteConfig = () => {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/site-config');
      
      if (!response.ok) {
        throw new Error('Error al obtener configuración del sitio');
      }
      
      const data = await response.json();
      setConfig(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching site config:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // Configuración por defecto en caso de error
      setConfig({
        features: {
          mentoring: { enabled: false }
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    loading,
    error,
    refetch: fetchConfig,
    // Helper para verificar si una feature está habilitada
    isFeatureEnabled: (featureName: string) => {
      if (!config || !config.features || !config.features[featureName as keyof typeof config.features]) {
        return false;
      }
      return config.features[featureName as keyof typeof config.features].enabled;
    }
  };
};
