import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Configuración del cliente OAuth2 para el admin
const adminOAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

interface CalendarEvent {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
  }>;
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: {
        type: string;
      };
    };
  };
}

interface GoogleMeetData {
  success: boolean;
  meetLink?: string;
  eventId?: string;
  error?: string;
  details?: {
    status?: number;
    code?: string;
    errors?: any;
  };
}

/**
 * Obtiene el cliente de Calendar configurado con tokens de administrador
 * @returns Cliente de Calendar configurado para el admin
 */
async function getAdminCalendarClient() {
  try {
    console.log('🔑 Configurando cliente de Google Calendar...');
    console.log('📊 Tokens disponibles:', {
      hasAccessToken: !!process.env.ADMIN_GOOGLE_ACCESS_TOKEN,
      hasRefreshToken: !!process.env.ADMIN_GOOGLE_REFRESH_TOKEN,
      accessTokenLength: process.env.ADMIN_GOOGLE_ACCESS_TOKEN?.length || 0,
      refreshTokenLength: process.env.ADMIN_GOOGLE_REFRESH_TOKEN?.length || 0
    });

    // Configurar tokens del admin
    adminOAuth2Client.setCredentials({
      access_token: process.env.ADMIN_GOOGLE_ACCESS_TOKEN,
      refresh_token: process.env.ADMIN_GOOGLE_REFRESH_TOKEN,
    });

    // Intentar refrescar el token si es necesario
    try {
      console.log('🔄 Verificando y refrescando tokens si es necesario...');
      await adminOAuth2Client.getAccessToken();
      console.log('✅ Tokens verificados y actualizados');
    } catch (tokenError) {
      console.error('⚠️ Error al refrescar tokens:', tokenError);
      // Continuar con los tokens existentes
    }

    console.log('✅ Tokens configurados correctamente');
    return google.calendar({ version: 'v3', auth: adminOAuth2Client });
  } catch (error) {
    console.error('❌ Error al obtener cliente de Calendar del admin:', error);
    throw error;
  }
}

/**
 * Obtiene el ID de calendario correcto, probando primero el configurado y luego 'primary'
 */
async function getCorrectCalendarId(calendar: any): Promise<string> {
  const configuredId = process.env.GOOGLE_CALENDAR_ID;
  
  // Si no hay ID configurado, usar primary directamente
  if (!configuredId || configuredId === 'primary') {
    console.log('🎯 Usando calendario principal (primary)');
    return 'primary';
  }
  
  // Probar acceso al calendario configurado
  try {
    console.log(`🧪 Probando acceso al calendario: ${configuredId}`);
    await calendar.calendars.get({ calendarId: configuredId });
    console.log(`✅ Calendario ${configuredId} accesible`);
    return configuredId;
  } catch (error: any) {
    console.log(`⚠️ No se puede acceder a ${configuredId}:`, error.message);
    console.log('🔄 Fallback a calendario principal (primary)');
    return 'primary';
  }
}

/**
 * Crea automáticamente un Google Meet para un evento
 */
