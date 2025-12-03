import { useState, useEffect, useCallback, useRef } from 'react';

export interface LiveUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastActivity: Date;
  currentPage: string;
  sessionDuration: number;
  isActive: boolean;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
  data: any;
  retryCount: number;
  endpoint?: string;
  responseTime?: number;
}

export interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
  trend: 'up' | 'down' | 'neutral';
  previousValue?: number;
  period?: string;
}

export interface RealTimeStats {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  webhookSuccessRate: number;
  averageResponseTime: number;
  errorRate: number;
  conversionRate: number;
  revenueToday: number;
}

export interface UseRealTimeMetricsOptions {
  refreshInterval?: number;
  enableWebSocket?: boolean;
  enableMockData?: boolean;
  maxUsers?: number;
  maxWebhooks?: number;
}

export function useRealTimeMetrics(options: UseRealTimeMetricsOptions = {}) {
  const {
    refreshInterval = 30000,
    enableWebSocket = false,
    enableMockData = true,
    maxUsers = 50,
    maxWebhooks = 100
  } = options;

  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [stats, setStats] = useState<RealTimeStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalSessions: 0,
    webhookSuccessRate: 0,
    averageResponseTime: 0,
    errorRate: 0,
    conversionRate: 0,
    revenueToday: 0
  });
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generar datos mock para desarrollo
  const generateMockData = useCallback(() => {
    if (!enableMockData) return;

    const mockUsers: LiveUser[] = Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, i) => ({
      id: `user-${i + 1}`,
      email: `usuario${i + 1}@ejemplo.com`,
      name: `Usuario ${i + 1}`,
      role: ['admin', 'suscriptor', 'normal'][Math.floor(Math.random() * 3)],
      lastActivity: new Date(Date.now() - Math.random() * 300000), // Últimos 5 minutos
      currentPage: [
        '/alertas/smart-money',
        '/entrenamientos',
        '/admin/dashboard',
        '/perfil',
        '/recursos'
      ][Math.floor(Math.random() * 5)],
      sessionDuration: Math.floor(Math.random() * 3600) + 300, // 5-65 min
      isActive: Math.random() > 0.3, // 70% probabilidad de estar activo
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      location: 'Montevideo, Uruguay'
    }));

    const mockWebhooks: WebhookEvent[] = Array.from({ length: Math.floor(Math.random() * 8) + 3 }, (_, i) => ({
      id: `webhook-${i + 1}`,
      type: [
        'payment_success',
        'user_registration',
        'subscription_cancelled',
        'alert_created',
        'training_completed',
        'webhook_test'
      ][Math.floor(Math.random() * 6)],
      source: [
        'mercadopago',
        'google_auth',
        'webhook_handler',
        'notification_service',
        'training_system'
      ][Math.floor(Math.random() * 5)],
      timestamp: new Date(Date.now() - Math.random() * 86400000), // Últimas 24 horas
      status: ['success', 'error', 'pending'][Math.floor(Math.random() * 3)] as any,
      data: {
        amount: Math.floor(Math.random() * 50000) + 1000,
        currency: 'ARS',
        userId: `user-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString()
      },
      retryCount: Math.floor(Math.random() * 3),
      endpoint: '/api/webhooks/mercadopago',
      responseTime: Math.floor(Math.random() * 500) + 50
    }));

    // Calcular estadísticas
    const activeUsers = mockUsers.filter(u => u.isActive).length;
    const totalSessions = mockUsers.length;
    const webhookSuccessRate = (mockWebhooks.filter(w => w.status === 'success').length / mockWebhooks.length) * 100;
    const averageResponseTime = mockWebhooks.reduce((acc, w) => acc + (w.responseTime || 0), 0) / mockWebhooks.length;
    const errorRate = (mockWebhooks.filter(w => w.status === 'error').length / mockWebhooks.length) * 100;

    const mockMetrics: MetricCard[] = [
      {
        title: 'Usuarios Activos',
        value: activeUsers,
        change: Math.floor(Math.random() * 20) - 10,
        icon: '👥',
        color: '#10b981',
        trend: Math.random() > 0.5 ? 'up' : 'down',
        previousValue: Math.max(0, activeUsers - Math.floor(Math.random() * 5)),
        period: 'vs. última hora'
      },
      {
        title: 'Sesiones Hoy',
        value: Math.floor(Math.random() * 200) + 50,
        change: Math.floor(Math.random() * 15) - 7,
        icon: '📊',
        color: '#3b82f6',
        trend: Math.random() > 0.5 ? 'up' : 'down',
        period: 'vs. ayer'
      },
      {
        title: 'Webhooks Exitosos',
        value: `${webhookSuccessRate.toFixed(1)}%`,
        change: Math.floor(Math.random() * 10) - 5,
        icon: '✅',
        color: '#059669',
        trend: webhookSuccessRate > 90 ? 'up' : 'down',
        period: 'vs. última hora'
      },
      {
        title: 'Tasa de Conversión',
        value: `${(Math.random() * 5 + 1).toFixed(1)}%`,
        change: Math.floor(Math.random() * 20) - 10,
        icon: '🎯',
        color: '#f59e0b',
        trend: Math.random() > 0.5 ? 'up' : 'down',
        period: 'vs. semana anterior'
      }
    ];

    setLiveUsers(mockUsers.slice(0, maxUsers));
    setWebhookEvents(mockWebhooks.slice(0, maxWebhooks));
    setMetrics(mockMetrics);
    setStats({
      totalUsers: mockUsers.length,
      activeUsers,
      totalSessions,
      webhookSuccessRate,
      averageResponseTime,
      errorRate,
      conversionRate: parseFloat(mockMetrics[3].value.toString()),
      revenueToday: Math.floor(Math.random() * 100000) + 10000
    });
    setLastUpdate(new Date());
  }, [enableMockData, maxUsers, maxWebhooks]);

  // Función para obtener datos reales de la API
  const fetchRealData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Aquí irían las llamadas reales a la API
      const [usersResponse, webhooksResponse, metricsResponse] = await Promise.all([
        fetch('/api/admin/real-time/users'),
        fetch('/api/admin/real-time/webhooks'),
        fetch('/api/admin/real-time/metrics')
      ]);

      if (!usersResponse.ok || !webhooksResponse.ok || !metricsResponse.ok) {
        throw new Error('Error al obtener datos en tiempo real');
      }

      const [usersData, webhooksData, metricsData] = await Promise.all([
        usersResponse.json(),
        webhooksResponse.json(),
        metricsResponse.json()
      ]);

      setLiveUsers(usersData.users || []);
      setWebhookEvents(webhooksData.webhooks || []);
      setMetrics(metricsData.metrics || []);
      setStats(metricsData.stats || {});
      setLastUpdate(new Date());

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error fetching real-time data:', err);
      
      // Fallback a datos mock si hay error
      if (enableMockData) {
        generateMockData();
      }
    } finally {
      setIsLoading(false);
    }
  }, [enableMockData, generateMockData]);

  // Configurar WebSocket para datos en tiempo real
  const setupWebSocket = useCallback(() => {
    if (!enableWebSocket) return;

    try {
      const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001');
      
      ws.onopen = () => {
        // console.log('WebSocket conectado');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'user_activity':
              setLiveUsers(prev => {
                const existing = prev.find(u => u.id === data.user.id);
                if (existing) {
                  return prev.map(u => u.id === data.user.id ? { ...u, ...data.user } : u);
                } else {
                  return [data.user, ...prev].slice(0, maxUsers);
                }
              });
              break;
              
            case 'webhook_event':
              setWebhookEvents(prev => [data.webhook, ...prev].slice(0, maxWebhooks));
              break;
              
            case 'metrics_update':
              setMetrics(data.metrics);
              setStats(data.stats);
              break;
              
            case 'connection_status':
              setIsConnected(data.connected);
              break;
          }
          
          setLastUpdate(new Date());
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        // console.log('WebSocket desconectado');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Error setting up WebSocket:', err);
      setIsConnected(false);
    }
  }, [enableWebSocket, maxUsers, maxWebhooks]);

  // Configurar intervalo de actualización
  const setupInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (enableWebSocket) {
      // Con WebSocket, solo actualizamos cada 5 minutos para mantener estadísticas
      intervalRef.current = setInterval(() => {
        if (!isConnected) {
          fetchRealData();
        }
      }, 300000);
    } else {
      // Sin WebSocket, actualizamos según el intervalo configurado
      intervalRef.current = setInterval(fetchRealData, refreshInterval);
    }
  }, [enableWebSocket, isConnected, fetchRealData, refreshInterval]);

  // Efecto principal
  useEffect(() => {
    if (enableWebSocket) {
      setupWebSocket();
    } else {
      fetchRealData();
    }

    setupInterval();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enableWebSocket, setupWebSocket, setupInterval, fetchRealData]);

  // Función para refrescar manualmente
  const refreshData = useCallback(async () => {
    if (enableWebSocket && isConnected) {
      // Con WebSocket, solo actualizamos estadísticas
      fetchRealData();
    } else {
      // Sin WebSocket, actualizamos todo
      fetchRealData();
    }
  }, [enableWebSocket, isConnected, fetchRealData]);

  // Función para limpiar datos antiguos
  const cleanupOldData = useCallback(() => {
    const oneHourAgo = new Date(Date.now() - 3600000);
    const oneDayAgo = new Date(Date.now() - 86400000);

    setLiveUsers(prev => prev.filter(user => 
      user.lastActivity > oneHourAgo
    ));

    setWebhookEvents(prev => prev.filter(webhook => 
      webhook.timestamp > oneDayAgo
    ));
  }, []);

  // Limpiar datos antiguos cada hora
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupOldData, 3600000);
    return () => clearInterval(cleanupInterval);
  }, [cleanupOldData]);

  return {
    // Estado
    liveUsers,
    webhookEvents,
    metrics,
    stats,
    isConnected,
    lastUpdate,
    isLoading,
    error,
    
    // Acciones
    refreshData,
    cleanupOldData,
    
    // Utilidades
    totalActiveUsers: liveUsers.filter(u => u.isActive).length,
    totalWebhooks: webhookEvents.length,
    successWebhooks: webhookEvents.filter(w => w.status === 'success').length,
    errorWebhooks: webhookEvents.filter(w => w.status === 'error').length
  };
} 