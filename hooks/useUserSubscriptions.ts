import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export interface UserSubscription {
  service: string;
  status: 'active' | 'expired' | 'pending';
  startDate: string;
  expiryDate: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId?: string;
}

export interface PaymentHistory {
  id: string;
  service: string;
  amount: number;
  currency: string;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled' | 'unknown' | 'desconocido';
  transactionDate: string;
  expiryDate: string;
  paymentMethod: string;
  mercadopagoPaymentId?: string;
}

export function useUserSubscriptions() {
  const { data: session } = useSession();
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptions = async () => {
    if (!session?.user?.email) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/user/subscriptions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
        setPaymentHistory(data.paymentHistory || []);
      } else {
        throw new Error('Error al obtener suscripciones');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshSubscriptions = () => {
    fetchSubscriptions();
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [session?.user?.email]);

  // Calcular estadísticas
  const stats = {
    activeSubscriptions: subscriptions.filter(sub => sub.status === 'active').length,
    totalSpent: paymentHistory
      .filter(payment => payment.status === 'approved')
      .reduce((total, payment) => total + payment.amount, 0),
    nextExpiry: subscriptions
      .filter(sub => sub.status === 'active')
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0]?.expiryDate
  };

  return {
    subscriptions,
    paymentHistory,
    loading,
    error,
    stats,
    refreshSubscriptions
  };
}
