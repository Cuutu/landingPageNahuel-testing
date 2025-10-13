import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getGlobalTimezone } from '@/lib/timeConfig';
import styles from './ClassCalendar.module.css';

interface ClassEvent {
  date: Date; // Cambio: ahora es una fecha completa en lugar de solo el día
  time: string;
  title: string;
  id: string;
}

interface ClassCalendarProps {
  events?: ClassEvent[];
  onDateSelect?: (date: Date, events: ClassEvent[]) => void;
  isAdmin?: boolean;
  initialDate?: Date; // Nueva prop para fecha inicial
  selectedDate?: Date; // Nueva prop para fecha seleccionada
}

const ClassCalendar: React.FC<ClassCalendarProps> = ({ 
  events = [], 
  onDateSelect,
  isAdmin = false,
  initialDate,
  selectedDate
}) => {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());

  // Efecto para posicionar automáticamente el calendario en la fecha más temprana con eventos
  useEffect(() => {
    if (events.length > 0 && !initialDate) {
      const earliestEvent = events.reduce((earliest, current) => 
        current.date < earliest.date ? current : earliest
      );
      
      if (earliestEvent.date) {
        const earliestDate = new Date(earliestEvent.date);
        console.log('🎯 Posicionando calendario en fecha más temprana:', earliestDate);
        setCurrentDate(earliestDate);
      }
    }
  }, [events, initialDate]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayNames = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Convertir domingo (0) a 6, lunes (1) a 0, etc.
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getEventsForDate = (day: number) => {
    // Usar zona horaria configurada para comparar fechas correctamente
    const timezone = getGlobalTimezone();
    
    return events.filter(event => {
      const eventDate = new Date(event.date);
      
      // Convertir ambas fechas a la zona horaria local para comparar
      const eventLocal = new Date(eventDate.toLocaleString('en-US', { timeZone: timezone }));
      const dayLocal = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayLocalTz = new Date(dayLocal.toLocaleString('en-US', { timeZone: timezone }));
      
      return eventLocal.getDate() === dayLocalTz.getDate() && 
             eventLocal.getMonth() === dayLocalTz.getMonth() && 
             eventLocal.getFullYear() === dayLocalTz.getFullYear();
    });
  };

  const handleDateClick = (day: number) => {
    if (onDateSelect) {
      // Crear fecha en zona horaria configurada para evitar problemas de offset
      const timezone = getGlobalTimezone();
      const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      
      // Convertir a zona horaria local para mantener consistencia
      const localSelectedDate = new Date(selectedDate.toLocaleString('en-US', { timeZone: timezone }));
      
      const dayEvents = getEventsForDate(day);
      onDateSelect(localSelectedDate, dayEvents);
    }
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Espacios vacíos para los días antes del primer día del mes
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className={styles.emptyDay}></div>
      );
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = getEventsForDate(day);
      const hasEvents = dayEvents.length > 0;
      
      // Verificar si este día está seleccionado usando zona horaria correcta
      const timezone = getGlobalTimezone();
      const isSelected = selectedDate && (() => {
        const selectedLocal = new Date(selectedDate.toLocaleString('en-US', { timeZone: timezone }));
        const dayLocal = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dayLocalTz = new Date(dayLocal.toLocaleString('en-US', { timeZone: timezone }));
        
        return selectedLocal.getDate() === dayLocalTz.getDate() && 
               selectedLocal.getMonth() === dayLocalTz.getMonth() && 
               selectedLocal.getFullYear() === dayLocalTz.getFullYear();
      })();

      days.push(
        <div 
          key={day} 
          className={`${styles.calendarDay} ${hasEvents ? styles.hasEvents : ''} ${isAdmin ? styles.adminMode : ''} ${isSelected ? styles.selectedDay : ''}`}
          onClick={() => handleDateClick(day)}
        >
          <div className={styles.dayNumber}>{day}</div>
          {hasEvents && (
            <div className={styles.availabilityIndicator}>
              <span className={styles.availabilityText}>
                {dayEvents.length} disponible{dayEvents.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.calendarHeader}>
        <h3 className={styles.calendarTitle}>Calendario de clases</h3>
      </div>

      <div className={styles.calendarContent}>
        <div className={styles.monthNavigation}>
          <button 
            className={styles.navButton}
            onClick={() => navigateMonth('prev')}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={24} />
          </button>
          
          <h4 className={styles.monthTitle}>
            {monthNames[currentDate.getMonth()]}
          </h4>
          
          <button 
            className={styles.navButton}
            onClick={() => navigateMonth('next')}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className={styles.calendarGrid}>
          <div className={styles.dayHeaders}>
            {dayNames.map(day => (
              <div key={day} className={styles.dayHeader}>
                {day}
              </div>
            ))}
          </div>

          <div className={styles.daysGrid}>
            {renderCalendarDays()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassCalendar;
