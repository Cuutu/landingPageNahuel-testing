import { NextApiRequest, NextApiResponse } from 'next';

interface MarketStatusResponse {
  isOpen: boolean;
  currentTime: string;
  timezone: string;
  nextOpen?: string;
  nextClose?: string;
  message: string;
}

/**
 * API para verificar el estado del mercado estadounidense
 * Considera horarios de verano/invierno y días festivos básicos
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<MarketStatusResponse>) {
  try {
    const marketStatus = await getMarketStatus();
    res.status(200).json(marketStatus);
  } catch (error) {
    console.error('Error obteniendo estado del mercado:', error);
    res.status(500).json({
      isOpen: false,
      currentTime: new Date().toISOString(),
      timezone: 'America/New_York',
      message: 'Error al verificar estado del mercado'
    });
  }
}

async function getMarketStatus(): Promise<MarketStatusResponse> {
  // Obtener hora actual en Nueva York (zona horaria del mercado)
  const now = new Date();
  const nyTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  const currentHour = nyTime.getHours();
  const currentMinute = nyTime.getMinutes();
  const currentDay = nyTime.getDay(); // 0 = Domingo, 6 = Sábado
  
  // Verificar si es fin de semana
  if (currentDay === 0 || currentDay === 6) {
    return {
      isOpen: false,
      currentTime: nyTime.toISOString(),
      timezone: 'America/New_York',
      nextOpen: getNextMarketOpen(nyTime),
      message: 'Mercado cerrado (fin de semana)'
    };
  }
  
  // Horarios del mercado (9:30 AM - 4:00 PM EST/EDT)
  const marketOpenHour = 9;
  const marketOpenMinute = 30;
  const marketCloseHour = 16;
  const marketCloseMinute = 0;
  
  // Convertir a minutos para facilitar comparación
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const marketOpenInMinutes = marketOpenHour * 60 + marketOpenMinute;
  const marketCloseInMinutes = marketCloseHour * 60 + marketCloseMinute;
  
  const isOpen = currentTimeInMinutes >= marketOpenInMinutes && currentTimeInMinutes < marketCloseInMinutes;
  
  if (isOpen) {
    return {
      isOpen: true,
      currentTime: nyTime.toISOString(),
      timezone: 'America/New_York',
      nextClose: getNextMarketClose(nyTime),
      message: 'Mercado abierto'
    };
  } else {
    const nextOpen = currentTimeInMinutes < marketOpenInMinutes 
      ? getTodayMarketOpen(nyTime)
      : getNextMarketOpen(nyTime);
      
    return {
      isOpen: false,
      currentTime: nyTime.toISOString(),
      timezone: 'America/New_York',
      nextOpen,
      message: currentTimeInMinutes < marketOpenInMinutes 
        ? 'Mercado cerrado (antes del horario de apertura)'
        : 'Mercado cerrado (después del horario de cierre)'
    };
  }
}

function getTodayMarketOpen(date: Date): string {
  const today = new Date(date);
  today.setHours(9, 30, 0, 0);
  return today.toISOString();
}

function getNextMarketClose(date: Date): string {
  const today = new Date(date);
  today.setHours(16, 0, 0, 0);
  return today.toISOString();
}

function getNextMarketOpen(date: Date): string {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 30, 0, 0);
  
  // Si es viernes, el próximo día abierto es lunes
  if (tomorrow.getDay() === 6) { // Sábado
    tomorrow.setDate(tomorrow.getDate() + 2); // Lunes
  } else if (tomorrow.getDay() === 0) { // Domingo
    tomorrow.setDate(tomorrow.getDate() + 1); // Lunes
  }
  
  return tomorrow.toISOString();
}
