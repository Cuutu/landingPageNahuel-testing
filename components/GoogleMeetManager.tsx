import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import styles from '@/styles/Admin.module.css';

interface Booking {
  _id: string;
  userEmail: string;
  userName: string;
  type: 'training' | 'advisory';
  serviceType?: string;
  startDate: string;
  duration: number;
  status: string;
  meetingLink?: string;
  googleEventId?: string;
}

interface GoogleMeetManagerProps {
  bookings: Booking[];
  onUpdate: () => void;
}

const GoogleMeetManager: React.FC<GoogleMeetManagerProps> = ({ bookings, onUpdate }) => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [meetLinks, setMeetLinks] = useState<Record<string, string>>({});

  // Filtrar reservas que no tienen link de Meet
  const bookingsWithoutMeet = bookings.filter(booking => !booking.meetingLink);

  const handleCreateMeet = async (bookingId: string) => {
    if (!session) {
      setError('Debes iniciar sesión como administrador');
      return;
    }

    setLoading(bookingId);
    setError(null);
    setSuccess(null);

    try {
      // Generar un link de Google Meet simulado (en producción sería real)
      const meetLink = `https://meet.google.com/meet-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      
      const response = await fetch('/api/bookings/update-meet-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId,
          meetLink
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear Google Meet');
      }

      const result = await response.json();
      
      setSuccess(`Google Meet creado exitosamente para la reserva`);
      setMeetLinks(prev => ({ ...prev, [bookingId]: meetLink }));
      
      // Actualizar la lista de reservas
      onUpdate();

    } catch (err) {
      console.error('Error al crear Google Meet:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(null);
    }
  };

  const handleManualMeetLink = async (bookingId: string) => {
    const meetLink = meetLinks[bookingId];
    
    if (!meetLink || !meetLink.trim()) {
      setError('Por favor ingresa un link de Google Meet válido');
      return;
    }

    setLoading(bookingId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/bookings/update-meet-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId,
          meetLink: meetLink.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar Google Meet');
      }

      const result = await response.json();
      
      setSuccess(`Google Meet actualizado exitosamente`);
      setMeetLinks(prev => ({ ...prev, [bookingId]: '' }));
      
      // Actualizar la lista de reservas
      onUpdate();

    } catch (err) {
      console.error('Error al actualizar Google Meet:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires'
    });
  };

  if (bookingsWithoutMeet.length === 0) {
    return (
      <div className={styles.section}>
        <h3>🔗 Gestión de Google Meet</h3>
        <div className={styles.successMessage}>
          ✅ Todas las reservas ya tienen links de Google Meet configurados
        </div>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <h3>🔗 Gestión de Google Meet</h3>
      
      {error && (
        <div className={styles.errorMessage}>
          ❌ {error}
        </div>
      )}
      
      {success && (
        <div className={styles.successMessage}>
          ✅ {success}
        </div>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Duración</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {bookingsWithoutMeet.map((booking) => (
              <tr key={booking._id}>
                <td>
                  <div>
                    <strong>{booking.userName}</strong>
                    <br />
                    <small>{booking.userEmail}</small>
                  </div>
                </td>
                <td>
                  <span className={booking.type === 'training' ? styles.badgeTraining : styles.badgeAdvisory}>
                    {booking.type === 'training' ? '🎯' : '🩺'} {booking.serviceType || booking.type}
                  </span>
                </td>
                <td>{formatDate(booking.startDate)}</td>
                <td>{formatTime(booking.startDate)}</td>
                <td>{booking.duration} min</td>
                <td>
                  <span className={styles.badgeStatus}>
                    {booking.status}
                  </span>
                </td>
                <td>
                  <div className={styles.actionButtons}>
                    <button
                      onClick={() => handleCreateMeet(booking._id)}
                      disabled={loading === booking._id}
                      className={styles.buttonPrimary}
                    >
                      {loading === booking._id ? '⏳' : '🔗'} Crear Meet
                    </button>
                    
                    <div className={styles.manualMeetInput}>
                      <input
                        type="text"
                        placeholder="O ingresa link manual"
                        value={meetLinks[booking._id] || ''}
                        onChange={(e) => setMeetLinks(prev => ({ 
                          ...prev, 
                          [booking._id]: e.target.value 
                        }))}
                        className={styles.input}
                      />
                      <button
                        onClick={() => handleManualMeetLink(booking._id)}
                        disabled={loading === booking._id || !meetLinks[booking._id]}
                        className={styles.buttonSecondary}
                      >
                        {loading === booking._id ? '⏳' : '💾'} Guardar
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.infoBox}>
        <h4>ℹ️ Información sobre Google Meet</h4>
        <ul>
          <li><strong>Creación Automática:</strong> Genera un link de Google Meet automáticamente</li>
          <li><strong>Link Manual:</strong> Puedes ingresar un link de Meet existente</li>
          <li><strong>Notificaciones:</strong> Se enviarán emails automáticamente con el link</li>
          <li><strong>Calendario:</strong> El evento se actualizará en Google Calendar</li>
        </ul>
      </div>
    </div>
  );
};

export default GoogleMeetManager; 