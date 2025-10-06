import { useState, useEffect } from 'react';

export interface PricingData {
  _id: string;
  alertas: {
    traderCall: {
      monthly: number;
      yearly: number;
      currency: string;
      description: string;
    };
    smartMoney: {
      monthly: number;
      yearly: number;
      currency: string;
      description: string;
    };
  };
  entrenamientos: {
    swingTrading: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    dayTrading: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    advanced: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
  };
  indicadores?: {
    mediasMovilesAutomaticas?: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
  };
  asesorias: {
    consultorioFinanciero: {
      price: number;
      currency: string;
      description: string;
      duration: string;
      originalPrice?: number;
      discount?: number;
    };
  };
  currency: string;
  showDiscounts: boolean;
  lastUpdated: Date;
  updatedBy: string;
}

export const usePricing = () => {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/pricing');
      
      if (!response.ok) {
        throw new Error('Error al obtener precios');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setPricing(data.data);
      } else {
        throw new Error(data.error || 'Error al obtener precios');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error fetching pricing:', err);
    } finally {
      setLoading(false);
    }
  };

  const updatePricing = async (newPricing: Partial<PricingData>) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPricing),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar precios');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setPricing(data.data);
        return { success: true, message: data.message };
      } else {
        throw new Error(data.error || 'Error al actualizar precios');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error updating pricing:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  // Función helper para formatear precios
  const formatPrice = (price: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Función helper para calcular descuentos
  const calculateDiscountedPrice = (originalPrice: number, discount: number) => {
    return originalPrice * (1 - discount / 100);
  };

  // Función helper para obtener precio con descuento si aplica
  const getFinalPrice = (price: number, originalPrice?: number, discount?: number) => {
    if (discount && originalPrice && discount > 0) {
      return calculateDiscountedPrice(originalPrice, discount);
    }
    return price;
  };

  return {
    pricing,
    loading,
    error,
    fetchPricing,
    updatePricing,
    formatPrice,
    calculateDiscountedPrice,
    getFinalPrice,
  };
}; 