async function createGoogleMeetForEvent(
  calendar: any,
  eventData: any,
  calendarId: string
): Promise<GoogleMeetData> {
  try {
    console.log('🔗 Creando Google Meet automáticamente...');
    console.log('📅 Calendar ID:', calendarId);
    console.log('📋 Datos del evento a crear:', {
      summary: eventData.summary,
      start: eventData.start,
      end: eventData.end,
      attendees: eventData.attendees
    });
    
    // Agregar configuración de conferencia al evento
    const eventWithMeet = {
      ...eventData,
      conferenceData: {
        createRequest: {
          requestId: `meet_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    console.log('📤 Enviando evento con Google Meet a Calendar API...');
    console.log('🔧 Configuración de conferencia:', eventWithMeet.conferenceData);
    
    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: eventWithMeet,
      conferenceDataVersion: 1 // Habilitar conferencias
    });

    console.log('✅ Respuesta de Calendar API recibida:', {
      eventId: response.data.id,
      status: response.data.status,
      hasConferenceData: !!response.data.conferenceData,
      conferenceData: response.data.conferenceData
    });

    const meetLink = response.data.conferenceData?.entryPoints?.[0]?.uri;
    
    if (meetLink) {
      console.log('✅ Google Meet creado exitosamente:', meetLink);
      return {
        success: true,
        meetLink,
        eventId: response.data.id
      };
    } else {
      console.log('⚠️ Evento creado pero sin link de Meet');
      console.log('🔍 Datos de conferencia disponibles:', response.data.conferenceData);
      return {
        success: true,
        eventId: response.data.id
      };
    }

  } catch (error: any) {
    console.error('❌ Error al crear Google Meet:', {
      message: error.message,
      status: error.status,
      code: error.code,
      errors: error.errors,
      response: error.response?.data
    });
    
    return {
      success: false,
      error: error.message || 'Error desconocido al crear Google Meet',
      details: {
        status: error.status,
        code: error.code,
        errors: error.errors
      }
    };
  }
}

/**
 * Crea un evento en el calendario del administrador para un entrenamiento
 */
export async function createTrainingEvent(
  userEmail: string,
  trainingName: string,
  startDate: Date,
  durationMinutes: number = 180
): Promise<GoogleMeetData> {
  try {
    console.log('📅 Creando evento de entrenamiento en calendario del admin');

    const calendar = await getAdminCalendarClient();
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    
    // CORREGIDO: Usar fechas UTC directamente (ya vienen ajustadas del frontend)
    const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Argentina/Buenos_Aires';
    
    console.log('🕒 Usando fechas UTC directamente (entrenamiento):', {
      startDateUTC: startDate.toISOString(),
      endDateUTC: endDate.toISOString(),
      timezone: timezone
    });
    
    // Crear ID único para evitar conflictos con eventos existentes
    const uniqueId = Date.now().toString();
    const formattedDate = startDate.toLocaleDateString('es-ES', { timeZone: timezone });

    const event = {
      summary: `${trainingName} - ${userEmail} - ${formattedDate} (${uniqueId})`,
      description: `Entrenamiento de trading reservado por: ${userEmail}\n\nTipo: ${trainingName}\nDuración: ${durationMinutes} minutos\n\nID único: ${uniqueId}\n\nLink de reunión: [Se generará automáticamente]`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: timezone,
      },
      attendees: [
        {
          email: userEmail,
          responseStatus: 'needsAction'
        },
        // Agregar administradores como asistentes si están configurados
        ...(process.env.ADMIN_EMAIL ? [{ email: process.env.ADMIN_EMAIL }] : []),
        ...(process.env.ADMIN_EMAILS
          ? process.env.ADMIN_EMAILS.split(',').map(e => ({ email: e.trim() })).filter(a => a.email)
          : [])
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 horas antes
          { method: 'email', minutes: 60 }, // 1 hora antes por email
          { method: 'popup', minutes: 60 }, // 1 hora antes por notificación
          { method: 'popup', minutes: 30 }, // 30 minutos antes
        ],
      },
      extendedProperties: {
        private: {
          bookingType: 'training',
          uniqueId: uniqueId,
          userEmail: userEmail,
          createdAt: new Date().toISOString()
        }
      }
    };

    // Obtener el calendar ID correcto
    const calendarId = await getCorrectCalendarId(calendar);
    console.log('🎯 Calendar ID:', calendarId);
    console.log('📋 Resumen del evento:', event.summary);

    // Crear evento con Google Meet automáticamente
    const meetData = await createGoogleMeetForEvent(calendar, event, calendarId);
    
    if (meetData.success && meetData.meetLink) {
      console.log('✅ Evento de entrenamiento creado con Google Meet:', meetData.meetLink);
    } else {
      console.log('⚠️ Evento creado pero sin Google Meet:', meetData.error);
    }

    return meetData;

  } catch (error) {
    console.error('❌ Error al crear evento de entrenamiento:', error);
    throw error;
  }
}

/**
 * Crea un evento en el calendario del administrador para una asesoría
 */
export async function createAdvisoryEvent(
  userEmail: string,
  advisoryName: string,
  startDate: Date,
  durationMinutes: number = 60
): Promise<GoogleMeetData> {
  try {
    console.log('📅 Creando evento de asesoría en calendario del admin');
    console.log('📋 Datos del evento:', {
      userEmail,
      advisoryName,
      startDate: startDate.toISOString(),
      durationMinutes,
      timezone: 'America/Argentina/Buenos_Aires'
    });

    const calendar = await getAdminCalendarClient();
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    
    // CORREGIDO: Usar America/Argentina/Buenos_Aires para mostrar hora local correctamente
    const timezone = 'America/Argentina/Buenos_Aires';
    
    console.log('🕒 Usando fechas UTC con timezone local:', {
      startDateUTC: startDate.toISOString(),
      endDateUTC: endDate.toISOString(),
      timezone: timezone
    });
    
    // Crear ID único para evitar conflictos con eventos existentes
    const uniqueId = Date.now().toString();
    const formattedDate = startDate.toLocaleDateString('es-ES', { timeZone: timezone });
    const formattedTime = startDate.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: timezone
    });

    const event = {
      summary: `${advisoryName} - ${userEmail} - ${formattedDate} ${formattedTime} (${uniqueId})`,
      description: `Asesoría financiera reservada por: ${userEmail}\n\nTipo: ${advisoryName}\nDuración: ${durationMinutes} minutos\n\nFecha: ${formattedDate} a las ${formattedTime}\nID único: ${uniqueId}\n\nLink de reunión: [Se generará automáticamente]`,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: timezone,
      },
      attendees: [
        {
          email: userEmail,
          responseStatus: 'needsAction'
        }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 horas antes
          { method: 'popup', minutes: 30 }, // 30 minutos antes
        ],
      },
      extendedProperties: {
        private: {
          bookingType: 'advisory',
          uniqueId: uniqueId,
          userEmail: userEmail,
          createdAt: new Date().toISOString()
        }
      }
    };

    // Obtener el calendar ID correcto
    const calendarId = await getCorrectCalendarId(calendar);
    console.log('🎯 Calendar ID:', calendarId);
    console.log('📋 Resumen del evento:', event.summary);

    // Crear evento con Google Meet automáticamente
    console.log('🔗 Iniciando creación de evento con Google Meet...');
    const meetData = await createGoogleMeetForEvent(calendar, event, calendarId);
    
    if (meetData.success && meetData.meetLink) {
      console.log('✅ Evento de asesoría creado con Google Meet:', meetData.meetLink);
      console.log('📅 ID del evento creado:', meetData.eventId);
    } else if (meetData.success && meetData.eventId) {
      console.log('⚠️ Evento creado pero sin Google Meet:', meetData.error);
      console.log('📅 ID del evento creado:', meetData.eventId);
    } else {
      console.error('❌ Error creando evento:', meetData.error);
      throw new Error(`Error creando evento: ${meetData.error}`);
    }

    return meetData;

  } catch (error: any) {
    console.error('❌ Error detallado al crear evento de asesoría:', {
      message: error?.message,
      status: error?.status,
      code: error?.code,
      errors: error?.errors,
      response: error?.response?.data,
      stack: error?.stack
    });
    
    // Retornar error estructurado en lugar de lanzar excepción
    return {
      success: false,
      error: error?.message || 'Error desconocido al crear evento de asesoría',
      details: {
        status: error?.status,
        code: error?.code,
        errors: error?.errors
      }
    };
  }
}

/**
 * Actualiza un evento existente con Google Meet
 */
export async function updateEventWithGoogleMeet(
  eventId: string,
  meetLink?: string
): Promise<boolean> {
  try {
    console.log('🔄 Actualizando evento con Google Meet:', eventId);
    
    const calendar = await getAdminCalendarClient();
    const calendarId = await getCorrectCalendarId(calendar);

    // Obtener el evento actual
    const currentEvent = await calendar.events.get({
      calendarId,
      eventId
    });

    // Actualizar descripción con el link de Meet
    const updatedDescription = meetLink 
      ? `${currentEvent.data.description}\n\n🔗 Link de Google Meet: ${meetLink}`
      : currentEvent.data.description;

    // Actualizar el evento
    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: {
        ...currentEvent.data,
        description: updatedDescription
      }
    });

    console.log('✅ Evento actualizado con Google Meet');
    return true;

  } catch (error) {
    console.error('❌ Error al actualizar evento con Google Meet:', error);
    return false;
  }
} 