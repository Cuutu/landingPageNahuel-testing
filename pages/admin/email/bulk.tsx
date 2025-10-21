import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Send,
  Users,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  Search,
  Filter,
  Download,
  RefreshCw,
  Upload,
  FileText,
  X,
  Image as ImageIcon
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import User from '@/models/User';
import styles from '@/styles/AdminUsers.module.css';
import { toast } from 'react-hot-toast';
import ImageUploader, { CloudinaryImage } from '@/components/ImageUploader';

export default function AdminBulkEmailPage() {
  const [loading, setLoading] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: '',
    message: '',
    recipients: 'all', // all, suscriptores, admins
    buttonText: 'Visitar Sitio Web',
    buttonUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://landingpagenahuel.vercel.app'
  });
  const [testEmail, setTestEmail] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  
  // Estados para gestión de lista de emails
  const [emailList, setEmailList] = useState<any[]>([]);
  const [emailListLoading, setEmailListLoading] = useState(false);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailStats, setEmailStats] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Estados para importar/exportar CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Estados para imágenes
  const [emailImages, setEmailImages] = useState<CloudinaryImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Cargar lista de emails al montar el componente
  useEffect(() => {
    fetchEmailList();
  }, [currentPage, searchTerm, filterSource]);

  // Funciones para manejar imágenes
  const handleImageUploaded = (image: CloudinaryImage) => {
    setEmailImages(prev => [...prev, image]);
    setUploadingImages(false);
    console.log('✅ Imagen agregada al email:', image.public_id);
  };

  const handleImageUploadStart = () => {
    setUploadingImages(true);
  };

  const handleImageUploadError = (error: string) => {
    setUploadingImages(false);
    toast.error(`Error subiendo imagen: ${error}`);
  };

  const removeImage = (imageId: string) => {
    setEmailImages(prev => prev.filter(img => img.public_id !== imageId));
  };

  // Función para cargar la lista de emails
  const fetchEmailList = async () => {
    try {
      setEmailListLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm,
        source: filterSource === 'all' ? '' : filterSource
      });

      const response = await fetch(`/api/admin/email-list?${params}`);
      const data = await response.json();

      if (response.ok) {
        setEmailList(data.data.emails);
        setEmailStats(data.data.stats);
        setTotalPages(data.data.pagination.pages);
      } else {
        toast.error(data.error || 'Error cargando lista de emails');
      }
    } catch (error) {
      console.error('Error cargando lista de emails:', error);
      toast.error('Error cargando lista de emails');
    } finally {
      setEmailListLoading(false);
    }
  };

  // Función para agregar email
  const addEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Por favor ingresa un email válido');
      return;
    }

    try {
      const response = await fetch('/api/admin/email-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setNewEmail('');
        setShowAddEmail(false);
        fetchEmailList(); // Recargar lista
      } else {
        toast.error(data.error || 'Error agregando email');
      }
    } catch (error) {
      console.error('Error agregando email:', error);
      toast.error('Error agregando email');
    }
  };

  // Función para eliminar/desactivar email
  const removeEmail = async (email: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar ${email} de la lista?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/email-list', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, action: 'deactivate' }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        fetchEmailList(); // Recargar lista
      } else {
        toast.error(data.error || 'Error eliminando email');
      }
    } catch (error) {
      console.error('Error eliminando email:', error);
      toast.error('Error eliminando email');
    }
  };

  // Función para exportar emails a CSV
  const exportToCSV = async () => {
    try {
      setExportLoading(true);
      
      const response = await fetch('/api/admin/email-list/export');
      
      if (response.ok) {
        // Crear blob y descargar
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emails-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success('Archivo CSV exportado exitosamente');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Error exportando CSV');
      }
    } catch (error) {
      console.error('Error exportando CSV:', error);
      toast.error('Error exportando CSV');
    } finally {
      setExportLoading(false);
    }
  };

  // Función para manejar selección de archivo CSV
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar que sea un archivo CSV
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setCsvFile(file);
      } else {
        toast.error('Por favor selecciona un archivo CSV válido');
      }
    }
  };

  // Función para importar emails desde CSV
  const importFromCSV = async () => {
    if (!csvFile) {
      toast.error('Por favor selecciona un archivo CSV');
      return;
    }

    try {
      setImportLoading(true);
      
      const formData = new FormData();
      formData.append('csv', csvFile);

      const response = await fetch('/api/admin/email-list/import-async', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Procesamiento iniciado para ${data.total} emails. Los emails se procesarán en segundo plano.`);
        setCsvFile(null);
        setShowImportModal(false);
        
        // Actualizar la lista después de un breve delay
        setTimeout(() => {
          fetchEmailList();
        }, 2000);
      } else {
        toast.error(data.error || 'Error iniciando importación');
      }
    } catch (error) {
      console.error('Error importando CSV:', error);
      toast.error('Error importando CSV');
    } finally {
      setImportLoading(false);
    }
  };

  const sendBulkEmail = async () => {
    if (!emailData.subject.trim() || !emailData.message.trim()) {
      toast.error('Por favor completa el asunto y el mensaje');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/email/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...emailData,
          images: emailImages
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Email enviado a ${result.sentCount} usuarios`);
        setEmailData({ 
          subject: '', 
          message: '', 
          recipients: 'all',
          buttonText: 'Visitar Sitio Web',
          buttonUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://landingpagenahuel.vercel.app'
        });
        setEmailImages([]);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al enviar emails');
      }
    } catch (error) {
      console.error('Error al enviar emails:', error);
      toast.error('Error al enviar emails');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async (testType: string) => {
    if (!testEmail.trim()) {
      toast.error('Por favor ingresa un email válido');
      return;
    }

    try {
      setTestLoading(true);
      const response = await fetch('/api/admin/email/test-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testType, email: testEmail }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Email de prueba enviado exitosamente');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al enviar email de prueba');
      }
    } catch (error) {
      console.error('Error al enviar email de prueba:', error);
      toast.error('Error al enviar email de prueba');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Envío Masivo de Emails - Admin Dashboard</title>
        <meta name="description" content="Enviar emails masivos a usuarios del sistema" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            className={styles.content}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={styles.headerIcon}>
                  <Mail size={40} />
                </div>
                <div>
                  <h1 className={styles.title}>Envío Masivo de Emails</h1>
                  <p className={styles.subtitle}>
                    Envía comunicaciones importantes a grupos de usuarios
                  </p>
                </div>
              </div>
              <div className={styles.headerActions}>
                <Link 
                  href="/admin/dashboard"
                  className={`${styles.actionButton} ${styles.secondary}`}
                >
                  <ArrowLeft size={20} />
                  Volver al Dashboard
                </Link>
              </div>
            </div>

            {/* Email Form */}
            <div className={styles.tableContainer}>
              <div style={{ padding: '2rem' }}>
                <div className={styles.subscriptionStats}>
                  <h3>Configuración del Email</h3>
                  
                  <div className={styles.filtersSection}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Recipients */}
                      <div className={styles.formGroup}>
                        <label style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Destinatarios
                        </label>
                        <select
                          value={emailData.recipients}
                          onChange={(e) => setEmailData(prev => ({ ...prev, recipients: e.target.value }))}
                          className={styles.searchInput}
                          style={{ width: '300px' }}
                        >
                          <option value="all">Todos los usuarios</option>
                          <option value="suscriptores">Solo suscriptores</option>
                          <option value="admins">Solo administradores</option>
                        </select>
                      </div>

                      {/* Subject */}
                      <div className={styles.formGroup}>
                        <label style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Asunto del Email
                        </label>
                        <input
                          type="text"
                          value={emailData.subject}
                          onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="Ej: Actualización importante del sistema"
                          className={styles.searchInput}
                          style={{ width: '100%' }}
                        />
                      </div>

                      {/* Message */}
                      <div className={styles.formGroup}>
                        <label style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Mensaje
                        </label>
                        <textarea
                          value={emailData.message}
                          onChange={(e) => setEmailData(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Escribe tu mensaje aquí..."
                          className={styles.searchInput}
                          style={{ 
                            width: '100%', 
                            minHeight: '200px', 
                            resize: 'vertical',
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>

                      {/* Button Configuration */}
                      <div className={styles.formGroup}>
                        <label style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Configuración del Botón (opcional)
                        </label>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <input
                              type="text"
                              value={emailData.buttonText}
                              onChange={(e) => setEmailData(prev => ({ ...prev, buttonText: e.target.value }))}
                              placeholder="Texto del botón"
                              className={styles.searchInput}
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div style={{ flex: 2, minWidth: '300px' }}>
                            <input
                              type="url"
                              value={emailData.buttonUrl}
                              onChange={(e) => setEmailData(prev => ({ ...prev, buttonUrl: e.target.value }))}
                              placeholder="URL del botón"
                              className={styles.searchInput}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                          El botón aparecerá al final del email para que los usuarios puedan visitar el sitio web
                        </p>
                      </div>

                      {/* Images Upload */}
                      <div className={styles.formGroup}>
                        <label style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Imágenes para el Email (opcional)
                        </label>
                        
                        {/* Image Uploader */}
                        <ImageUploader
                          onImageUploaded={handleImageUploaded}
                          onUploadStart={handleImageUploadStart}
                          onError={handleImageUploadError}
                          maxFiles={5}
                          maxSizeBytes={5 * 1024 * 1024} // 5MB
                          allowedFormats={['jpeg', 'jpg', 'png', 'gif', 'webp']}
                          buttonText="Subir Imágenes"
                          multiple={true}
                          className="email-images-uploader"
                        />

                        {/* Display uploaded images */}
                        {emailImages.length > 0 && (
                          <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                              Imágenes subidas ({emailImages.length}):
                            </h4>
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                              gap: '1rem' 
                            }}>
                              {emailImages.map((image) => (
                                <div key={image.public_id} style={{ position: 'relative' }}>
                                  <img
                                    src={image.secure_url}
                                    alt="Imagen del email"
                                    style={{
                                      width: '100%',
                                      height: '100px',
                                      objectFit: 'cover',
                                      borderRadius: '8px',
                                      border: '2px solid var(--border)'
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(image.public_id)}
                                    style={{
                                      position: 'absolute',
                                      top: '4px',
                                      right: '4px',
                                      background: 'rgba(239, 68, 68, 0.9)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '50%',
                                      width: '24px',
                                      height: '24px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                    title="Eliminar imagen"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Send Button */}
                      <div className={styles.formGroup}>
                        <button
                          onClick={sendBulkEmail}
                          disabled={loading || !emailData.subject.trim() || !emailData.message.trim()}
                          className={`${styles.actionButton} ${styles.primary}`}
                          style={{ width: 'auto' }}
                        >
                          <Send size={20} />
                          {loading ? 'Enviando...' : 'Enviar Email Masivo'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Warning */}
                  <div className={styles.subscriptionCard} style={{ marginTop: '2rem', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                    <div className={styles.subscriptionIcon} style={{ backgroundColor: '#f59e0b' }}>
                      <AlertCircle size={20} />
                    </div>
                    <div className={styles.subscriptionInfo}>
                      <h4>Importante</h4>
                      <p>Usa esta función con responsabilidad:</p>
                      <ul style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        <li>Verifica el contenido antes de enviar</li>
                        <li>El envío no se puede deshacer</li>
                        <li>Se enviará a todos los usuarios del grupo seleccionado</li>
                        <li>Evita el spam respetando la frecuencia de envíos</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Mail size={24} className={styles.iconBlue} />
                </div>
                <div className={styles.statInfo}>
                  <h3>Email</h3>
                  <p>Canal de Comunicación</p>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Users size={24} className={styles.iconGreen} />
                </div>
                <div className={styles.statInfo}>
                  <h3>Masivo</h3>
                  <p>Alcance del Envío</p>
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <CheckCircle size={24} className={styles.iconGold} />
                </div>
                <div className={styles.statInfo}>
                  <h3>Eficiente</h3>
                  <p>Comunicación Directa</p>
                </div>
              </div>
            </div>

            {/* Test de Emails de Reservas */}
            <div className={styles.tableContainer} style={{ marginTop: '2rem' }}>
              <div style={{ padding: '2rem' }}>
                <div className={styles.subscriptionStats}>
                  <h3>🧪 Test de Emails de Reservas</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Prueba los emails de confirmación de reservas y notificaciones
                  </p>
                  
                  <div className={styles.filtersSection}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Test Email Input */}
                      <div className={styles.formGroup}>
                        <label style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          📧 Email de Prueba
                        </label>
                        <input
                          type="email"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          placeholder="usuario@ejemplo.com"
                          className={styles.searchInput}
                          style={{ width: '100%', maxWidth: '400px' }}
                        />
                      </div>

                      {/* Test Buttons */}
                      <div className={styles.formGroup}>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleTestEmail('simple')}
                            disabled={testLoading || !testEmail}
                            className={`${styles.actionButton} ${styles.primary}`}
                            style={{ width: 'auto' }}
                          >
                            <CheckCircle size={20} />
                            {testLoading ? 'Enviando...' : '📧 Test Simple'}
                          </button>
                          
                          <button
                            onClick={() => handleTestEmail('advisory_confirmation')}
                            disabled={testLoading || !testEmail}
                            className={`${styles.actionButton} ${styles.secondary}`}
                            style={{ width: 'auto' }}
                          >
                            <Mail size={20} />
                            {testLoading ? 'Enviando...' : '🩺 Test Confirmación Asesoría'}
                          </button>
                          
                          <button
                            onClick={() => handleTestEmail('admin_notification')}
                            disabled={testLoading || !testEmail}
                            className={`${styles.actionButton} ${styles.tertiary}`}
                            style={{ width: 'auto' }}
                          >
                            <AlertCircle size={20} />
                            {testLoading ? 'Enviando...' : '🔔 Test Notificación Admin'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Test Info */}
                  <div className={styles.subscriptionCard} style={{ marginTop: '2rem', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                    <div className={styles.subscriptionIcon} style={{ backgroundColor: '#10b981' }}>
                      <CheckCircle size={20} />
                    </div>
                    <div className={styles.subscriptionInfo}>
                      <h4>Información de Test</h4>
                      <ul style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        <li>• <strong>Test Simple:</strong> Email básico de prueba para verificar configuración SMTP</li>
                        <li>• <strong>Test Confirmación Asesoría:</strong> Email que recibe el usuario al reservar una asesoría</li>
                        <li>• <strong>Test Notificación Admin:</strong> Email que recibe el administrador cuando hay una nueva reserva</li>
                        <li>• Los emails de test usan datos de ejemplo</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Gestión de Lista de Emails */}
            <div className={styles.tableContainer} style={{ marginTop: '2rem' }}>
              <div style={{ padding: '2rem' }}>
                <div className={styles.subscriptionStats}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3>📧 Gestión de Lista de Emails</h3>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <button
                        onClick={exportToCSV}
                        disabled={exportLoading}
                        className={`${styles.actionButton} ${styles.secondary}`}
                        style={{ width: 'auto' }}
                      >
                        <Download size={20} />
                        {exportLoading ? 'Exportando...' : 'Exportar CSV'}
                      </button>
                      <button
                        onClick={() => setShowImportModal(true)}
                        className={`${styles.actionButton} ${styles.primary}`}
                        style={{ width: 'auto' }}
                      >
                        <Upload size={20} />
                        Importar CSV
                      </button>
                      <button
                        onClick={() => setShowAddEmail(!showAddEmail)}
                        className={`${styles.actionButton} ${styles.primary}`}
                        style={{ width: 'auto' }}
                      >
                        <Plus size={20} />
                        Agregar Email
                      </button>
                    </div>
                  </div>

                  {/* Formulario para agregar email */}
                  {showAddEmail && (
                    <div className={styles.subscriptionCard} style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                      <h4 style={{ marginBottom: '1rem' }}>Agregar Email a la Lista</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                            Email *
                          </label>
                          <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="ejemplo@gmail.com"
                            className={styles.searchInput}
                            style={{ width: '100%', maxWidth: '400px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button
                            onClick={addEmail}
                            className={`${styles.actionButton} ${styles.primary}`}
                            style={{ width: 'auto' }}
                          >
                            <Plus size={20} />
                            Agregar Email
                          </button>
                          <button
                            onClick={() => setShowAddEmail(false)}
                            className={`${styles.actionButton} ${styles.secondary}`}
                            style={{ width: 'auto' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Estadísticas */}
                  {emailStats && (
                    <div className={styles.statsGrid} style={{ marginBottom: '1.5rem' }}>
                      <div className={styles.statCard}>
                        <div className={styles.statIcon}>
                          <Mail size={24} className={styles.iconBlue} />
                        </div>
                        <div className={styles.statInfo}>
                          <h3>{emailStats.total}</h3>
                          <p>Total Emails</p>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statIcon}>
                          <CheckCircle size={24} className={styles.iconGreen} />
                        </div>
                        <div className={styles.statInfo}>
                          <h3>{emailStats.active}</h3>
                          <p>Activos</p>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statIcon}>
                          <Users size={24} className={styles.iconGold} />
                        </div>
                        <div className={styles.statInfo}>
                          <h3>{emailStats.bySource?.manual?.active || 0}</h3>
                          <p>Manuales</p>
                        </div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statIcon}>
                          <RefreshCw size={24} className={styles.iconPurple} />
                        </div>
                        <div className={styles.statInfo}>
                          <h3>{emailStats.bySource?.registration?.active || 0}</h3>
                          <p>Registros</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filtros y búsqueda */}
                  <div className={styles.filtersSection} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Search size={20} />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar email..."
                          className={styles.searchInput}
                          style={{ width: '200px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Filter size={20} />
                        <select
                          value={filterSource}
                          onChange={(e) => setFilterSource(e.target.value)}
                          className={styles.searchInput}
                          style={{ width: '150px' }}
                        >
                          <option value="all">Todos</option>
                          <option value="manual">Manual</option>
                          <option value="registration">Registro</option>
                          <option value="import">Importado</option>
                        </select>
                      </div>
                      <button
                        onClick={fetchEmailList}
                        className={`${styles.actionButton} ${styles.secondary}`}
                        style={{ width: 'auto' }}
                      >
                        <RefreshCw size={20} />
                        Actualizar
                      </button>
                    </div>
                  </div>

                  {/* Lista de emails */}
                  <div className={styles.tableContainer}>
                    {emailListLoading ? (
                      <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <RefreshCw size={24} className="animate-spin" />
                        <p style={{ marginTop: '1rem' }}>Cargando lista de emails...</p>
                      </div>
                    ) : emailList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <Mail size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No hay emails en la lista</p>
                      </div>
                    ) : (
                      <div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Email</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fuente</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Agregado</th>
                                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Estado</th>
                                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {emailList.map((emailItem: any) => (
                                <tr key={emailItem._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '1rem' }}>
                                    <div style={{ fontWeight: '500' }}>{emailItem.email}</div>
                                  </td>
                                  <td style={{ padding: '1rem' }}>
                                    <span style={{
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: '500',
                                      backgroundColor: emailItem.source === 'manual' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                      color: emailItem.source === 'manual' ? '#10b981' : '#3b82f6'
                                    }}>
                                      {emailItem.source === 'manual' ? 'Manual' : 
                                       emailItem.source === 'registration' ? 'Registro' : 'Importado'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    {new Date(emailItem.addedAt).toLocaleDateString('es-ES')}
                                  </td>
                                  <td style={{ padding: '1rem' }}>
                                    <span style={{
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: '500',
                                      backgroundColor: emailItem.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                      color: emailItem.isActive ? '#10b981' : '#ef4444'
                                    }}>
                                      {emailItem.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <button
                                      onClick={() => removeEmail(emailItem.email)}
                                      className={`${styles.actionButton} ${styles.danger}`}
                                      style={{ width: 'auto', padding: '0.5rem' }}
                                      title="Eliminar email"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Paginación */}
                        {totalPages > 1 && (
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className={`${styles.actionButton} ${styles.secondary}`}
                              style={{ width: 'auto' }}
                            >
                              Anterior
                            </button>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              Página {currentPage} de {totalPages}
                            </span>
                            <button
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              className={`${styles.actionButton} ${styles.secondary}`}
                              style={{ width: 'auto' }}
                            >
                              Siguiente
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Modal para importar CSV */}
      {showImportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '1.5rem', color: '#1f2937' }}>
              📥 Importar Emails desde CSV
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
                Selecciona un archivo CSV con el siguiente formato:
              </p>
              <div style={{ 
                backgroundColor: '#f9fafb', 
                padding: '1rem', 
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                fontFamily: 'monospace'
              }}>
                <div>email</div>
                <div>ejemplo@email.com</div>
                <div>usuario@test.com</div>
                <div>admin@empresa.com</div>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                <strong>Nota:</strong> El archivo debe contener solo una columna con emails. 
                Todos los emails importados se marcarán automáticamente como "importados".
              </p>
              <div style={{ 
                backgroundColor: '#d1fae5', 
                border: '1px solid #10b981', 
                borderRadius: '8px', 
                padding: '1rem', 
                marginBottom: '1rem' 
              }}>
                <p style={{ margin: 0, color: '#065f46', fontSize: '0.875rem' }}>
                  <strong>✅ Procesamiento asíncrono:</strong> Puedes importar archivos grandes sin límite. 
                  El procesamiento se realizará en segundo plano y recibirás una notificación cuando termine.
                </p>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Archivo CSV *
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                />
                {csvFile && (
                  <p style={{ marginTop: '0.5rem', color: '#10b981', fontSize: '0.875rem' }}>
                    ✅ Archivo seleccionado: {csvFile.name}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setCsvFile(null);
                }}
                className={`${styles.actionButton} ${styles.secondary}`}
                style={{ width: 'auto' }}
              >
                Cancelar
              </button>
              <button
                onClick={importFromCSV}
                disabled={!csvFile || importLoading}
                className={`${styles.actionButton} ${styles.primary}`}
                style={{ width: 'auto' }}
              >
                <Upload size={20} />
                {importLoading ? 'Importando...' : 'Importar'}
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
  console.log('🔍 [BULK EMAIL] Iniciando verificación de acceso...');
  
  try {
    // Usar la función de verificación que ya sabemos que funciona
    const verification = await verifyAdminAccess(context);
    
    console.log('🔍 [BULK EMAIL] Resultado de verificación:', verification);
    
    if (!verification.isAdmin) {
      console.log('❌ [BULK EMAIL] Acceso denegado - redirigiendo a:', verification.redirectTo);
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    console.log('✅ [BULK EMAIL] Acceso de admin confirmado para:', verification.user?.email);
    
    return {
      props: {
        user: verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [BULK EMAIL] Error en getServerSideProps:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
}; 