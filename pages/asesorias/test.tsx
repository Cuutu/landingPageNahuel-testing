import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DateTimePicker from '@/components/DateTimePicker';
import { useBookings } from '@/hooks/useBookings';
import { usePricing } from '@/hooks/usePricing';
import styles from '@/styles/AsesoriasTest.module.css';

// Genera todos los slots posibles de asesoría (cada 30 minutos de 8:00 a 22:00)
const asesoriasSlots: string[] = Array.from({ length: (22 - 8) * 2 + 1 }, (_, i) => {
  const hour = 8 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

type TrainingSchedule = {
  dayOfWeek: number;
  hour: number;
  minute: number;
  duration: number;
  type?: string;
  activo: boolean;
};

function getFreeAdvisorySlots(
  entrenamientos: TrainingSchedule[],
  selectedDate: Date | null,
  asesoriasSlots: string[]
): string[] {
  if (!selectedDate) return asesoriasSlots;
  const dayOfWeek = selectedDate.getDay();
  const entrenamientosHoy = entrenamientos.filter((e) => e.dayOfWeek === dayOfWeek);
  return asesoriasSlots.filter((slot) => {
    const [slotHour, slotMinute] = slot.split(':').map(Number);
    return !entrenamientosHoy.some((e) => {
      const entrenamientoStart = e.hour * 60 + e.minute;
      const entrenamientoEnd = entrenamientoStart + e.duration;
      const slotTime = slotHour * 60 + slotMinute;
      return slotTime >= entrenamientoStart && slotTime < entrenamientoEnd;
    });
  });
}

const AsesoriasTestPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const { createBooking, getAvailableSlots, loading } = useBookings();
  const { pricing, loading: pricingLoading } = usePricing();
  
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Actualizar horarios disponibles cuando cambia la fecha
  const handleDateTimeSelect = (date: Date) => {
    setSelectedDateTime(date);
    setSelectedDate(date);
  };

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    } else {
      setAvailableTimes([]);
    }
  }, [selectedDate]);

  const loadAvailableSlots = async () => {
    if (!selectedDate) return;

    try {
      setLoadingSlots(true);
      const dateStr = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const slotsData = await getAvailableSlots(dateStr, 'advisory', 60);
      
      if (slotsData) {
        setAvailableTimes(slotsData.availableSlots);
        if (slotsData.availableSlots.length === 0) {
          toast.error('No hay horarios disponibles para asesoría en la fecha seleccionada');
        }
      } else {
        setAvailableTimes([]);
      }
    } catch (error) {
      // console.error('Error al cargar horarios:', error);
      toast.error('Error al cargar horarios disponibles');
      setAvailableTimes([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleReservar = async () => {
    if (!session) {
      toast.error('Debes iniciar sesión para reservar una asesoría');
      return;
    }

    if (!selectedDateTime) {
      toast.error('Por favor selecciona una fecha y hora');
      return;
    }

    try {
      const booking = await createBooking({
        type: 'advisory',
        serviceType: 'ConsultorioFinanciero',
        startDate: selectedDateTime.toISOString(),
        duration: 60,
                  price: pricing?.asesorias.consultorioFinanciero.price || 50000,
        notes: 'Asesoría de Trading - Consultorio Financiero'
      });

      if (booking) {
        console.log('✅ Reserva creada:', booking);
        // Redirigir a una página de confirmación o dashboard
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Error al reservar:', error);
      // El error ya se maneja en el hook useBookings
    }
  };

  return (
    <>
      <Head>
        <title>Reservar Asesoría - Consultorio Financiero</title>
        <meta name="description" content="Reserva una asesoría de trading personalizada" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.container}
        >
          <h1 className={styles.title}>Reservar Asesoría</h1>
          
          <div className={styles.content}>
            <div className={styles.info}>
              <h2>Consultorio Financiero</h2>
              <p>
                Sesión personalizada de 1 hora para analizar tu estrategia de trading
                y recibir recomendaciones personalizadas de nuestros expertos.
              </p>
              <ul className={styles.features}>
                <li>Análisis completo de tu estrategia actual</li>
                <li>Recomendaciones personalizadas según tu perfil</li>
                <li>Resolución de dudas específicas</li>
                <li>Plan de acción detallado para mejorar</li>
                <li>Seguimiento por email durante 30 días</li>
                <li>Grabación de la sesión para tu referencia</li>
              </ul>
              <div className={styles.priceInfo}>
                        <span className={styles.price}>
          {pricingLoading ? 'Cargando...' : pricing ? `${pricing.currency === 'ARS' ? '$' : '$'}${pricing.asesorias.consultorioFinanciero.price} ${pricing.currency}` : '$50000 ARS'}
        </span>
                <span className={styles.duration}>60 minutos</span>
              </div>
            </div>

            <div className={styles.booking}>
              <h3>Selecciona fecha y hora</h3>
              
              {loadingSlots && (
                <div className={styles.loadingMessage}>
                  Cargando horarios disponibles...
                </div>
              )}
              
              <DateTimePicker
                onDateTimeSelect={handleDateTimeSelect}
                minDate={new Date()}
                maxDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)} // 30 días
                duration={60}
                availableTimes={availableTimes}
              />
              
              {selectedDate && availableTimes.length === 0 && !loadingSlots && (
                <div className={styles.noSlotsMessage}>
                  No hay horarios disponibles para asesoría en la fecha seleccionada. 
                  Por favor, elige otro día.
                </div>
              )}
              
              <button
                onClick={handleReservar}
                disabled={loading || loadingSlots || !selectedDateTime || availableTimes.length === 0}
                className={styles.button}
              >
                {loading ? 'Reservando...' : `Reservar Asesoría - ${pricingLoading ? 'Cargando...' : pricing ? `${pricing.currency === 'ARS' ? '$' : '$'}${pricing.asesorias.consultorioFinanciero.price} ${pricing.currency}` : '$50000 ARS'}`}
              </button>
              
              <div className={styles.bookingNote}>
                <small>
                  * Al confirmar la reserva recibirás un email de confirmación con todos los detalles.
                  El evento se agregará automáticamente al calendario del administrador.
                </small>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </>
  );
};

export default AsesoriasTestPage; 