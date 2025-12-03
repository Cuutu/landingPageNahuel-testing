import { useState, useEffect } from 'react';
import { Session } from 'next-auth';
import { toast } from 'react-hot-toast';

interface TrainingDate {
  id: string;
  date: Date;
  time: string;
  title: string;
  isActive: boolean;
  createdBy: string;
}

export const useTrainingDates = (session: Session | null, trainingType: string) => {
  const [trainingDates, setTrainingDates] = useState<TrainingDate[]>([]);
  const [nextTrainingDate, setNextTrainingDate] = useState<TrainingDate | null>(null);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0
  });
  const [startDateText, setStartDateText] = useState('11 de octubre a las 13 hs');
  const [isAdmin, setIsAdmin] = useState(false);

  // Función para calcular el countdown basado en la fecha de inicio
  const calculateCountdown = (startDate: Date, startTime: string) => {
    const now = new Date();
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const targetDate = new Date(startDate);
    targetDate.setHours(startHours, startMinutes, 0, 0);
    
    const diff = targetDate.getTime() - now.getTime();
    
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0 };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  };

  // Función para encontrar la próxima fecha de entrenamiento
  const findNextTrainingDate = (dates: TrainingDate[]): TrainingDate | null => {
    const now = new Date();
    const futureDates = dates
      .filter(date => date.isActive && date.date > now)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return futureDates.length > 0 ? futureDates[0] : null;
  };

  // Cargar fechas de entrenamiento y verificar admin
  useEffect(() => {
    loadTrainingDates();
    
    // Verificar si el usuario es admin
    if (session?.user) {
      setIsAdmin(session.user.role === 'admin');
    }
  }, [session]);

  // Countdown timer dinámico basado en la próxima fecha de entrenamiento
  useEffect(() => {
    const updateCountdown = () => {
      if (nextTrainingDate) {
        const newCountdown = calculateCountdown(nextTrainingDate.date, nextTrainingDate.time);
        setCountdown(newCountdown);
        
        // Actualizar texto de fecha de inicio
        const formattedDate = nextTrainingDate.date.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long'
        });
        setStartDateText(`${formattedDate} a las ${nextTrainingDate.time} hs`);
      } else {
        // Fallback si no hay próxima fecha
        const defaultDate = new Date('2024-10-11T13:00:00.000Z');
        const defaultTime = '13:00';
        const newCountdown = calculateCountdown(defaultDate, defaultTime);
        setCountdown(newCountdown);
        setStartDateText('Próximamente - Fechas por confirmar');
      }
    };

    // Actualizar countdown inicial
    updateCountdown();

    // Actualizar cada minuto
    const timer = setInterval(updateCountdown, 60000);

    return () => clearInterval(timer);
  }, [nextTrainingDate]);

  // Efecto para actualizar la próxima fecha cuando pasa el tiempo
  useEffect(() => {
    const checkForNextDate = () => {
      const nextDate = findNextTrainingDate(trainingDates);
      if (nextDate !== nextTrainingDate) {
        setNextTrainingDate(nextDate);
      }
    };

    // Verificar cada hora si hay que actualizar la próxima fecha
    const timer = setInterval(checkForNextDate, 3600000); // 1 hora

    return () => clearInterval(timer);
  }, [trainingDates, nextTrainingDate]);

  // Función para cargar fechas de entrenamiento
  const loadTrainingDates = async () => {
    try {
      // console.log('📅 Cargando fechas específicas de Zero 2 Trader...');
      
      const response = await fetch('/api/training-dates/SwingTrading');
      const data = await response.json();
      
      if (data.success && data.dates) {
        const dates = data.dates.map((date: any) => ({
          ...date,
          date: new Date(date.date)
        }));
        
        // console.log('✅ Fechas cargadas:', dates.length);
        
        setTrainingDates(dates);
        const nextDate = findNextTrainingDate(dates);
        setNextTrainingDate(nextDate);
        
        // Actualizar el countdown y texto de fecha
        if (nextDate) {
          const dateOptions: Intl.DateTimeFormatOptions = { 
            day: 'numeric', 
            month: 'long' 
          };
          const formattedDate = nextDate.date.toLocaleDateString('es-ES', dateOptions);
          setStartDateText(`${formattedDate} a las ${nextDate.time} hs`);
        } else {
          setStartDateText('Próximamente - Fechas por confirmar');
        }
      } else {
        // console.log('📭 No hay fechas específicas configuradas');
        setTrainingDates([]);
        setNextTrainingDate(null);
        setStartDateText('Próximamente - Fechas por confirmar');
      }
      
    } catch (error) {
      console.error('❌ Error cargando fechas:', error);
      setTrainingDates([]);
      setNextTrainingDate(null);
      setStartDateText('Próximamente - Fechas por confirmar');
    }
  };

  // Función para que el admin agregue una nueva fecha
  const handleAddTrainingDate = async (date: Date, time: string, title: string) => {
    if (!isAdmin) return;

    const newDate: TrainingDate = {
      id: `training-${Date.now()}`,
      date,
      time,
      title,
      isActive: true,
      createdBy: session?.user?.email || 'admin'
    };

    try {
      const response = await fetch('/api/training-dates/SwingTrading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate.date,
          time: newDate.time,
          title: newDate.title
        })
      });

      if (response.ok) {
        const updatedDates = [...trainingDates, newDate];
        setTrainingDates(updatedDates);
        
        const nextDate = findNextTrainingDate(updatedDates);
        setNextTrainingDate(nextDate);
        
        toast.success('Fecha de entrenamiento agregada exitosamente');
      }
    } catch (error) {
      console.error('Error adding training date:', error);
      toast.error('Error al agregar la fecha');
    }
  };

  // Función para manejar selección de fechas en el calendario
  const handleCalendarDateSelect = (selectedDate: Date, existingEvents: any[]) => {
    if (!isAdmin) return;

    // Mostrar modal o form para agregar nueva fecha
    const time = prompt('Ingrese la hora (formato HH:MM):', '13:00');
    const title = prompt('Ingrese el título de la clase:', `Clase ${trainingDates.length + 1}`);
    
    if (time && title) {
      handleAddTrainingDate(selectedDate, time, title);
    }
  };

  return {
    trainingDates,
    nextTrainingDate,
    countdown,
    startDateText,
    isAdmin,
    handleAddTrainingDate,
    handleCalendarDateSelect
  };
}; 