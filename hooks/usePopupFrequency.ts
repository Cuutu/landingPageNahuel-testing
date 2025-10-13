import { useState, useEffect } from 'react';

interface UsePopupFrequencyOptions {
  /** Frecuencia en días para mostrar el popup (por defecto: 7 días = 1 semana) */
  frequencyDays?: number;
  /** Tiempo adicional en días si el usuario cierra manualmente (por defecto: 14 días) */
  manualCloseExtraDays?: number;
  /** Delay en milisegundos antes de mostrar el popup (por defecto: 3000ms) */
  delayMs?: number;
  /** Si el usuario está autenticado, no mostrar popup */
  isAuthenticated?: boolean;
}

interface UsePopupFrequencyReturn {
  /** Si debe mostrar el popup */
  shouldShow: boolean;
  /** Si el popup está visible */
  isVisible: boolean;
  /** Función para cerrar el popup */
  closePopup: () => void;
  /** Función para cerrar el popup con tiempo extendido */
  closePopupExtended: () => void;
}

/**
 * Hook para manejar la frecuencia de aparición de popups usando localStorage
 * 
 * @param options - Opciones de configuración
 * @returns Objeto con funciones y estados del popup
 * 
 * @example
 * ```tsx
 * const { shouldShow, isVisible, closePopup } = usePopupFrequency({
 *   frequencyDays: 7, // Mostrar cada semana
 *   isAuthenticated: !!session
 * });
 * 
 * useEffect(() => {
 *   if (shouldShow) {
 *     const timer = setTimeout(() => setIsVisible(true), 3000);
 *     return () => clearTimeout(timer);
 *   }
 * }, [shouldShow]);
 * ```
 * 
 * @note V2.0 - Sistema de códigos de descuento:
 * - Este hook está preparado para el sistema de códigos de descuento
 * - Para activarlo en V2.0, cambiar ENABLE_DISCOUNT_POPUP a true en pages/index.tsx
 * - El popup incluye suscripción a newsletter y promesas de descuentos
 * - Funcionalidad completa pendiente de desarrollo del backend de códigos
 */
export const usePopupFrequency = (options: UsePopupFrequencyOptions = {}): UsePopupFrequencyReturn => {
  const {
    frequencyDays = 7,
    manualCloseExtraDays = 14,
    delayMs = 3000,
    isAuthenticated = false
  } = options;

  const [isVisible, setIsVisible] = useState(false);

  // Función para verificar si debe mostrar el popup
  const shouldShowPopup = (): boolean => {
    if (isAuthenticated) return false; // No mostrar si está autenticado
    
    const lastPopupDate = localStorage.getItem('lastPopupDate');
    if (!lastPopupDate) return true; // Primera visita
    
    const lastDate = new Date(lastPopupDate);
    const currentDate = new Date();
    const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysDiff >= frequencyDays;
  };

  // Función para marcar que se mostró el popup
  const markPopupShown = () => {
    localStorage.setItem('lastPopupDate', new Date().toISOString());
  };

  // Función para cerrar el popup normalmente
  const closePopup = () => {
    setIsVisible(false);
  };

  // Función para cerrar el popup con tiempo extendido
  const closePopupExtended = () => {
    setIsVisible(false);
    const extendedDate = new Date();
    extendedDate.setDate(extendedDate.getDate() + manualCloseExtraDays);
    localStorage.setItem('lastPopupDate', extendedDate.toISOString());
  };

  // Mostrar popup después del delay si debe mostrarse
  useEffect(() => {
    if (shouldShowPopup()) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        markPopupShown(); // Marcar que se mostró
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, frequencyDays, delayMs]);

  return {
    shouldShow: shouldShowPopup(),
    isVisible,
    closePopup,
    closePopupExtended
  };
}; 