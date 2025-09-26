import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Users, 
  Bell, 
  FileText, 
  Database,
  UserCheck,
  TrendingUp,
  Mail,
  DollarSign,
  Activity,
  Settings,
  Download,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Trash2,
  AlertTriangle,
  BookOpen,
  Map,
  Edit,
  X,
  Save,
  Target,
  RefreshCw,
  Loader,
  Percent
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import User from '@/models/User';
import styles from '@/styles/AdminDashboard.module.css';
import dbConnect from '@/lib/mongodb';
import toast from 'react-hot-toast';
import AdminDropdownTest from '@/components/AdminDropdownTest';

interface DashboardStats {
  totalUsers: number;
  adminUsers: number;
  suscriptorUsers: number;
  normalUsers: number;
  totalNotifications: number;
  activeNotifications: number;
  recentActivity: any[];
}

interface AdminDashboardProps {
  user: any;
}

interface RoadmapTopic {
  titulo: string;
  descripcion?: string;
}

interface RoadmapModule {
  id: number;
  titulo: string;
  descripcion: string;
  duracion: string;
  lecciones: number;
  temas: RoadmapTopic[];
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  prerequisito?: number;
  orden: number;
  activo: boolean;
}

interface Roadmap {
  _id: string;
  nombre: string;
  descripcion: string;
  tipoEntrenamiento: 'SwingTrading' | 'DayTrading' | 'DowJones' | 'General';
  modulos: RoadmapModule[];
  activo: boolean;
  orden: number;
  metadatos: {
    totalLecciones: number;
    totalHoras: number;
    autor: string;
    version: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Memoizar las secciones del dashboard para evitar re-renders innecesarios
const useDashboardSections = () => {
  return useMemo(() => [
    {
      id: 'roadmaps',
      title: 'Gestión de Roadmaps',
      description: 'Crea y gestiona los roadmaps de aprendizaje para Swing Trading, Day Trading y otros entrenamientos. Sistema dinámico que reemplaza el contenido hardcodeado.',
      icon: <Map size={32} />,
      color: 'from-cyan-500 to-blue-500',
      links: [
        { label: 'Gestionar Roadmaps', href: '#roadmaps-modal', icon: <Map size={16} /> },
        { label: 'Swing Trading', href: '#roadmaps-modal', icon: <TrendingUp size={16} /> },
        { label: 'Day Trading', href: '#roadmaps-modal', icon: <Target size={16} /> }
      ]
    },
    {
      id: 'siteconfig',
      title: 'Configuración del Sitio',
      description: 'Configura todos los videos de YouTube del sitio web, secciones del landing page y elementos visuales.',
      icon: <Settings size={32} />,
      color: 'from-violet-500 to-purple-500',
      links: [
        { label: 'Dashboard de Precios', href: '/admin/pricing', icon: <DollarSign size={16} /> },
        { label: 'Configuración de Videos', href: '/admin/video-config', icon: <Settings size={16} /> },
        { label: 'Configuración General', href: '/admin/site-config', icon: <FileText size={16} /> },
        { label: 'Analíticas', href: '/admin/analytics', icon: <BarChart3 size={16} /> },
        { label: 'Ver Landing', href: '/', icon: <TrendingUp size={16} /> }
      ]
    },
    {
      id: 'lecciones',
      title: 'Gestión de Lecciones',
      description: 'Crea, edita y administra las lecciones de los entrenamientos SwingTrading y DayTrading. Sistema completo de contenido educativo con soporte para videos, PDFs, imágenes y más.',
      icon: <BookOpen size={32} />,
      color: 'from-red-500 to-rose-500',
      links: [
        { label: 'Gestionar Lecciones', href: '/admin/lecciones', icon: <BookOpen size={16} /> },
        { label: 'Swing Trading', href: '/admin/lecciones?tipo=SwingTrading', icon: <FileText size={16} /> },
        { label: 'Day Trading', href: '/admin/lecciones?tipo=DayTrading', icon: <TrendingUp size={16} /> }
      ]
    },
    {
      id: 'users',
      title: 'Gestión de Usuarios',
      description: 'Carga y modificación de información de usuario',
      icon: <Users size={32} />,
      color: 'from-green-500 to-emerald-500',
      links: [
        { label: 'Lista de Usuarios', href: '/admin/users', icon: <Users size={16} /> },
        { label: 'Usuarios Activos', href: '/admin/users/active', icon: <UserCheck size={16} /> },
        { label: 'Gestión de Roles', href: '/admin/users/roles', icon: <Settings size={16} /> }
      ]
    },
    {
      id: 'schedules',
      title: 'Gestión de Horarios',
      description: 'Envío centralizado de links de reunión para asesorías y entrenamientos programados. Lista de sesiones próximas ordenadas por proximidad para gestión eficiente.',
      icon: <Calendar size={32} />,
      color: 'from-indigo-500 to-purple-500',
      links: [
        { label: 'Horarios Asesorías', href: '/admin/asesorias-horarios', icon: <Clock size={16} /> },
        { label: 'Fechas Asesorías', href: '/admin/asesorias-fechas', icon: <Calendar size={16} /> },
        { label: 'Horarios Entrenamientos', href: '/admin/entrenamientos-fechas', icon: <Calendar size={16} /> },
        { label: 'Enviar Link de Reunión', href: '/admin/horarios', icon: <Settings size={16} /> },
        { label: 'Próximas Sesiones Swing', href: '/admin/upcoming-training', icon: <Calendar size={16} /> }
      ]
    },
    {
      id: 'database',
      title: 'Base de Datos',
      description: 'Información de contacto de los clientes para poder contactarlos por fuera de la web. Envíos de mails masivos, lanzamientos, problema con los pagos, etc',
      icon: <Database size={32} />,
      color: 'from-purple-500 to-violet-500',
      links: [
        { label: 'Exportar Contactos', href: '/admin/export/contacts', icon: <Download size={16} /> },
        { label: 'Envío Masivo', href: '/admin/email/bulk', icon: <Mail size={16} /> },
        { label: 'Gestión de BD', href: '/admin/database', icon: <Database size={16} /> }
      ]
    },
    {
      id: 'billing',
      title: 'Facturación',
      description: 'Descarga de información para facturación (Planilla excel con Nombre, Apellido, CUIT/CUIL, Monto abonado, Fecha)',
      icon: <FileText size={32} />,
      color: 'from-amber-500 to-orange-500',
      links: [
        { label: 'Generar Reporte', href: '/admin/billing/generate', icon: <FileText size={16} /> },
        { label: 'Exportar Excel', href: '/admin/billing/export', icon: <Download size={16} /> },
        { label: 'Historial', href: '/admin/billing/history', icon: <Activity size={16} /> }
      ]
    },
    {
      id: 'subscriptions',
      title: 'Suscripciones y Pagos',
      description: 'Gestiona las suscripciones activas, verifica pagos entrantes, controla expiraciones y administra el historial de transacciones de MercadoPago.',
      icon: <DollarSign size={32} />,
      color: 'from-green-500 to-emerald-500',
      links: [
        { label: 'Gestión de Suscripciones', href: '/admin/subscriptions', icon: <Users size={16} /> },
        { label: 'Ver Pagos', href: '/admin/subscriptions', icon: <DollarSign size={16} /> },
        { label: 'Expiraciones Próximas', href: '/admin/subscriptions', icon: <AlertTriangle size={16} /> }
      ]
    },
    {
      id: 'pricing',
      title: 'Gestión de Precios',
      description: 'Administra todos los precios del sitio web de forma centralizada. Configura precios de alertas, entrenamientos y asesorías, aplica descuentos y cambia divisas en tiempo real.',
      icon: <TrendingUp size={32} />,
      color: 'from-blue-500 to-indigo-500',
      links: [
        { label: 'Dashboard de Precios', href: '/admin/pricing', icon: <DollarSign size={16} /> },
        { label: 'Configurar Descuentos', href: '/admin/pricing', icon: <Percent size={16} /> },
        { label: 'Cambiar Moneda', href: '/admin/pricing', icon: <RefreshCw size={16} /> }
      ]
    }
  ], []);
};

export default function AdminDashboardPage({ user }: AdminDashboardProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    adminUsers: 0,
    suscriptorUsers: 0,
    normalUsers: 0,
    totalNotifications: 0,
    activeNotifications: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [fixingLogins, setFixingLogins] = useState(false);
  const [closingMarket, setClosingMarket] = useState(false);

  // Estados para gestión de roadmaps
  const [showRoadmapsModal, setShowRoadmapsModal] = useState(false);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [roadmapsLoading, setRoadmapsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  
  // Estados para manejo de errores de roadmaps
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');

  // Estado del formulario de roadmaps
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipoEntrenamiento: 'SwingTrading' as 'SwingTrading' | 'DayTrading' | 'DowJones' | 'General',
    modulos: [] as RoadmapModule[],
    activo: true,
    orden: 1
  });

  // Estados para gestión de módulos
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModuleIndex, setEditingModuleIndex] = useState<number | null>(null);
  const [moduleFormData, setModuleFormData] = useState({
    titulo: '',
    descripcion: '',
    duracion: '',
    lecciones: 1,
    dificultad: 'Básico' as 'Básico' | 'Intermedio' | 'Avanzado',
    prerequisito: undefined as string | undefined,
    activo: true,
    temas: [{ titulo: '', descripcion: '' }]
  });

