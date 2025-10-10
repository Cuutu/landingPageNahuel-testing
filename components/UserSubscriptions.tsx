import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  Calendar,
  RefreshCw,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useUserSubscriptions, UserSubscription, PaymentHistory } from '@/hooks/useUserSubscriptions';
import styles from '@/styles/UserSubscriptions.module.css';

const getServiceDisplayName = (service: string) => {
  const serviceNames: { [key: string]: string } = {
    'TraderCall': 'Trader Call',
    'SmartMoney': 'Smart Money',
    'SwingTrading': 'Swing Trading'
  };
  return serviceNames[service] || service;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved':
    case 'active':
      return <CheckCircle size={20} className={styles.statusActive} />;
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return <XCircle size={20} className={styles.statusExpired} />;
    case 'pending':
      return <Clock size={20} className={styles.statusPending} />;
    default:
      return <CheckCircle size={20} className={styles.statusActive} />;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'approved':
    case 'active':
      return 'Aprobado';
    case 'rejected':
      return 'Rechazado';
    case 'cancelled':
      return 'Cancelado';
    case 'expired':
      return 'Expirado';
    case 'pending':
      return 'Pendiente';
    default:
      return 'Aprobado';
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency || 'ARS'
  }).format(amount);
};

const getDaysUntilExpiry = (expiryDate: string) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function UserSubscriptions() {
  const { 
    subscriptions, 
    paymentHistory, 
    loading, 
    error, 
    stats, 
    refreshSubscriptions 
  } = useUserSubscriptions();

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando suscripciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <AlertTriangle size={24} />
        <p>Error al cargar suscripciones: {error}</p>
        <button onClick={refreshSubscriptions} className={styles.retryButton}>
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Estadísticas */}
      <motion.div 
        className={styles.statsGrid}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <CheckCircle size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>{stats.activeSubscriptions}</h3>
            <p>Suscripciones Activas</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <DollarSign size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>{formatCurrency(stats.totalSpent, 'ARS')}</h3>
            <p>Total Gastado</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>{paymentHistory.length}</h3>
            <p>Transacciones</p>
          </div>
        </div>
      </motion.div>

      {/* Suscripciones Activas */}
      <motion.div 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className={styles.sectionHeader}>
          <h2>Suscripciones Activas</h2>
          <button onClick={refreshSubscriptions} className={styles.refreshButton}>
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        {subscriptions.filter(sub => sub.status === 'active').length === 0 ? (
          <div className={styles.emptyState}>
            <CheckCircle size={48} />
            <h3>No tienes suscripciones activas</h3>
            <p>Explora nuestros servicios para comenzar</p>
          </div>
        ) : (
          <div className={styles.subscriptionsGrid}>
            {subscriptions
              .filter(sub => sub.status === 'active')
              .map((subscription, index) => {
                const daysUntilExpiry = getDaysUntilExpiry(subscription.expiryDate);
                const isExpiringSoon = daysUntilExpiry <= 7;

                return (
                  <motion.div
                    key={`${subscription.service}-${index}`}
                    className={`${styles.subscriptionCard} ${isExpiringSoon ? styles.expiringSoon : ''}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.serviceInfo}>
                        <h3>{getServiceDisplayName(subscription.service)}</h3>
                        <div className={styles.statusContainer}>
                          {getStatusIcon(subscription.status)}
                          <span className={styles.statusText}>
                            {getStatusText(subscription.status)}
                          </span>
                        </div>
                      </div>
                      <div className={styles.amount}>
                        {formatCurrency(subscription.amount, subscription.currency)}
                      </div>
                    </div>

                    <div className={styles.cardContent}>
                      <div className={styles.dateInfo}>
                        <div className={styles.dateItem}>
                          <Calendar size={16} />
                          <span>Inicio: {formatDate(subscription.startDate)}</span>
                        </div>
                        <div className={styles.dateItem}>
                          <Calendar size={16} />
                          <span>Expira: {formatDate(subscription.expiryDate)}</span>
                        </div>
                      </div>

                      {isExpiringSoon && (
                        <div className={styles.expiryWarning}>
                          <AlertTriangle size={16} />
                          <span>Expira en {daysUntilExpiry} días</span>
                        </div>
                      )}

                      <div className={styles.paymentInfo}>
                        <span>Método: {subscription.paymentMethod}</span>
                        {subscription.transactionId && (
                          <span>ID: {subscription.transactionId}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}
      </motion.div>

      {/* Historial de Pagos */}
      <motion.div 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className={styles.sectionHeader}>
          <h2>Historial de Pagos</h2>
        </div>

        {paymentHistory.length === 0 ? (
          <div className={styles.emptyState}>
            <DollarSign size={48} />
            <h3>No hay historial de pagos</h3>
            <p>Realiza tu primera compra para ver el historial</p>
          </div>
        ) : (
          <div className={styles.paymentHistory}>
            {paymentHistory.map((payment, index) => (
              <motion.div
                key={payment.id}
                className={styles.paymentItem}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <div className={styles.paymentHeader}>
                  <div className={styles.paymentService}>
                    <h4>{getServiceDisplayName(payment.service)}</h4>
                    <div className={styles.paymentStatus}>
                      {getStatusIcon(payment.status)}
                      <span>{getStatusText(payment.status)}</span>
                    </div>
                  </div>
                  <div className={styles.paymentAmount}>
                    {formatCurrency(payment.amount, payment.currency)}
                  </div>
                </div>

                <div className={styles.paymentDetails}>
                  <div className={styles.paymentDate}>
                    <Calendar size={14} />
                    <span>{formatDate(payment.transactionDate)}</span>
                  </div>
                  <div className={styles.paymentMethod}>
                    <span>{payment.paymentMethod}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
