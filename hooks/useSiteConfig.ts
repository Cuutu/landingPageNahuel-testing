import { useState, useEffect, useRef } from 'react';

interface SiteConfig {
  features: {
    mentoring: {
      enabled: boolean;
      updatedAt?: Date;
      updatedBy?: string;
    };
  };
  [key: string]: any;
}

// ✅ OPTIMIZADO: Cache global para evitar requests duplicados
let globalConfigCache: SiteConfig | null = null;
let globalConfigPromise: Promise<SiteConfig | null> | null = null;
const CACHE_DURATION = 60000; // 1 minuto
let lastFetchTime = 0;

export const useSiteConfig = () => {
  const [config, setConfig] = useState<SiteConfig | null>(globalConfigCache);
  const [loading, setLoading] = useState(!globalConfigCache);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchConfig = async (force = false) => {
    const now = Date.now();
    
    // Usar cache si es válido y no forzamos refresh
    if (!force && globalConfigCache && (now - lastFetchTime) < CACHE_DURATION) {
      setConfig(globalConfigCache);
      setLoading(false);
      return;
    }

    // Si ya hay un fetch en progreso, esperar
    if (globalConfigPromise && !force) {
      const result = await globalConfigPromise;
      if (mountedRef.current) {
        setConfig(result);
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      
      globalConfigPromise = fetch('/api/site-config')
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);
      
      const data = await globalConfigPromise;
      globalConfigPromise = null;
      
      if (data) {
        globalConfigCache = data;
        lastFetchTime = Date.now();
        if (mountedRef.current) {
          setConfig(data);
          setError(null);
        }
      } else {
        const defaultConfig = { features: { mentoring: { enabled: false } } };
        if (mountedRef.current) {
          setConfig(defaultConfig);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setConfig({ features: { mentoring: { enabled: false } } });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchConfig();
    return () => { mountedRef.current = false; };
  }, []);

  return {
    config,
    loading,
    error,
    refetch: () => fetchConfig(true),
    isFeatureEnabled: (featureName: string) => {
      if (!config?.features?.[featureName as keyof typeof config.features]) {
        return false;
      }
      return config.features[featureName as keyof typeof config.features].enabled;
    }
  };
};