  // Estados para módulos independientes
  const [roadmapModules, setRoadmapModules] = useState<any[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [editingModule, setEditingModule] = useState<any>(null);

  const dashboardSections = useDashboardSections();

  // Optimizar la función de fetch con useCallback
  const fetchDashboardStats = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📊 Dashboard - Cargando estadísticas...');
      
      // Usar AbortController para cancelar requests si el componente se desmonta
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
      
      const response = await fetch('/api/admin/dashboard/stats', {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Dashboard - Estadísticas cargadas:', data);
        setStats(data);
      } else {
        console.error('❌ Dashboard - Error al cargar estadísticas:', response.status);
        // Mostrar datos por defecto en caso de error
        setStats(prev => ({ ...prev }));
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('💥 Dashboard - Error al cargar estadísticas:', error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Función para cargar roadmaps
  const fetchRoadmaps = useCallback(async () => {
    try {
      setRoadmapsLoading(true);
      const params = new URLSearchParams();
      if (selectedType !== 'all') params.set('tipo', selectedType);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/roadmaps?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setRoadmaps(data.data.roadmaps || []);
      } else {
        toast.error('Error al cargar roadmaps');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setRoadmapsLoading(false);
    }
  }, [selectedType, searchTerm]);

  // Validar formulario de roadmaps
  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    if (!formData.nombre.trim()) {
      errors.nombre = 'El nombre es obligatorio';
    } else if (formData.nombre.length < 3) {
      errors.nombre = 'El nombre debe tener al menos 3 caracteres';
    }

    if (!formData.descripcion.trim()) {
      errors.descripcion = 'La descripción es obligatoria';
    } else if (formData.descripcion.length < 10) {
      errors.descripcion = 'La descripción debe tener al menos 10 caracteres';
    }

    if (formData.orden < 1) {
      errors.orden = 'El orden debe ser mayor a 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Crear roadmap
  const handleCreateRoadmap = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/roadmaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Roadmap creado exitosamente');
        setShowCreateModal(false);
        resetForm();
        fetchRoadmaps();
      } else {
        setSubmitError(data.error || 'Error al crear roadmap');
      }
    } catch (error) {
      console.error('Error:', error);
      setSubmitError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Editar roadmap
  const handleEditRoadmap = async () => {
    if (!editingRoadmap || !validateForm()) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch(`/api/roadmaps/${editingRoadmap._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Roadmap actualizado exitosamente');
        setEditingRoadmap(null);
        resetForm();
        fetchRoadmaps();
      } else {
        setSubmitError(data.error || 'Error al actualizar roadmap');
      }
    } catch (error) {
      console.error('Error:', error);
      setSubmitError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar roadmap
  const handleDeleteRoadmap = async (roadmapId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este roadmap?')) return;

    try {
      const response = await fetch(`/api/roadmaps/${roadmapId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Roadmap eliminado exitosamente');
        fetchRoadmaps();
      } else {
        toast.error(data.error || 'Error al eliminar roadmap');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      tipoEntrenamiento: 'SwingTrading',
      modulos: [],
      activo: true,
      orden: 1
    });
    setFormErrors({});
    setSubmitError('');
    setRoadmapModules([]); // Limpiar módulos independientes
    resetModuleForm();
  };

  // Resetear formulario de módulo
  const resetModuleForm = () => {
    setModuleFormData({
      titulo: '',
      descripcion: '',
      duracion: '',
      lecciones: 1,
      dificultad: 'Básico',
      prerequisito: undefined,
      activo: true,
      temas: [{ titulo: '', descripcion: '' }]
    });
    setEditingModuleIndex(null);
    setEditingModule(null);
    setShowModuleForm(false);
  };

  // Cargar módulos del roadmap actual
  const fetchRoadmapModules = async (roadmapId: string) => {
    if (!roadmapId) return;
    
    try {
      setLoadingModules(true);
      const response = await fetch(`/api/modules/roadmap/${roadmapId}`);
      const data = await response.json();
      
      if (data.success) {
        setRoadmapModules(data.data.modules || []);
      } else {
        toast.error('Error al cargar módulos del roadmap');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión al cargar módulos');
    } finally {
      setLoadingModules(false);
    }
  };

  // Agregar tema al módulo
  const addTema = () => {
    setModuleFormData(prev => ({
      ...prev,
      temas: [...prev.temas, { titulo: '', descripcion: '' }]
    }));
  };

  // Remover tema del módulo
  const removeTema = (index: number) => {
    if (moduleFormData.temas.length > 1) {
      setModuleFormData(prev => ({
        ...prev,
        temas: prev.temas.filter((_, i) => i !== index)
      }));
    }
  };

  // Actualizar tema
  const updateTema = (index: number, field: 'titulo' | 'descripcion', value: string) => {
    setModuleFormData(prev => ({
      ...prev,
      temas: prev.temas.map((tema, i) => 
        i === index ? { ...tema, [field]: value } : tema
      )
    }));
  };

  // Guardar módulo independiente
  const saveModule = async () => {
    // Validar módulo
    if (!moduleFormData.titulo.trim()) {
      toast.error('El nombre del módulo es obligatorio');
      return;
    }
    if (!moduleFormData.descripcion.trim()) {
      toast.error('La descripción del módulo es obligatoria');
      return;
    }
    if (moduleFormData.temas.some(tema => !tema.titulo.trim())) {
      toast.error('Todos los temas deben tener título');
      return;
    }

    if (!editingRoadmap) {
      toast.error('No hay roadmap seleccionado');
      return;
    }

    setIsSubmitting(true);
    try {
      const moduleData = {
        nombre: moduleFormData.titulo, // El API espera 'nombre' pero el frontend usa 'titulo'
        descripcion: moduleFormData.descripcion,
        roadmapId: editingRoadmap._id,
        tipoEntrenamiento: editingRoadmap.tipoEntrenamiento,
        duracion: moduleFormData.duracion,
        lecciones: moduleFormData.lecciones,
        temas: moduleFormData.temas.filter(tema => tema.titulo.trim()),
        dificultad: moduleFormData.dificultad,
        prerequisito: moduleFormData.prerequisito || null,
        orden: editingModule ? editingModule.orden : roadmapModules.length + 1,
        activo: moduleFormData.activo
      };

      let response;
      if (editingModule) {
        // Actualizar módulo existente
        response = await fetch(`/api/modules/${editingModule._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(moduleData)
        });
      } else {
        // Crear nuevo módulo
        response = await fetch('/api/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(moduleData)
        });
      }

      const data = await response.json();

      if (data.success) {
        toast.success(editingModule ? 'Módulo actualizado exitosamente' : 'Módulo creado exitosamente');
        resetModuleForm();
        // Recargar módulos del roadmap
        fetchRoadmapModules(editingRoadmap._id);
      } else {
        toast.error(data.error || 'Error al guardar módulo');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Editar módulo
  const editModule = (module: any) => {
    setEditingModule(module);
    setModuleFormData({
      titulo: module.nombre, // El módulo viene con 'nombre' pero el formulario usa 'titulo'
      descripcion: module.descripcion,
      duracion: module.duracion,
      lecciones: module.lecciones,
      dificultad: module.dificultad,
      prerequisito: module.prerequisito?._id || undefined,
      activo: module.activo,
      temas: module.temas.length > 0 
        ? module.temas.map((tema: any) => ({
            titulo: tema.titulo,
            descripcion: tema.descripcion || ''
          }))
        : [{ titulo: '', descripcion: '' }]
    });
    setShowModuleForm(true);
  };

  // Eliminar módulo
  const deleteModule = async (module: any) => {
    if (!confirm(`¿Estás seguro de eliminar el módulo "${module.nombre}"?`)) return;

    try {
      const response = await fetch(`/api/modules/${module._id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Módulo eliminado exitosamente');
        // Recargar módulos del roadmap
        if (editingRoadmap) {
          fetchRoadmapModules(editingRoadmap._id);
        }
      } else {
        toast.error(data.error || 'Error al eliminar módulo');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    }
  };

  // Abrir modal de edición (actualizado)
  const openEditModal = (roadmap: Roadmap) => {
    setEditingRoadmap(roadmap);
    setFormData({
      nombre: roadmap.nombre,
      descripcion: roadmap.descripcion,
      tipoEntrenamiento: roadmap.tipoEntrenamiento,
      modulos: roadmap.modulos,
      activo: roadmap.activo,
      orden: roadmap.orden
    });
    setShowCreateModal(true);
    // Cargar módulos independientes del roadmap
    fetchRoadmapModules(roadmap._id);
  };

  // Optimizar la función de corrección de logins
  const fixLoginDates = useCallback(async () => {
    try {
      setFixingLogins(true);
      console.log('🔧 Iniciando corrección de fechas de login...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos para esta operación
      
      const response = await fetch('/api/admin/users/fix-login-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Corrección completada:', data);
        
        if (data.updated > 0) {
          alert(`✅ Se actualizaron ${data.updated} usuarios con fechas de último login`);
          // Recargar estadísticas
          fetchDashboardStats();
        } else {
          alert('ℹ️ Todos los usuarios ya tienen fecha de último login configurada');
        }
      } else {
        console.error('❌ Error en corrección:', response.status);
        alert('❌ Error al corregir fechas de login');
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('💥 Error al corregir fechas:', error);
        alert('💥 Error al corregir fechas de login');
      }
    } finally {
      setFixingLogins(false);
    }
  }, [fetchDashboardStats]);

  // Función para cerrar el mercado y procesar alertas de rango
  const handleCloseMarket = useCallback(async () => {
    try {
      setClosingMarket(true);
      console.log('🔄 Iniciando cierre de mercado...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos para esta operación
      
      const response = await fetch('/api/alerts/close-market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Cierre de mercado completado:', data);
        alert(`✅ Cierre de mercado completado!\n\n📊 Alertas procesadas: ${data.processedAlerts}\n📧 Emails enviados: ${data.emailsSent}`);
      } else {
        const errorData = await response.json();
        console.error('❌ Error en cierre de mercado:', errorData);
        alert(`❌ Error: ${errorData.error || 'No se pudo cerrar el mercado'}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('💥 Error al cerrar mercado:', error);
        alert('💥 Error al cerrar el mercado');
      }
    } finally {
      setClosingMarket(false);
    }
  }, []);

  // Manejar click en links de roadmaps
  const handleRoadmapLinkClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (href === '#roadmaps-modal') {
      setShowRoadmapsModal(true);
      fetchRoadmaps();
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Memoizar las estadísticas para evitar re-renders
  const statsCards = useMemo(() => [
    {
      icon: <Users size={24} className={styles.iconBlue} />,
      value: stats.totalUsers,
      label: 'Total Usuarios'
    },
    {
      icon: <UserCheck size={24} className={styles.iconGreen} />,
      value: stats.adminUsers,
      label: 'Administradores'
    },
    {
      icon: <Bell size={24} className={styles.iconPurple} />,
      value: stats.activeNotifications,
      label: 'Notificaciones Activas'
    },
    {
      icon: <TrendingUp size={24} className={styles.iconAmber} />,
      value: stats.suscriptorUsers,
      label: 'Suscriptores'
    }
  ], [stats]);

  return (
    <>
      <Head>
        <title>Dashboard de Administrador - Lozano Nahuel</title>
        <meta name="description" content="Panel de administración para gestionar usuarios, notificaciones y contenido" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <Navbar />
      
      <main className={`${styles.main} admin-dashboard`}>
        <div className={styles.container}>
          <motion.div
            className={styles.content}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header del Dashboard */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={styles.headerIcon}>
                  <BarChart3 size={30} />
                </div>
                <div>
                  <h1 className={styles.title}>Dashboard de Administrador</h1>
                  <p className={styles.subtitle}>
                    Gestiona usuarios, notificaciones, contenido y monitorea la actividad del sistema
                  </p>
                </div>
              </div>
              
              <div className={styles.headerActions}>
                <Link href="/admin/users" className={styles.actionButton}>
                  <Users size={20} />
                  Gestionar Usuarios
                </Link>
                <Link href="/admin/notifications" className={styles.actionButton}>
                  <Bell size={20} />
                  Notificaciones
                </Link>
              </div>
            </div>

            {/* Quick Stats */}
            <div className={styles.statsGrid}>
              {statsCards.map((stat, index) => (
                <motion.div
                  key={index}
                  className={styles.statCard}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className={styles.statIcon}>
                    {stat.icon}
                  </div>
                  <div className={styles.statInfo}>
                    <h3>{loading ? '...' : stat.value}</h3>
                    <p>{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Main Dashboard Sections */}
            <div className={styles.sectionsGrid}>
              {dashboardSections.map((section, index) => {
                // Definir qué secciones ocultar
                const hiddenSections = ['billing', 'pricing', 'database'];
                const isHidden = hiddenSections.includes(section.id);
                
                return (
                <motion.div
                  key={section.id}
                  className={`${styles.sectionCard} ${isHidden ? styles.hiddenSection : ''}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className={`${styles.sectionHeader} ${styles[section.id]}`}>
                    <div className={`${styles.sectionIcon} bg-gradient-to-br ${section.color}`}>
                      {section.icon}
                    </div>
                    <div className={styles.sectionInfo}>
                      <h3 className={styles.sectionTitle}>{section.title}</h3>
                      <p className={styles.sectionDescription}>{section.description}</p>
                    </div>
                  </div>

                  <div className={styles.sectionActions}>
                    {section.links.map((link, linkIndex) => {
                      // Definir qué enlaces ocultar
                      const hiddenLinks = [
                        'Ver Pagos',
                        'Expiraciones Próximas',
                        'Horarios Asesorías',
                        'Enviar Link de Reunión',
                        'Exportar Contactos',
                        'Gestión de BD',
                        'Day Trading'
                      ];
                      const isLinkHidden = hiddenLinks.includes(link.label);
                      
                      return section.id === 'roadmaps' ? (
                        <button
                          key={linkIndex}
                          onClick={(e) => handleRoadmapLinkClick(e, link.href)}
                          className={`${styles.sectionLink} ${isLinkHidden ? styles.hiddenLink : ''}`}
                        >
                          {link.icon}
                          <span>{link.label}</span>
                        </button>
                      ) : (
                      <Link
                        key={linkIndex}
                        href={link.href}
                        className={`${styles.sectionLink} ${isLinkHidden ? styles.hiddenLink : ''}`}
                      >
                        {link.icon}
                        <span>{link.label}</span>
                      </Link>
                      );
                    })}
                  </div>
                </motion.div>
                );
              })}
            </div>

            {/* Sección de herramientas de administración */}
            <div className={`${styles.adminTools} ${styles.hiddenSection}`}>
              <h2 className={styles.toolsTitle}>Herramientas de Sistema</h2>
              <div className={styles.toolsGrid}>
                <button
                  onClick={fixLoginDates}
                  disabled={fixingLogins}
                  className={`${styles.toolButton} ${fixingLogins ? styles.loading : ''}`}
                >
                  {fixingLogins ? (
                    <>
                      <RefreshCw size={20} className={styles.spinning} />
                      Corrigiendo...
                    </>
                  ) : (
                    <>
                      <Settings size={20} />
                      Corregir Fechas Login
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleCloseMarket}
                  disabled={closingMarket}
                  className={`${styles.toolButton} ${closingMarket ? styles.loading : ''}`}
                >
                  {closingMarket ? (
                    <>
                      <RefreshCw size={20} className={styles.spinning} />
                      Cerrando Mercado...
                    </>
                  ) : (
                    <>
                      <Clock size={20} />
                      Cerrar Mercado
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Modal de Roadmaps */}
      {showRoadmapsModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.roadmapsModalContainer}>
            <div className={styles.roadmapsModalHeader}>
              <div className={styles.roadmapsModalTitle}>
                <Map size={32} />
                <div>
                  <h2>Gestión de Roadmaps</h2>
                  <p>Crea y gestiona los roadmaps de aprendizaje dinámicos</p>
              </div>
                  </div>
              <div className={styles.roadmapsModalActions}>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">Todos los tipos</option>
                  <option value="SwingTrading">Swing Trading</option>
                  <option value="DayTrading">Day Trading</option>
                </select>
                <button
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className={styles.createButton}
                >
                  <Plus size={16} />
                  Nuevo Roadmap
                </button>
                <button
                  onClick={() => setShowRoadmapsModal(false)}
                  className={styles.closeModalButton}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className={styles.roadmapsModalContent}>
              {/* Barra de búsqueda */}
              <div className={styles.searchContainer}>
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Buscar roadmaps..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {/* Lista de roadmaps */}
              <div className={styles.roadmapsList}>
                {roadmapsLoading ? (
                  <div className={styles.roadmapsLoading}>
                    <Loader className={styles.spinning} size={32} />
                    Cargando roadmaps...
                  </div>
                ) : roadmaps.length === 0 ? (
                  <div className={styles.roadmapsEmpty}>
                    <Map size={64} />
                    <h3>No hay roadmaps creados</h3>
                    <p>Para agregar módulos, primero debes:</p>
                    <ol className={styles.instructionsList}>
                      <li>1. Crear un nuevo roadmap</li>
                      <li>2. Guardar el roadmap</li>
                      <li>3. Editarlo para agregar módulos</li>
                    </ol>
                    <button 
                      onClick={() => {
                        resetForm();
                        setShowCreateModal(true);
                      }}
                      className={styles.createFirstRoadmapButton}
                    >
                      <Plus size={16} />
                      Crear Primer Roadmap
                    </button>
                  </div>
                ) : (
                  roadmaps.map((roadmap) => (
                    <div key={roadmap._id} className={styles.roadmapCard}>
                      <div className={styles.roadmapHeader}>
                        <div className={styles.roadmapInfo}>
                          <div className={styles.roadmapMeta}>
                            <span className={`${styles.typeTag} ${styles[roadmap.tipoEntrenamiento.toLowerCase()]}`}>
                              {roadmap.tipoEntrenamiento}
                            </span>
                            <span className={styles.orderTag}>
                              Orden: {roadmap.orden}
                            </span>
                          </div>
                          <h3 className={styles.roadmapTitle}>{roadmap.nombre}</h3>
                          <p className={styles.roadmapDescription}>{roadmap.descripcion}</p>
                          <div className={styles.roadmapStats}>
                            <div className={styles.stat}>
                              <BookOpen size={16} />
                              {roadmap.modulos.length} módulos
                            </div>
                            <div className={styles.stat}>
                              <Target size={16} />
                              {roadmap.metadatos.totalLecciones} lecciones
                            </div>
                            <div className={styles.stat}>
                              <Clock size={16} />
                              {roadmap.metadatos.totalHoras} horas
                            </div>
                          </div>
                        </div>
                        <div className={styles.roadmapActions}>
                          <button
                            onClick={() => openEditModal(roadmap)}
                            className={styles.editButton}
                            title="Editar roadmap"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRoadmap(roadmap._id)}
                            className={styles.deleteButton}
                            title="Eliminar roadmap"
                          >
                            <Trash2 size={16} />
                          </button>
                      </div>
                      </div>
                      <div className={styles.roadmapFooter}>
                        <span className={`${styles.status} ${roadmap.activo ? styles.active : styles.inactive}`}>
                          {roadmap.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className={styles.lastUpdate}>
                          Actualizado: {new Date(roadmap.updatedAt).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
        </div>
        </div>
      )}

      {/* Modal de crear/editar roadmap */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.createModalContainer}>
            <div className={styles.createModalHeader}>
              <h3>{editingRoadmap ? 'Editar Roadmap' : 'Crear Nuevo Roadmap'}</h3>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRoadmap(null);
                  resetForm();
                }}
                className={styles.closeButton}
              >
                <X size={24} />
              </button>
            </div>

            <div className={styles.createModalContent}>
              {submitError && (
                <div className={styles.errorBanner}>
                  <AlertTriangle size={20} />
                  <span>{submitError}</span>
                  <button onClick={() => setSubmitError('')}>
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className={styles.formSection}>
                <h4>Información Básica</h4>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Nombre del Roadmap</label>
                    <input
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                      className={formErrors.nombre ? styles.fieldError : ''}
                      placeholder="Ej: Trading Fundamentals Master"
                    />
                    {formErrors.nombre && (
                      <div className={styles.errorMessage}>{formErrors.nombre}</div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label>Tipo de Entrenamiento</label>
                    <select
                      value={formData.tipoEntrenamiento}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        tipoEntrenamiento: e.target.value as any 
                      }))}
                      className={formErrors.tipoEntrenamiento ? styles.fieldError : ''}
                    >
                      <option value="SwingTrading">Swing Trading</option>
                      <option value="DayTrading">Day Trading</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                    className={formErrors.descripcion ? styles.fieldError : ''}
                    placeholder="Describe el objetivo y contenido del roadmap..."
                    rows={3}
                  />
                  {formErrors.descripcion && (
                    <div className={styles.errorMessage}>{formErrors.descripcion}</div>
                  )}
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Orden</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.orden}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        orden: parseInt(e.target.value) || 1 
                      }))}
                      className={formErrors.orden ? styles.fieldError : ''}
                    />
                    {formErrors.orden && (
                      <div className={styles.errorMessage}>{formErrors.orden}</div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label>Estado</label>
                    <select
                      value={formData.activo ? 'true' : 'false'}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        activo: e.target.value === 'true' 
                      }))}
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sección de Módulos */}
              <div className={styles.formSection}>
                <div className={styles.modulesHeader}>
                  <h4>Módulos del Roadmap ({roadmapModules.length})</h4>
                  <div className={styles.moduleButtonContainer}>
                    {!editingRoadmap ? (
                      <div className={styles.disabledButtonWrapper}>
                        <button
                          type="button"
                          className={`${styles.addModuleButton} ${styles.disabled}`}
                          disabled
                          title="Primero guarda el roadmap para poder agregar módulos"
                        >
                          <Plus size={16} />
                          Agregar Módulo
                        </button>
                        <small className={styles.helperText}>
                          💡 Primero guarda el roadmap, luego podrás agregar módulos
                        </small>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowModuleForm(true)}
                        className={styles.addModuleButton}
                      >
                        <Plus size={16} />
                        Agregar Módulo
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista de módulos existentes */}
                <div className={styles.modulesList}>
                  {loadingModules ? (
                    <div className={styles.loadingModules}>
                      <Loader className={styles.spinning} size={32} />
                      Cargando módulos...
                    </div>
                  ) : roadmapModules.length > 0 ? (
                    roadmapModules.map((module) => (
                      <div key={module._id} className={styles.moduleItem}>
                        <div className={styles.moduleItemHeader}>
                          <div className={styles.moduleItemInfo}>
                            <h5>{module.nombre}</h5>
                            <div className={styles.moduleItemMeta}>
                              <span>🕐 {module.duracion}</span>
                              <span>📚 {module.lecciones} lecciones</span>
                              <span>📊 {module.dificultad}</span>
                              <span>🏷️ {module.temas.length} temas</span>
                              <span>📋 Orden: {module.orden}</span>
                            </div>
                          </div>
                          <div className={styles.moduleItemActions}>
                            <button
                              type="button"
                              onClick={() => editModule(module)}
                              className={styles.editModuleButton}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteModule(module)}
                              className={styles.deleteModuleButton}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <p className={styles.moduleItemDescription}>{module.descripcion}</p>
                        {module.prerequisito && (
                          <div className={styles.modulePrerequisite}>
                            <small>Prerequisito: {module.prerequisito.nombre}</small>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className={styles.noModules}>
                      <BookOpen size={48} />
                      <p>No hay módulos creados aún</p>
                      <small>Agrega módulos para estructurar tu roadmap</small>
                    </div>
                  )}
                </div>

                {/* Formulario de módulo */}
                {showModuleForm && (
                  <div className={styles.moduleFormOverlay}>
                    <div className={styles.moduleFormContainer}>
                      <div className={styles.moduleFormHeader}>
                        <h5>{editingModule ? 'Editar Módulo' : 'Nuevo Módulo'}</h5>
                        <button
                          type="button"
                          onClick={resetModuleForm}
                          className={styles.closeModuleForm}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      <div className={styles.moduleFormContent}>
                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label>Nombre del Módulo</label>
                            <input
                              type="text"
                              value={moduleFormData.titulo}
                              onChange={(e) => setModuleFormData(prev => ({ 
                                ...prev, 
                                titulo: e.target.value 
                              }))}
                              placeholder="Ej: Introducción al Trading"
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>Dificultad</label>
                            <select
                              value={moduleFormData.dificultad}
                              onChange={(e) => setModuleFormData(prev => ({ 
                                ...prev, 
                                dificultad: e.target.value as any 
                              }))}
                            >
                              <option value="Básico">Básico</option>
                              <option value="Intermedio">Intermedio</option>
                              <option value="Avanzado">Avanzado</option>
                            </select>
                          </div>
                        </div>

                        <div className={styles.formGroup}>
                          <label>Descripción</label>
                          <textarea
                            value={moduleFormData.descripcion}
                            onChange={(e) => setModuleFormData(prev => ({ 
                              ...prev, 
                              descripcion: e.target.value 
                            }))}
                            placeholder="Describe qué aprenderán en este módulo..."
                            rows={3}
                          />
                        </div>

                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label>Duración</label>
                            <input
                              type="text"
                              value={moduleFormData.duracion}
                              onChange={(e) => setModuleFormData(prev => ({ 
                                ...prev, 
                                duracion: e.target.value 
                              }))}
                              placeholder="Ej: 2 semanas"
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label>Cantidad de Lecciones</label>
                            <input
                              type="number"
                              min="1"
                              value={moduleFormData.lecciones}
                              onChange={(e) => setModuleFormData(prev => ({ 
                                ...prev, 
                                lecciones: parseInt(e.target.value) || 1 
                              }))}
                            />
                          </div>
                        </div>

                        {roadmapModules.length > 0 && !editingModule && (
                          <div className={styles.formGroup}>
                            <label>Prerequisito (opcional)</label>
                            <select
                              value={moduleFormData.prerequisito || ''}
                              onChange={(e) => setModuleFormData(prev => ({ 
                                ...prev, 
                                prerequisito: e.target.value || undefined
                              }))}
                            >
                              <option value="">Sin prerequisito</option>
                              {roadmapModules.map((mod) => (
                                <option key={mod._id} value={mod._id}>
                                  Módulo {mod.orden}: {mod.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Temas del módulo */}
                        <div className={styles.temasSection}>
                          <div className={styles.temasHeader}>
                            <h6>Temas del Módulo</h6>
                            <button
                              type="button"
                              onClick={addTema}
                              className={styles.addTemaButton}
                            >
                              <Plus size={14} />
                              Agregar Tema
                            </button>
                          </div>

                          <div className={styles.temasList}>
                            {moduleFormData.temas.map((tema, index) => (
                              <div key={index} className={styles.temaItem}>
                                <div className={styles.temaInputs}>
                                  <input
                                    type="text"
                                    placeholder="Título del tema"
                                    value={tema.titulo}
                                    onChange={(e) => updateTema(index, 'titulo', e.target.value)}
                                  />
                                  <input
                                    type="text"
                                    placeholder="Descripción (opcional)"
                                    value={tema.descripcion}
                                    onChange={(e) => updateTema(index, 'descripcion', e.target.value)}
                                  />
                                </div>
                                {moduleFormData.temas.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeTema(index)}
                                    className={styles.removeTemaButton}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className={styles.moduleFormFooter}>
                        <button
                          type="button"
                          onClick={resetModuleForm}
                          className={styles.cancelModuleButton}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={saveModule}
                          className={styles.saveModuleButton}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <RefreshCw size={16} className={styles.spinning} />
                              {editingModule ? 'Actualizando...' : 'Creando...'}
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              {editingModule ? 'Actualizar' : 'Crear'} Módulo
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.createModalFooter}>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingRoadmap(null);
                  resetForm();
                }}
                className={styles.cancelButton}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={editingRoadmap ? handleEditRoadmap : handleCreateRoadmap}
                className={styles.saveButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className={styles.spinning} />
                    {editingRoadmap ? 'Actualizando...' : 'Creando...'}
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {editingRoadmap ? 'Actualizar' : 'Crear'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NUEVO: Componente de prueba temporal para verificar menús - OCULTO */}
      <div className={styles.hiddenSection}>
        <AdminDropdownTest />
      </div>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  console.log('🔍 [DASHBOARD] Iniciando verificación de acceso...');
  
  try {
    // Usar la función de verificación que ya sabemos que funciona
    const verification = await verifyAdminAccess(context);
    
    console.log('🔍 [DASHBOARD] Resultado de verificación:', verification);
    
    if (!verification.isAdmin) {
      console.log('❌ [DASHBOARD] Acceso denegado - redirigiendo a:', verification.redirectTo);
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    console.log('✅ [DASHBOARD] Acceso de admin confirmado para:', verification.session?.user?.email);
    
    return {
      props: {
        user: verification.session?.user || verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [DASHBOARD] Error en getServerSideProps:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
}; 