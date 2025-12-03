import React, { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

export interface BookingData {
  type: 'advisory' | 'training';
  serviceType: string;
  startDate: string;
  duration: number;
  price: number;
  notes?: string;
  autoCreateMeet?: boolean;
  fastConfirmation?: boolean;
}

export interface BookingResponse {
  id: string;
  confirmationCode: string;
  googleMeetLink?: string;
  calendarEventId?: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  startDate: string;
  endDate: string;
  serviceType: string;
  price: number;
  paymentStatus: 'pending' | 'completed' | 'failed';
  paymentLink?: string;
}

export interface UseAdvancedBookingsReturn {
  createBooking: (data: BookingData) => Promise<BookingResponse | null>;
  loading: boolean;
  error: string | null;
  success: string | null;
  clearMessages: () => void;
}

const useAdvancedBookings = (): UseAdvancedBookingsReturn => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const createBooking = useCallback(async (data: BookingData): Promise<BookingResponse | null> => {
    if (!session) {
      setError('Debes iniciar sesión para realizar una reserva');
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // console.log('🚀 Iniciando proceso de reserva avanzada:', data);

      // Validar datos de entrada
      if (!data.startDate || !data.serviceType || !data.duration) {
        throw new Error('Datos de reserva incompletos');
      }

      // Preparar datos para el servidor
      const bookingPayload = {
        ...data,
        userEmail: session.user?.email,
        userName: session.user?.name,
        autoCreateMeet: data.autoCreateMeet !== false, // Por defecto true
        fastConfirmation: data.fastConfirmation !== false, // Por defecto true
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        source: 'advanced_booking_hook'
      };

      // console.log('📤 Enviando datos al servidor:', bookingPayload);

      // Llamada a la API con timeout optimizado para confirmación rápida
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos para confirmación rápida

      const response = await fetch('/api/bookings/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(bookingPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error HTTP ${response.status}`);
      }

      const result: BookingResponse = await response.json();

      // console.log('✅ Reserva creada exitosamente:', result);

      // Mostrar mensaje de éxito personalizado
      let successMessage = '¡Reserva confirmada exitosamente!';
      
      if (result.googleMeetLink) {
        successMessage += ' Se ha creado automáticamente el link de Google Meet.';
      }
      
      if (result.calendarEventId) {
        successMessage += ' Se ha agregado el evento a tu calendario.';
      }

      setSuccess(successMessage);

      // Si hay confirmación rápida, mostrar feedback inmediato
      if (data.fastConfirmation) {
        // Simular feedback táctil/visual
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]); // Patrón de vibración de confirmación
        }
        
        // Mostrar notificación del navegador si está permitido
        if (Notification.permission === 'granted') {
          new Notification('Reserva Confirmada', {
            body: `Tu cita de ${data.serviceType} ha sido confirmada`,
            icon: '/favicon.ico',
            tag: 'booking-confirmation'
          });
        }
      }

      return result;

    } catch (err) {
      console.error('❌ Error en la reserva:', err);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('La reserva está tomando más tiempo del esperado. Por favor intenta nuevamente.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Error desconocido al procesar la reserva');
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [session]);

  return {
    createBooking,
    loading,
    error,
    success,
    clearMessages
  };
};

export default useAdvancedBookings;

// Hook auxiliar para solicitar permisos de notificación
export const useNotificationPermission = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const requestPermission = useCallback(async () => {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return 'denied';
  }, []);

  React.useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  return { permission, requestPermission };
};

// Hook para manejar el estado de la reunión de Google Meet
export const useGoogleMeetStatus = (meetLink?: string) => {
  const [meetStatus, setMeetStatus] = useState<'pending' | 'ready' | 'joined' | 'ended'>('pending');
  
  React.useEffect(() => {
    if (meetLink) {
      setMeetStatus('ready');
      
      // Verificar si el usuario puede unirse 5 minutos antes
      const checkMeetingTime = () => {
        const now = new Date();
        // Lógica para verificar tiempo de reunión
        // Esto se puede expandir con integración real de Google Calendar API
      };
      
      const interval = setInterval(checkMeetingTime, 60000); // Verificar cada minuto
      return () => clearInterval(interval);
    }
  }, [meetLink]);

  const joinMeeting = useCallback(() => {
    if (meetLink) {
      window.open(meetLink, '_blank', 'noopener,noreferrer');
      setMeetStatus('joined');
    }
  }, [meetLink]);

  return { meetStatus, joinMeeting };
}; 