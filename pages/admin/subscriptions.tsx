import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Mail,
  X
} from 'lucide-react';
import Head from 'next/head';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { toast } from 'react-hot-toast';
import styles from '@/styles/AdminSubscriptions.module.css';

interface Subscription {
  id: string;
  userEmail: string;
  userName: string;
  service: string;
  status: 'active' | 'expired' | 'pending';
  startDate: string;
  expiryDate: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId?: string;
  daysUntilExpiry: number;
}

interface Payment {
  id: string;
  userEmail: string;
  userName: string;
  service: string;
  amount: number;
  currency: string;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled';
  transactionDate: string;
  expiryDate: string;
  paymentMethod: string;
  mercadopagoPaymentId?: string;
}

interface Stats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiringSoon: number;
  totalRevenue: number;
  monthlyRevenue: number;
  pendingPayments: number;
}

export default function AdminSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'payments'>('subscriptions');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [notificationStats, setNotificationStats] = useState<{
    pendingNotifications: number;
    lastProcessed: string | null;
  } | null>(null);
  const [processingNotifications, setProcessingNotifications] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch subscriptions
      const subscriptionsResponse = await fetch('/api/admin/subscriptions');
      const subscriptionsData = await subscriptionsResponse.json();
      
      if (subscriptionsData.success) {
        setSubscriptions(subscriptionsData.subscriptions);
        setStats(subscriptionsData.stats);
      }

      // Fetch payments
      const paymentsResponse = await fetch('/api/admin/payments');
      const paymentsData = await paymentsResponse.json();
      
      if (paymentsData.success) {
        setPayments(paymentsData.payments);
      }

      // Fetch notification stats
      const notificationsResponse = await fetch('/api/admin/subscription-notifications');
      const notificationsData = await notificationsResponse.json();
      
      if (notificationsData.success) {
        setNotificationStats({
          pendingNotifications: notificationsData.total,
          lastProcessed: null // Se actualizará cuando se procesen
        });
      }
      
      if (paymentsData.success) {
        setPayments(paymentsData.payments);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceDisplayName = (service: string) => {
    const serviceNames: { [key: string]: string } = {
      'TraderCall': 'Trader Call',
      'SmartMoney': 'Smart Money',
      'CashFlow': 'Cash Flow',
      'SwingTrading': 'Zero 2 Trader',
      'DowJones': 'Dow Jones'
    };
    return serviceNames[service] || service;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'approved':
        return <CheckCircle size={16} className={styles.statusActive} />;
      case 'expired':
      case 'rejected':
      case 'cancelled':
        return <XCircle size={16} className={styles.statusExpired} />;
      case 'pending':
        return <Clock size={16} className={styles.statusPending} />;
      default:
        return <AlertTriangle size={16} className={styles.statusUnknown} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Activa';
      case 'expired':
        return 'Expirada';
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'rejected':
        return 'Rechazado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return 'Desconocido';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
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

  const handleViewSubscriptionDetails = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setSelectedPayment(null);
    setShowDetailsModal(true);
  };

  const handleViewPaymentDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setSelectedSubscription(null);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedSubscription(null);
    setSelectedPayment(null);
  };

  const sendReminderEmail = async (userEmail: string, service: string) => {
    try {
      const response = await fetch('/api/admin/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, service })
      });
      
      if (response.ok) {
        toast.success('Email de recordatorio enviado exitosamente');
      } else {
        toast.error('Error enviando email de recordatorio');
      }
    } catch (error) {
      toast.error('Error enviando email de recordatorio');
    }
  };

  const processNotifications = async () => {
    try {
      setProcessingNotifications(true);
      
      const response = await fetch('/api/admin/subscription-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'process' }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Notificaciones procesadas: ${data.result.warningsSent} advertencias, ${data.result.expiredSent} expiradas`);
        setNotificationStats({
          pendingNotifications: 0,
          lastProcessed: new Date().toLocaleString('es-AR')
        });
        
        // Recargar datos
        await fetchData();
      } else {
        toast.error('Error al procesar notificaciones');
      }
    } catch (error) {
      console.error('Error processing notifications:', error);
      toast.error('Error al procesar notificaciones');
    } finally {
      setProcessingNotifications(false);
    }
  };

  const cleanupNotifications = async () => {
    try {
      const response = await fetch('/api/admin/subscription-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cleanup' }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`${data.deletedCount} notificaciones antiguas limpiadas`);
      } else {
        toast.error('Error al limpiar notificaciones');
      }
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
      toast.error('Error al limpiar notificaciones');
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = sub.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sub.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getServiceDisplayName(sub.service).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const matchesService = serviceFilter === 'all' || sub.service === serviceFilter;
    
    return matchesSearch && matchesStatus && matchesService;
  });

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getServiceDisplayName(payment.service).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    const matchesService = serviceFilter === 'all' || payment.service === serviceFilter;
    
    return matchesSearch && matchesStatus && matchesService;
  });

  if (loading) {
    return (
      <>
        <Head>
          <title>Gestión de Suscripciones - Admin</title>
        </Head>
        <Navbar />
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Cargando datos...</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Gestión de Suscripciones - Admin</title>
      </Head>
      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            className={styles.header}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className={styles.headerContent}>
              <h1>Gestión de Suscripciones y Pagos</h1>
              <p>Administra las suscripciones activas y el historial de pagos</p>
            </div>
            <button onClick={fetchData} className={styles.refreshButton}>
              <RefreshCw size={20} />
              Actualizar
            </button>
          </motion.div>

          {/* Estadísticas */}
          {stats && (
            <motion.div 
              className={styles.statsGrid}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Users size={24} />
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
                  <h3>{formatCurrency(stats.totalRevenue, 'ARS')}</h3>
                  <p>Ingresos Totales</p>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <TrendingUp size={24} />
                </div>
                <div className={styles.statContent}>
                  <h3>{formatCurrency(stats.monthlyRevenue, 'ARS')}</h3>
                  <p>Ingresos del Mes</p>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <AlertTriangle size={24} />
                </div>
                <div className={styles.statContent}>
                  <h3>{stats.expiringSoon}</h3>
                  <p>Expiran Pronto</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Sección de Notificaciones */}
          <motion.div 
            className={styles.notificationsSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className={styles.notificationsHeader}>
              <h2>📧 Notificaciones de Suscripciones</h2>
              <p>Gestiona las notificaciones automáticas de vencimiento</p>
            </div>
            
            <div className={styles.notificationsGrid}>
              <div className={styles.notificationCard}>
                <div className={styles.notificationIcon}>
                  <Mail size={24} />
                </div>
                <div className={styles.notificationContent}>
                  <h3>{notificationStats?.pendingNotifications || 0}</h3>
                  <p>Notificaciones Pendientes</p>
                </div>
              </div>

              <div className={styles.notificationCard}>
                <div className={styles.notificationIcon}>
                  <Clock size={24} />
                </div>
                <div className={styles.notificationContent}>
                  <h3>{notificationStats?.lastProcessed ? 'Reciente' : 'Nunca'}</h3>
                  <p>Último Procesamiento</p>
                  {notificationStats?.lastProcessed && (
                    <small>{notificationStats.lastProcessed}</small>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.notificationActions}>
              <button 
                onClick={processNotifications}
                disabled={processingNotifications}
                className={styles.processButton}
              >
                {processingNotifications ? (
                  <>
                    <div className={styles.spinner}></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <Mail size={20} />
                    Procesar Notificaciones
                  </>
                )}
              </button>
              
              <button 
                onClick={cleanupNotifications}
                className={styles.cleanupButton}
              >
                <X size={20} />
                Limpiar Antiguas
              </button>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div 
            className={styles.tabs}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <button
              className={`${styles.tab} ${activeTab === 'subscriptions' ? styles.active : ''}`}
              onClick={() => setActiveTab('subscriptions')}
            >
              Suscripciones ({subscriptions.length})
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'payments' ? styles.active : ''}`}
              onClick={() => setActiveTab('payments')}
            >
              Pagos ({payments.length})
            </button>
          </motion.div>

          {/* Filtros */}
          <motion.div 
            className={styles.filters}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className={styles.searchContainer}>
              <Search size={20} />
              <input
                type="text"
                placeholder="Buscar por email, nombre o servicio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activas</option>
                <option value="expired">Expiradas</option>
                <option value="pending">Pendientes</option>
                <option value="approved">Aprobados</option>
                <option value="rejected">Rechazados</option>
              </select>

              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">Todos los servicios</option>
                <option value="TraderCall">Trader Call</option>
                <option value="SmartMoney">Smart Money</option>
                <option value="CashFlow">Cash Flow</option>
                <option value="SwingTrading">Zero 2 Trader</option>
                <option value="DowJones">Dow Jones</option>
              </select>
            </div>
          </motion.div>

          {/* Contenido de las tabs */}
          <motion.div 
            className={styles.content}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {activeTab === 'subscriptions' ? (
              <div className={styles.subscriptionsTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.headerCell}>Usuario</div>
                  <div className={styles.headerCell}>Servicio</div>
                  <div className={styles.headerCell}>Estado</div>
                  <div className={styles.headerCell}>Inicio</div>
                  <div className={styles.headerCell}>Expiración</div>
                  <div className={styles.headerCell}>Monto</div>
                  <div className={styles.headerCell}>Acciones</div>
                </div>

                {filteredSubscriptions.map((subscription) => (
                  <div key={subscription.id} className={styles.tableRow}>
                    <div className={styles.cell}>
                      <div className={styles.userInfo}>
                        <div className={styles.userName}>{subscription.userName}</div>
                        <div className={styles.userEmail}>{subscription.userEmail}</div>
                      </div>
                    </div>
                    <div className={styles.cell}>
                      {getServiceDisplayName(subscription.service)}
                    </div>
                    <div className={styles.cell}>
                      <div className={styles.statusContainer}>
                        {getStatusIcon(subscription.status)}
                        <span>{getStatusText(subscription.status)}</span>
                      </div>
                    </div>
                    <div className={styles.cell}>
                      {formatDate(subscription.startDate)}
                    </div>
                    <div className={styles.cell}>
                      <div className={styles.expiryInfo}>
                        <span>{formatDate(subscription.expiryDate)}</span>
                        {subscription.daysUntilExpiry <= 7 && (
                          <span className={styles.expiryWarning}>
                            ({subscription.daysUntilExpiry} días)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.cell}>
                      {formatCurrency(subscription.amount, subscription.currency)}
                    </div>
                    <div className={styles.cell}>
                      <div className={styles.actions}>
                        <button 
                          className={styles.actionButton} 
                          title="Ver detalles"
                          onClick={() => handleViewSubscriptionDetails(subscription)}
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          className={styles.actionButton} 
                          title="Enviar email de recordatorio"
                          onClick={() => sendReminderEmail(subscription.userEmail, subscription.service)}
                        >
                          <Mail size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.paymentsTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.headerCell}>Usuario</div>
                  <div className={styles.headerCell}>Servicio</div>
                  <div className={styles.headerCell}>Estado</div>
                  <div className={styles.headerCell}>Fecha</div>
                  <div className={styles.headerCell}>Monto</div>
                  <div className={styles.headerCell}>Método</div>
                  <div className={styles.headerCell}>Acciones</div>
                </div>

                {filteredPayments.map((payment) => (
                  <div key={payment.id} className={styles.tableRow}>
                    <div className={styles.cell}>
                      <div className={styles.userInfo}>
                        <div className={styles.userName}>{payment.userName}</div>
                        <div className={styles.userEmail}>{payment.userEmail}</div>
                      </div>
                    </div>
                    <div className={styles.cell}>
                      {getServiceDisplayName(payment.service)}
                    </div>
                    <div className={styles.cell}>
                      <div className={styles.statusContainer}>
                        {getStatusIcon(payment.status)}
                        <span>{getStatusText(payment.status)}</span>
                      </div>
                    </div>
                    <div className={styles.cell}>
                      {formatDate(payment.transactionDate)}
                    </div>
                    <div className={styles.cell}>
                      {formatCurrency(payment.amount, payment.currency)}
                    </div>
                    <div className={styles.cell}>
                      {payment.paymentMethod}
                    </div>
                    <div className={styles.cell}>
                      <div className={styles.actions}>
                        <button 
                          className={styles.actionButton} 
                          title="Ver detalles del pago"
                          onClick={() => handleViewPaymentDetails(payment)}
                        >
                          <Eye size={16} />
                        </button>
                        {payment.mercadopagoPaymentId && (
                          <span className={styles.paymentId}>
                            {payment.mercadopagoPaymentId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Modal de Detalles */}
      {showDetailsModal && (selectedSubscription || selectedPayment) && (
        <div className={styles.modalOverlay} onClick={closeDetailsModal}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                {selectedSubscription ? 'Detalles de Suscripción' : 'Detalles de Pago'}
              </h3>
              <button 
                onClick={closeDetailsModal}
                className={styles.closeButton}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalContent}>
              {selectedSubscription && (
                <div className={styles.detailsGrid}>
                  <div className={styles.detailSection}>
                    <h4>Información del Usuario</h4>
                    <div className={styles.detailItem}>
                      <label>Nombre:</label>
                      <span>{selectedSubscription.userName}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Email:</label>
                      <span>{selectedSubscription.userEmail}</span>
                    </div>
                  </div>

                  <div className={styles.detailSection}>
                    <h4>Información de Suscripción</h4>
                    <div className={styles.detailItem}>
                      <label>Servicio:</label>
                      <span className={styles.serviceBadge}>
                        {getServiceDisplayName(selectedSubscription.service)}
                      </span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Estado:</label>
                      <div className={styles.statusContainer}>
                        {getStatusIcon(selectedSubscription.status)}
                        <span>{getStatusText(selectedSubscription.status)}</span>
                      </div>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Fecha de Inicio:</label>
                      <span>{formatDate(selectedSubscription.startDate)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Fecha de Expiración:</label>
                      <span>{formatDate(selectedSubscription.expiryDate)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Días hasta expiración:</label>
                      <span className={selectedSubscription.daysUntilExpiry <= 7 ? styles.expiryWarning : ''}>
                        {selectedSubscription.daysUntilExpiry > 0 
                          ? `${selectedSubscription.daysUntilExpiry} días`
                          : `Expiró hace ${Math.abs(selectedSubscription.daysUntilExpiry)} días`
                        }
                      </span>
                    </div>
                  </div>

                  <div className={styles.detailSection}>
                    <h4>Información de Pago</h4>
                    <div className={styles.detailItem}>
                      <label>Monto:</label>
                      <span className={styles.amountBadge}>
                        {formatCurrency(selectedSubscription.amount, selectedSubscription.currency)}
                      </span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Método de Pago:</label>
                      <span>{selectedSubscription.paymentMethod}</span>
                    </div>
                    {selectedSubscription.transactionId && (
                      <div className={styles.detailItem}>
                        <label>ID de Transacción:</label>
                        <span className={styles.transactionId}>
                          {selectedSubscription.transactionId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedPayment && (
                <div className={styles.detailsGrid}>
                  <div className={styles.detailSection}>
                    <h4>Información del Usuario</h4>
                    <div className={styles.detailItem}>
                      <label>Nombre:</label>
                      <span>{selectedPayment.userName}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Email:</label>
                      <span>{selectedPayment.userEmail}</span>
                    </div>
                  </div>

                  <div className={styles.detailSection}>
                    <h4>Información del Pago</h4>
                    <div className={styles.detailItem}>
                      <label>Servicio:</label>
                      <span className={styles.serviceBadge}>
                        {getServiceDisplayName(selectedPayment.service)}
                      </span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Estado:</label>
                      <div className={styles.statusContainer}>
                        {getStatusIcon(selectedPayment.status)}
                        <span>{getStatusText(selectedPayment.status)}</span>
                      </div>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Fecha de Transacción:</label>
                      <span>{formatDate(selectedPayment.transactionDate)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Fecha de Expiración:</label>
                      <span>{formatDate(selectedPayment.expiryDate)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Monto:</label>
                      <span className={styles.amountBadge}>
                        {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                      </span>
                    </div>
                    <div className={styles.detailItem}>
                      <label>Método de Pago:</label>
                      <span>{selectedPayment.paymentMethod}</span>
                    </div>
                    {selectedPayment.mercadopagoPaymentId && (
                      <div className={styles.detailItem}>
                        <label>ID MercadoPago:</label>
                        <span className={styles.transactionId}>
                          {selectedPayment.mercadopagoPaymentId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              {selectedSubscription && (
                <button 
                  onClick={() => sendReminderEmail(selectedSubscription.userEmail, selectedSubscription.service)}
                  className={styles.primaryButton}
                >
                  <Mail size={16} />
                  Enviar Recordatorio
                </button>
              )}
              <button 
                onClick={closeDetailsModal}
                className={styles.secondaryButton}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  console.log('🔍 [SUBSCRIPTIONS] Iniciando verificación de acceso...');
  
  try {
    // Usar la función de verificación que ya sabemos que funciona
    const verification = await verifyAdminAccess(context);
    
    console.log('🔍 [SUBSCRIPTIONS] Resultado de verificación:', verification);
    
    if (!verification.isAdmin) {
      console.log('❌ [SUBSCRIPTIONS] Acceso denegado - redirigiendo a:', verification.redirectTo);
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    console.log('✅ [SUBSCRIPTIONS] Acceso de admin confirmado para:', verification.session?.user?.email || verification.user?.email);
    
    return {
      props: {
        user: verification.session?.user || verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [SUBSCRIPTIONS] Error en getServerSideProps:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
};
