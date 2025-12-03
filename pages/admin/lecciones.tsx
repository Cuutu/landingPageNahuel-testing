import React, { useState, useEffect, useCallback } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import toast from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import {
  PlayCircle,
  BookOpen,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  FileText,
  Image,
  Youtube,
  FileDown,
  Star,
  Clock,
  Target,
  GripVertical,
  Upload,
  Eye,
  Save,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Database,
  AlertCircle
} from 'lucide-react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/googleAuth';
import styles from '../../styles/AdminLecciones.module.css';
import ImageUploader from '../../components/ImageUploader';
import PDFUploader from '../../components/PDFUploader';
import PDFUploaderDB from '@/components/PDFUploaderDB';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { motion } from 'framer-motion';

// Interfaces para archivos de Cloudinary
interface CloudinaryImage {
  public_id: string;
  url: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

interface CloudinaryPDF {
  public_id: string;
  url: string;
  secure_url: string;
  format: string;
  bytes: number;
  pages?: number;
}

interface LessonContent {
  id: string;
  type: 'youtube' | 'pdf' | 'image' | 'text' | 'html';
  orden: number;
  title?: string;
  content: {
    youtubeId?: string;
    youtubeTitle?: string;
    youtubeDuration?: string;
    // Campos legacy de URL (mantener para compatibilidad)
    pdfUrl?: string;
    pdfTitle?: string;
    pdfSize?: string;
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    // Campos de Cloudinary (deprecados)
    pdfFile?: CloudinaryPDF;
    imageFile?: CloudinaryImage;
    cloudinaryPdf?: {
      publicId: string;
      originalFileName?: string;
      fileSize?: number;
    };
    // Nuevos campos para PDFs en base de datos
    databasePdf?: {
      pdfId: string;
      fileName: string;
      originalName: string;
      fileSize: number;
      mimeType: string;
      uploadDate: Date;
    };
    text?: string;
    html?: string;
    description?: string;
    notes?: string;
  };
}

interface Lesson {
  _id: string;
  titulo: string;
  descripcion: string;
  modulo: number;
  numeroLeccion: number;
  duracionEstimada: number;
  contenido: LessonContent[];
  objetivos: string[];
  recursos: {
    titulo: string;
    url: string;
    tipo: 'enlace' | 'descarga' | 'referencia';
  }[];
  tipoEntrenamiento: 'SwingTrading' | 'DowJones';
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  esGratuita: boolean;
  requiereSuscripcion: boolean;
  orden: number;
  activa: boolean;
  estadisticas: {
    visualizaciones: number;
    completados: number;
    tiempoPromedioVisualizacion: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface AdminLeccionesProps {
  session: any;
}

const AdminLecciones: React.FC<AdminLeccionesProps> = ({ session }) => {
  const router = useRouter();
  const [lecciones, setLecciones] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para manejo de errores y validaciones
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  
  // Obtener el tipo de la URL y configurar filtros iniciales
  const tipoFromURL = router.query.tipo as string;
  const isFilteredByType = tipoFromURL && ['DowJones', 'SwingTrading'].includes(tipoFromURL);
  
  const [filtros, setFiltros] = useState({
    tipo: isFilteredByType ? tipoFromURL : 'all',
    modulo: 'all',
    dificultad: 'all',
    activa: 'all'
  });

  // Estado del formulario - pre-configurar tipo según URL
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    modulo: 1,
    numeroLeccion: 1,
    duracionEstimada: 0,
    contenido: [] as LessonContent[],
    objetivos: [''],
    recursos: [] as {
      titulo: string;
      url: string;
      tipo: 'enlace' | 'descarga' | 'referencia';
    }[],
    tipoEntrenamiento: (isFilteredByType ? tipoFromURL : 'SwingTrading') as 'SwingTrading' | 'DowJones',
    dificultad: 'Básico' as 'Básico' | 'Intermedio' | 'Avanzado',
    esGratuita: false,
    requiereSuscripcion: true,
    orden: 1,
    activa: true
  });

  // Cargar lecciones con manejo de errores mejorado
  const cargarLecciones = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...(filtros.tipo !== 'all' && { tipo: filtros.tipo }),
        ...(filtros.modulo !== 'all' && { modulo: filtros.modulo }),
        ...(filtros.activa !== 'all' && { activa: filtros.activa }),
        ...(searchTerm && { search: searchTerm }),
        limit: '100'
      });

      const response = await fetch(`/api/lessons?${params}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Endpoint de lecciones no encontrado');
        } else if (response.status === 403) {
          throw new Error('No tienes permisos para ver las lecciones');
        } else if (response.status >= 500) {
          throw new Error('Error del servidor. Intenta nuevamente en unos momentos');
        } else {
          throw new Error(`Error HTTP: ${response.status}`);
        }
      }
      
      const data = await response.json();

      if (data.success) {
        setLecciones(data.data.lecciones || []);
        if (data.data.lecciones.length === 0 && searchTerm) {
          toast.success(`📝 No se encontraron lecciones para "${searchTerm}"`);
        }
      } else {
        throw new Error(data.error || 'Error desconocido al cargar lecciones');
      }
    } catch (error) {
      console.error('Error cargando lecciones:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('🌐 Error de conexión. Verifica tu conexión a internet.');
      } else {
        toast.error(`❌ ${error instanceof Error ? error.message : 'Error al cargar lecciones'}`);
      }
      
      // En caso de error, mantener las lecciones existentes si las hay
      // Solo limpiar si es la primera carga
      if (lecciones.length === 0) {
        setLecciones([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Actualizar filtros cuando cambie la URL
  useEffect(() => {
    if (router.isReady) {
      const tipoFromURL = router.query.tipo as string;
      const isFilteredByType = tipoFromURL && ['DowJones', 'SwingTrading'].includes(tipoFromURL);
      
      if (isFilteredByType) {
        setFiltros(prev => ({ ...prev, tipo: tipoFromURL }));
        setFormData(prev => ({ ...prev, tipoEntrenamiento: tipoFromURL as 'SwingTrading' | 'DowJones' }));
      }
    }
  }, [router.isReady, router.query.tipo]);

  useEffect(() => {
    if (router.isReady) {
      cargarLecciones();
    }
  }, [filtros, searchTerm, router.isReady]);

  // Función de validación completa
  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    // Validaciones básicas
    if (!formData.titulo.trim()) {
      errors.titulo = 'El título es obligatorio';
    } else if (formData.titulo.length < 3) {
      errors.titulo = 'El título debe tener al menos 3 caracteres';
    } else if (formData.titulo.length > 100) {
      errors.titulo = 'El título no puede exceder 100 caracteres';
    }
    
    if (!formData.descripcion.trim()) {
      errors.descripcion = 'La descripción es obligatoria';
    } else if (formData.descripcion.length < 10) {
      errors.descripcion = 'La descripción debe tener al menos 10 caracteres';
    } else if (formData.descripcion.length > 500) {
      errors.descripcion = 'La descripción no puede exceder 500 caracteres';
    }
    
    if (formData.modulo < 1 || formData.modulo > 15) {
      errors.modulo = 'El módulo debe estar entre 1 y 15';
    }
    
    if (formData.numeroLeccion < 1 || formData.numeroLeccion > 50) {
      errors.numeroLeccion = 'El número de lección debe estar entre 1 y 50';
    }
    
    if (formData.duracionEstimada < 0 || formData.duracionEstimada > 300) {
      errors.duracionEstimada = 'La duración debe estar entre 0 y 300 minutos';
    }
    
    if (formData.orden < 1 || formData.orden > 1000) {
      errors.orden = 'El orden debe estar entre 1 y 1000';
    }
    
    // Validar objetivos
    const objetivosValidos = formData.objetivos.filter(obj => obj.trim().length > 0);
    if (objetivosValidos.length === 0) {
      errors.objetivos = 'Debe agregar al menos un objetivo de aprendizaje';
    } else {
      const objetivosMuyCortos = objetivosValidos.filter(obj => obj.trim().length < 5);
      if (objetivosMuyCortos.length > 0) {
        errors.objetivos = 'Los objetivos deben tener al menos 5 caracteres';
      }
    }
    
    // Validar contenido
    if (formData.contenido.length === 0) {
      errors.contenido = 'Debe agregar al menos un elemento de contenido';
    } else {
      // Validar cada elemento de contenido
      const contenidoInvalido = formData.contenido.find((item, index) => {
        if (!item.title?.trim()) {
          errors[`contenido_${index}_title`] = `El título del contenido ${index + 1} es obligatorio`;
          return true;
        }
        
        switch (item.type) {
          case 'youtube':
            if (!item.content.youtubeId?.trim()) {
              errors[`contenido_${index}_youtube`] = `El ID de YouTube del contenido ${index + 1} es obligatorio`;
              return true;
            }
            break;
          case 'text':
            if (!item.content.text?.trim()) {
              errors[`contenido_${index}_text`] = `El texto del contenido ${index + 1} es obligatorio`;
              return true;
            }
            break;
          case 'pdf':
            if (!item.content.databasePdf && !item.content.pdfFile && !item.content.cloudinaryPdf) {
              errors[`contenido_${index}_pdf`] = `Debe subir un PDF para el contenido ${index + 1}`;
              return true;
            }
            break;
          case 'image':
            if (!item.content.imageFile) {
              errors[`contenido_${index}_image`] = `Debe subir una imagen para el contenido ${index + 1}`;
              return true;
            }
            break;
        }
        return false;
      });
    }
    
    // Verificar duplicados (solo para nuevas lecciones)
    if (!editingLesson) {
      const existeModuloNumero = lecciones.some(leccion => 
        leccion.modulo === formData.modulo && 
        leccion.numeroLeccion === formData.numeroLeccion && 
        leccion.tipoEntrenamiento === formData.tipoEntrenamiento
      );
      
      if (existeModuloNumero) {
        errors.numeroLeccion = `Ya existe una lección ${formData.numeroLeccion} en el módulo ${formData.modulo} para ${formData.tipoEntrenamiento}`;
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Crear nueva lección con validación mejorada
  const crearLeccion = async () => {
    // Limpiar errores previos
    setFormErrors({});
    setSubmitError('');
    
    // Validar formulario
    if (!validateForm()) {
      toast.error('Por favor corrige los errores del formulario');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          objetivos: formData.objetivos.filter(obj => obj.trim().length > 0)
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('¡Lección creada exitosamente!');
        setShowCreateModal(false);
        resetForm();
        cargarLecciones();
      } else {
        // Manejar errores específicos del servidor
        if (data.error?.includes('duplicate') || data.error?.includes('duplicada')) {
          setFormErrors({
            numeroLeccion: 'Ya existe una lección con este número en el módulo especificado'
          });
          toast.error('Lección duplicada: Ya existe una lección con este número');
        } else if (data.error?.includes('validation')) {
          setSubmitError('Error de validación: ' + data.error);
          toast.error('Error de validación en los datos');
        } else if (data.error?.includes('permission')) {
          setSubmitError('No tienes permisos para crear lecciones');
          toast.error('Permisos insuficientes');
        } else {
          setSubmitError(data.error || 'Error desconocido al crear la lección');
          toast.error(data.error || 'Error al crear lección');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setSubmitError('Error de conexión. Verifica tu conexión a internet.');
        toast.error('Error de conexión');
      } else {
        setSubmitError('Error inesperado. Intenta nuevamente.');
        toast.error('Error inesperado');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Actualizar lección con validación mejorada
  const actualizarLeccion = async () => {
    if (!editingLesson) return;

    // Limpiar errores previos
    setFormErrors({});
    setSubmitError('');
    
    // Validar formulario
    if (!validateForm()) {
      toast.error('Por favor corrige los errores del formulario');
      return;
    }
    
    // Verificar duplicados al editar (excluyendo la lección actual)
    const existeModuloNumero = lecciones.some(leccion => 
      leccion._id !== editingLesson._id &&
      leccion.modulo === formData.modulo && 
      leccion.numeroLeccion === formData.numeroLeccion && 
      leccion.tipoEntrenamiento === formData.tipoEntrenamiento
    );
    
    if (existeModuloNumero) {
      setFormErrors({
        numeroLeccion: `Ya existe otra lección ${formData.numeroLeccion} en el módulo ${formData.modulo} para ${formData.tipoEntrenamiento}`
      });
      toast.error('Número de lección duplicado');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await fetch(`/api/lessons/${editingLesson._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          objetivos: formData.objetivos.filter(obj => obj.trim().length > 0)
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('¡Lección actualizada exitosamente!');
        setEditingLesson(null);
        resetForm();
        cargarLecciones();
      } else {
        // Manejar errores específicos del servidor
        if (data.error?.includes('duplicate') || data.error?.includes('duplicada')) {
          setFormErrors({
            numeroLeccion: 'Ya existe una lección con este número en el módulo especificado'
          });
          toast.error('Lección duplicada: Ya existe una lección con este número');
        } else if (data.error?.includes('not found')) {
          setSubmitError('La lección que intentas actualizar ya no existe');
          toast.error('Lección no encontrada');
        } else {
          setSubmitError(data.error || 'Error desconocido al actualizar la lección');
          toast.error(data.error || 'Error al actualizar lección');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setSubmitError('Error de conexión. Verifica tu conexión a internet.');
        toast.error('Error de conexión');
      } else {
        setSubmitError('Error inesperado. Intenta nuevamente.');
        toast.error('Error inesperado');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar lección con confirmación mejorada
  const eliminarLeccion = async (id: string, titulo: string) => {
    const confirmMessage = `¿Estás completamente seguro de que quieres eliminar la lección "${titulo}"?\n\n⚠️ ESTA ACCIÓN NO SE PUEDE DESHACER\n\n• Se eliminará todo el contenido\n• Se perderán las estadísticas\n• Los estudiantes ya no podrán acceder\n\nEscribe "ELIMINAR" para confirmar:`;
    
    const userInput = prompt(confirmMessage);
    
    if (userInput !== 'ELIMINAR') {
      if (userInput !== null) {
        toast.error('Eliminación cancelada. Debes escribir "ELIMINAR" exactamente.');
      }
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/lessons/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Lección eliminada exitosamente');
        cargarLecciones();
      } else {
        if (data.error?.includes('not found')) {
          toast.error('❌ La lección ya no existe o fue eliminada previamente');
        } else if (data.error?.includes('permission')) {
          toast.error('❌ No tienes permisos para eliminar lecciones');
        } else {
          toast.error(`❌ Error al eliminar: ${data.error || 'Error desconocido'}`);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('❌ Error de conexión. Verifica tu conexión a internet.');
      } else {
        toast.error('❌ Error inesperado al eliminar la lección');
      }
    } finally {
      setLoading(false);
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      titulo: '',
      descripcion: '',
      modulo: 1,
      numeroLeccion: 1,
      duracionEstimada: 0,
      contenido: [],
      objetivos: [''],
      recursos: [] as {
        titulo: string;
        url: string;
        tipo: 'enlace' | 'descarga' | 'referencia';
      }[],
      tipoEntrenamiento: (isFilteredByType ? tipoFromURL : 'SwingTrading') as 'SwingTrading' | 'DowJones',
      dificultad: 'Básico',
      esGratuita: false,
      requiereSuscripcion: true,
      orden: 1,
      activa: true
    });
    // Limpiar errores al resetear
    setFormErrors({});
    setSubmitError('');
  };

  // Función para limpiar errores cuando el usuario está editando
  const clearFieldError = (fieldName: string) => {
    if (formErrors[fieldName]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // Función para obtener la clase CSS del campo con error
  const getFieldClass = (fieldName: string, baseClass: string = '') => {
    return formErrors[fieldName] 
      ? `${baseClass} ${styles.fieldError}`.trim()
      : baseClass;
  };

  // Cargar datos para edición
  const cargarParaEdicion = (leccion: Lesson) => {
    setFormData({
      titulo: leccion.titulo,
      descripcion: leccion.descripcion,
      modulo: leccion.modulo,
      numeroLeccion: leccion.numeroLeccion,
      duracionEstimada: leccion.duracionEstimada,
      contenido: leccion.contenido,
      objetivos: leccion.objetivos.length ? leccion.objetivos : [''],
      recursos: leccion.recursos,
      tipoEntrenamiento: leccion.tipoEntrenamiento,
      dificultad: leccion.dificultad,
      esGratuita: leccion.esGratuita,
      requiereSuscripcion: leccion.requiereSuscripcion,
      orden: leccion.orden,
      activa: leccion.activa
    });
    setEditingLesson(leccion);
  };

  // Agregar contenido
  const agregarContenido = (tipo: LessonContent['type']) => {
    const nuevoContenido: LessonContent = {
      id: Date.now().toString(),
      type: tipo,
      orden: 0, // Se calculará en el callback
      title: '',
      content: {}
    };

    setFormData(prevFormData => ({
      ...prevFormData,
      contenido: [...prevFormData.contenido, { ...nuevoContenido, orden: prevFormData.contenido.length + 1 }]
    }));
  };

  // Actualizar contenido
  const actualizarContenido = (id: string, campo: string, valor: any) => {
    setFormData(prevFormData => ({
      ...prevFormData,
      contenido: prevFormData.contenido.map(item =>
        item.id === id
          ? {
              ...item,
              [campo]: campo === 'content' 
                ? { ...item.content, ...valor }
                : valor
            }
          : item
      )
    }));
  };

  // Eliminar contenido
  const eliminarContenido = (id: string) => {
    setFormData(prevFormData => ({
      ...prevFormData,
      contenido: prevFormData.contenido.filter(item => item.id !== id)
    }));
  };

  // Reordenar contenido
  const reordenarContenido = (fromIndex: number, toIndex: number) => {
    setFormData(prevFormData => {
      const nuevosContenidos = [...prevFormData.contenido];
      const [elementoMovido] = nuevosContenidos.splice(fromIndex, 1);
      nuevosContenidos.splice(toIndex, 0, elementoMovido);
      
      return {
        ...prevFormData,
        contenido: nuevosContenidos.map((item, index) => ({ ...item, orden: index + 1 }))
      };
    });
  };

  // Funciones para manejar uploads de archivos (Cloudinary - legacy)
  const handlePDFUploaded = (contentId: string, pdfData: CloudinaryPDF) => {
    actualizarContenido(contentId, 'content', {
      pdfFile: pdfData,
      pdfUrl: pdfData.secure_url, // Mantener compatibilidad
      pdfTitle: pdfData.public_id.split('/').pop() || 'PDF subido',
      cloudinaryPdf: {
        publicId: pdfData.public_id,
        originalFileName: pdfData.public_id.split('/').pop() || 'PDF subido',
        fileSize: pdfData.bytes
      }
    });
    toast.success('PDF subido exitosamente a Cloudinary');
  };

  // Nueva función para manejar uploads a base de datos
  const handleDatabasePDFUploaded = (contentId: string, pdfData: {
    pdfId: string;
    fileName: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
    uploadDate: Date;
  }) => {
    actualizarContenido(contentId, 'content', {
      databasePdf: pdfData,
      // Limpiar datos de Cloudinary si existen
      pdfFile: undefined,
      cloudinaryPdf: undefined,
      pdfUrl: undefined,
      pdfTitle: pdfData.originalName
    });
    toast.success('PDF subido exitosamente a base de datos');
  };

  const handleImageUploaded = (contentId: string, imageData: CloudinaryImage) => {
    actualizarContenido(contentId, 'content', {
      imageFile: imageData,
      imageUrl: imageData.secure_url, // Mantener compatibilidad
      imageAlt: 'Imagen subida'
    });
    toast.success('Imagen subida exitosamente');
  };

  const handleUploadError = (error: string) => {
    toast.error(`Error subiendo archivo: ${error}`);
  };

  // Función para migrar PDFs al nuevo formato
  const handleMigratePDFs = async () => {
    if (!confirm('¿Estás seguro de que quieres migrar todos los PDFs al nuevo formato cloudinaryPdf?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/lessons/migrate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Migración completada: ${data.data.migrados} lecciones migradas`);
        
        // Mostrar detalles de la migración
        // console.log('📋 Detalles de migración:', data.data.detalles);
        
        // Recargar lecciones
        await cargarLecciones();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en la migración');
      }
    } catch (error) {
      console.error('❌ Error migrando PDFs:', error);
      toast.error(`Error en migración: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Gestión de Lecciones - Admin</title>
        <meta name="description" content="Panel de administración para gestionar lecciones" />
      </Head>

      <Navbar />

      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>
              <BookOpen size={32} />
              Gestión de Lecciones
              {isFilteredByType && (
                <span className={styles.typeFilter}>
                  - {tipoFromURL === 'SwingTrading' ? 'Zero 2 Trader' : 'Dow Jones'}
                </span>
              )}
            </h1>
            <p className={styles.subtitle}>
              {isFilteredByType 
                ? `Gestiona las lecciones de ${tipoFromURL === 'SwingTrading' ? 'Zero 2 Trader' : 'Dow Jones'}`
                : 'Crea y gestiona el contenido de los entrenamientos'
              }
            </p>
          </div>

          <div className={styles.headerRight}>
            {!isFilteredByType && (
              <select
                value={filtros.tipo}
                onChange={(e) => setFiltros({...filtros, tipo: e.target.value as any})}
                className={styles.select}
              >
                <option value="all">Todos los tipos</option>
                <option value="SwingTrading">Zero 2 Trader</option>
                <option value="DowJones">Dow Jones</option>
              </select>
            )}
            
            {isFilteredByType && (
              <div className={styles.filterInfo}>
                <span className={styles.filterBadge}>
                  Filtrado: {tipoFromURL === 'SwingTrading' ? 'Swing Trading' : 'Dow Jones'}
                </span>
                <Link href="/admin/lecciones" className={styles.clearFilter}>
                  Ver todos
                </Link>
              </div>
            )}
            
            <button
              onClick={handleMigratePDFs}
              disabled={loading}
              className={`${styles.button} ${styles.migrationButton}`}
              title="Migrar PDFs existentes al nuevo formato"
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw size={16} />
                  </motion.div>
                  Migrando...
                </>
              ) : (
                <>
                  <Database size={16} />
                  Migrar PDFs
                </>
              )}
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className={`${styles.button} ${styles.primaryButton}`}
            >
              <Plus size={16} />
              Nueva Lección
            </button>
          </div>
        </div>

        {/* Controles y Filtros */}
        <div className={styles.controls}>
          <div className={styles.searchBar}>
            <Search size={20} />
            <input
              type="text"
              placeholder="Buscar lecciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filters}>
            <select
              value={filtros.modulo}
              onChange={(e) => setFiltros({...filtros, modulo: e.target.value})}
            >
              <option value="all">Todos los módulos</option>
              {[1,2,3,4,5,6,7,8,9,10].map(num => (
                <option key={num} value={num}>Módulo {num}</option>
              ))}
            </select>

            <select
              value={filtros.dificultad}
              onChange={(e) => setFiltros({...filtros, dificultad: e.target.value})}
            >
              <option value="all">Todas las dificultades</option>
              <option value="Básico">Básico</option>
              <option value="Intermedio">Intermedio</option>
              <option value="Avanzado">Avanzado</option>
            </select>

            <select
              value={filtros.activa}
              onChange={(e) => setFiltros({...filtros, activa: e.target.value})}
            >
              <option value="all">Todos los estados</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>
          </div>
        </div>

        {/* Lista de Lecciones */}
        <div className={styles.leccionesList}>
          {loading ? (
            <div className={styles.loading}>Cargando lecciones...</div>
          ) : lecciones.length === 0 ? (
            <div className={styles.empty}>
              <BookOpen size={48} />
              <h3>No hay lecciones</h3>
              <p>Crea la primera lección para comenzar</p>
            </div>
          ) : (
            lecciones.map((leccion) => (
              <motion.div
                key={leccion._id}
                className={styles.leccionCard}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
              >
                <div className={styles.leccionHeader}>
                  <div className={styles.leccionInfo}>
                    <div className={styles.leccionMeta}>
                      <span className={styles.leccionTipo}>
                        {leccion.tipoEntrenamiento === 'SwingTrading' ? 'ST' : 'DJ'}
                      </span>
                      <span className={styles.leccionModulo}>
                        Módulo {leccion.modulo}.{leccion.numeroLeccion}
                      </span>
                      <span className={`${styles.leccionDificultad} ${styles[leccion.dificultad.toLowerCase()]}`}>
                        {leccion.dificultad}
                      </span>
                    </div>
                    <h3 className={styles.leccionTitulo}>{leccion.titulo}</h3>
                    <p className={styles.leccionDescripcion}>{leccion.descripcion}</p>
                  </div>

                  <div className={styles.leccionStats}>
                    <div className={styles.stat}>
                      <Eye size={16} />
                      <span>{leccion.estadisticas.visualizaciones}</span>
                    </div>
                    <div className={styles.stat}>
                      <Clock size={16} />
                      <span>{leccion.duracionEstimada}min</span>
                    </div>
                    <div className={styles.stat}>
                      <FileText size={16} />
                      <span>{leccion.contenido.length}</span>
                    </div>
                  </div>

                  <div className={styles.leccionActions}>
                    <button
                      onClick={() => cargarParaEdicion(leccion)}
                      className={styles.editButton}
                      title="Editar lección"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => eliminarLeccion(leccion._id, leccion.titulo)}
                      className={styles.deleteButton}
                      title="Eliminar lección"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className={styles.leccionContent}>
                  <div className={styles.leccionObjetivos}>
                    <strong>Objetivos:</strong>
                    <ul>
                      {leccion.objetivos.slice(0, 3).map((objetivo, index) => (
                        <li key={index}>{objetivo}</li>
                      ))}
                      {leccion.objetivos.length > 3 && (
                        <li>... y {leccion.objetivos.length - 3} más</li>
                      )}
                    </ul>
                  </div>

                  {leccion.contenido.length > 0 && (
                    <div className={styles.contentPreview}>
                      <strong>Contenido:</strong>
                      <div className={styles.contentTypes}>
                        {leccion.contenido.map((content, index) => (
                          <span key={index} className={`${styles.contentType} ${styles[content.type]}`}>
                            {content.type === 'youtube' && <Youtube size={14} />}
                            {content.type === 'pdf' && <FileDown size={14} />}
                            {content.type === 'image' && <Image size={14} />}
                            {content.type === 'text' && <FileText size={14} />}
                            {content.type === 'html' && <FileText size={14} />}
                            {content.title || content.type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.leccionFooter}>
                  <span className={`${styles.status} ${leccion.activa ? styles.active : styles.inactive}`}>
                    {leccion.activa ? 'Activa' : 'Inactiva'}
                  </span>
                  <span className={styles.fechaActualizacion}>
                    Actualizada: {new Date(leccion.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Modal de Crear/Editar Lección */}
        {(showCreateModal || editingLesson) && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContainer}>
              <div className={styles.modalHeader}>
                <h2>{editingLesson ? 'Editar Lección' : 'Nueva Lección'}</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingLesson(null);
                    resetForm();
                  }}
                  className={styles.closeButton}
                >
                  <X size={24} />
                </button>
              </div>

              <div className={styles.modalContent}>
                {/* Mensaje de error general */}
                {submitError && (
                  <div className={styles.errorBanner}>
                    <AlertCircle size={20} />
                    <span>{submitError}</span>
                    <button 
                      onClick={() => setSubmitError('')}
                      className={styles.closeErrorButton}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Información Básica */}
                <div className={styles.formSection}>
                  <h3>Información Básica</h3>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>Título</label>
                      <input
                        type="text"
                        value={formData.titulo}
                        onChange={(e) => {
                          setFormData({...formData, titulo: e.target.value});
                          clearFieldError('titulo');
                        }}
                        placeholder="Título de la lección"
                        className={getFieldClass('titulo')}
                      />
                      {formErrors.titulo && (
                        <span className={styles.errorMessage}>{formErrors.titulo}</span>
                      )}
                    </div>

                    <div className={styles.formGroup}>
                      <label>Descripción</label>
                      <textarea
                        value={formData.descripcion}
                        onChange={(e) => {
                          setFormData({...formData, descripcion: e.target.value});
                          clearFieldError('descripcion');
                        }}
                        placeholder="Descripción de la lección"
                        rows={3}
                        className={getFieldClass('descripcion')}
                      />
                      {formErrors.descripcion && (
                        <span className={styles.errorMessage}>{formErrors.descripcion}</span>
                      )}
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>Tipo de Entrenamiento</label>
                        {isFilteredByType ? (
                          <div className={styles.restrictedField}>
                            <input
                              type="text"
                              value={tipoFromURL === 'SwingTrading' ? 'Swing Trading' : 'Dow Jones'}
                              readOnly
                              className={styles.readOnlyInput}
                            />
                            <small className={styles.fieldNote}>
                              Tipo restringido por filtro de URL. 
                              <Link href="/admin/lecciones" className={styles.removeRestriction}>
                                Quitar restricción
                              </Link>
                            </small>
                          </div>
                        ) : (
                          <select
                            value={formData.tipoEntrenamiento}
                            onChange={(e) => setFormData({...formData, tipoEntrenamiento: e.target.value as any})}
                          >
                            <option value="SwingTrading">Zero 2 Trader</option>
                            <option value="DowJones">Dow Jones</option>
                          </select>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label>Módulo</label>
                        <select
                          value={formData.modulo}
                          onChange={(e) => {
                            setFormData({...formData, modulo: parseInt(e.target.value)});
                            clearFieldError('modulo');
                          }}
                          className={getFieldClass('modulo')}
                        >
                          {[1,2,3,4,5,6,7,8,9,10].map(num => (
                            <option key={num} value={num}>Módulo {num}</option>
                          ))}
                        </select>
                        {formErrors.modulo && (
                          <span className={styles.errorMessage}>{formErrors.modulo}</span>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label>Número de Lección</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.numeroLeccion}
                          onChange={(e) => {
                            setFormData({...formData, numeroLeccion: parseInt(e.target.value)});
                            clearFieldError('numeroLeccion');
                          }}
                          className={getFieldClass('numeroLeccion')}
                        />
                        {formErrors.numeroLeccion && (
                          <span className={styles.errorMessage}>{formErrors.numeroLeccion}</span>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label>Duración (minutos)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.duracionEstimada}
                          onChange={(e) => {
                            setFormData({...formData, duracionEstimada: parseInt(e.target.value)});
                            clearFieldError('duracionEstimada');
                          }}
                          className={getFieldClass('duracionEstimada')}
                        />
                        {formErrors.duracionEstimada && (
                          <span className={styles.errorMessage}>{formErrors.duracionEstimada}</span>
                        )}
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>Dificultad</label>
                        <select
                          value={formData.dificultad}
                          onChange={(e) => setFormData({...formData, dificultad: e.target.value as any})}
                        >
                          <option value="Básico">Básico</option>
                          <option value="Intermedio">Intermedio</option>
                          <option value="Avanzado">Avanzado</option>
                        </select>
                      </div>

                      <div className={styles.formGroup}>
                        <label>Orden</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.orden}
                          onChange={(e) => setFormData({...formData, orden: parseInt(e.target.value)})}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>
                          <input
                            type="checkbox"
                            checked={formData.esGratuita}
                            onChange={(e) => setFormData({...formData, esGratuita: e.target.checked})}
                          />
                          Lección gratuita
                        </label>
                      </div>

                      <div className={styles.formGroup}>
                        <label>
                          <input
                            type="checkbox"
                            checked={formData.activa}
                            onChange={(e) => setFormData({...formData, activa: e.target.checked})}
                          />
                          Lección activa
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Objetivos */}
                <div className={styles.formSection}>
                  <h3>Objetivos de Aprendizaje</h3>
                  {formData.objetivos.map((objetivo, index) => (
                    <div key={index} className={styles.objetivoItem}>
                      <input
                        type="text"
                        value={objetivo}
                        onChange={(e) => {
                          const nuevosObjetivos = [...formData.objetivos];
                          nuevosObjetivos[index] = e.target.value;
                          setFormData({...formData, objetivos: nuevosObjetivos});
                          clearFieldError('objetivos');
                          clearFieldError(`objetivos_${index}`);
                        }}
                        placeholder={`Objetivo ${index + 1}`}
                        className={getFieldClass(`objetivos_${index}`, styles.objetivoInput)}
                      />
                      {formData.objetivos.length > 1 && (
                        <button
                          onClick={() => {
                            const nuevosObjetivos = formData.objetivos.filter((_, i) => i !== index);
                            setFormData({...formData, objetivos: nuevosObjetivos});
                          }}
                          className={styles.removeButton}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {formErrors.objetivos && (
                    <span className={styles.errorMessage}>{formErrors.objetivos}</span>
                  )}
                  <button
                    onClick={() => setFormData({...formData, objetivos: [...formData.objetivos, '']})}
                    className={styles.addButton}
                  >
                    <Plus size={16} />
                    Agregar Objetivo
                  </button>
                </div>

                {/* Contenido */}
                <div className={styles.formSection}>
                  <h3>Contenido de la Lección</h3>
                  
                  {formErrors.contenido && (
                    <div className={styles.errorMessage}>{formErrors.contenido}</div>
                  )}
                  
                  <div className={styles.contentButtons}>
                    <button
                      onClick={() => agregarContenido('youtube')}
                      className={styles.contentButton}
                    >
                      <Youtube size={16} />
                      Video YouTube
                    </button>
                    <button
                      onClick={() => agregarContenido('text')}
                      className={styles.contentButton}
                    >
                      <FileText size={16} />
                      Texto
                    </button>
                    <button
                      onClick={() => agregarContenido('pdf')}
                      className={styles.contentButton}
                    >
                      <FileDown size={16} />
                      PDF
                    </button>
                    <button
                      onClick={() => agregarContenido('image')}
                      className={styles.contentButton}
                    >
                      <Image size={16} />
                      Imagen
                    </button>
                  </div>

                  <div className={styles.contentList}>
                    {formData.contenido.map((item, index) => (
                      <div key={item.id} className={styles.contentItem}>
                        <div className={styles.contentItemHeader}>
                          <div className={styles.contentItemInfo}>
                            <GripVertical size={16} className={styles.dragHandle} />
                            <span className={`${styles.contentType} ${styles[item.type]}`}>
                              {item.type === 'youtube' && <Youtube size={16} />}
                              {item.type === 'pdf' && <FileDown size={16} />}
                              {item.type === 'image' && <Image size={16} />}
                              {item.type === 'text' && <FileText size={16} />}
                              {item.type === 'html' && <FileText size={16} />}
                              {item.title || item.type}
                            </span>
                            <input
                              type="text"
                              value={item.title || ''}
                              onChange={(e) => actualizarContenido(item.id, 'title', e.target.value)}
                              placeholder="Título del contenido"
                              className={getFieldClass(`contenido_${index}_title`)}
                            />
                          </div>
                          <button
                            onClick={() => eliminarContenido(item.id)}
                            className={styles.removeContentButton}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className={styles.contentItemBody}>
                          {/* YouTube */}
                          {item.type === 'youtube' && (
                            <div className={styles.youtubeContent}>
                              <input
                                type="text"
                                value={item.content.youtubeId || ''}
                                onChange={(e) => {
                                  actualizarContenido(item.id, 'content', { youtubeId: e.target.value });
                                  clearFieldError(`contenido_${index}_youtube`);
                                }}
                                placeholder="ID del video de YouTube"
                                className={getFieldClass(`contenido_${index}_youtube`)}
                              />
                              {formErrors[`contenido_${index}_youtube`] && (
                                <span className={styles.errorMessage}>{formErrors[`contenido_${index}_youtube`]}</span>
                              )}
                              <input
                                type="text"
                                value={item.content.youtubeTitle || ''}
                                onChange={(e) => actualizarContenido(item.id, 'content', { youtubeTitle: e.target.value })}
                                placeholder="Título del video"
                                className={getFieldClass(`contenido_${index}_youtubeTitle`)}
                              />
                              <input
                                type="text"
                                value={item.content.youtubeDuration || ''}
                                onChange={(e) => actualizarContenido(item.id, 'content', { youtubeDuration: e.target.value })}
                                placeholder="Duración (ej: 15:30)"
                                className={getFieldClass(`contenido_${index}_youtubeDuration`)}
                              />
                            </div>
                          )}

                          {/* PDF */}
                          {item.type === 'pdf' && (
                            <div className={styles.pdfContent}>
                              {formErrors[`contenido_${index}_pdf`] && (
                                <div className={styles.errorMessage}>{formErrors[`contenido_${index}_pdf`]}</div>
                              )}
                              <div className={styles.pdfUploadSection}>
                                <h4>📄 Configuración de PDF</h4>
                                
                                {/* Mostrar información del PDF actual */}
                                {item.content.databasePdf ? (
                                  <div className={styles.currentPdf}>
                                    <div className={styles.pdfInfo}>
                                      <span className={styles.pdfBadge}>📊 BASE DE DATOS</span>
                                      <h5>PDF Actual:</h5>
                                      <p><strong>Archivo:</strong> {item.content.databasePdf.originalName}</p>
                                      <p><strong>Tamaño:</strong> {(item.content.databasePdf.fileSize / (1024 * 1024)).toFixed(2)} MB</p>
                                      <p><strong>Subido:</strong> {new Date(item.content.databasePdf.uploadDate).toLocaleDateString()}</p>
                                      <button 
                                        type="button"
                                        className={styles.removeButton}
                                        onClick={() => actualizarContenido(item.id, 'content', { 
                                          databasePdf: undefined,
                                          pdfTitle: ''
                                        })}
                                      >
                                        🗑️ Eliminar PDF
                                      </button>
                                    </div>
                                  </div>
                                ) : item.content.cloudinaryPdf ? (
                                  <div className={styles.currentPdf}>
                                    <div className={styles.pdfInfo}>
                                      <span className={styles.pdfBadge}>☁️ CLOUDINARY (DEPRECADO)</span>
                                      <h5>PDF Actual (Cloudinary):</h5>
                                      <p><strong>Archivo:</strong> {item.content.cloudinaryPdf.originalFileName}</p>
                                      <p><strong>Tamaño:</strong> {item.content.cloudinaryPdf.fileSize ? (item.content.cloudinaryPdf.fileSize / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A'}</p>
                                      <p><strong>Public ID:</strong> {item.content.cloudinaryPdf.publicId}</p>
                                      <button 
                                        type="button"
                                        className={styles.migrateButton}
                                        onClick={() => {
                                          // Aquí podrías implementar migración individual si es necesario
                                          toast.success('Sube un nuevo PDF para reemplazar este archivo de Cloudinary');
                                        }}
                                      >
                                        🔄 Migrar a Base de Datos
                                      </button>
                                    </div>
                                  </div>
                                ) : item.content.pdfFile ? (
                                  <div className={styles.currentPdf}>
                                    <div className={styles.pdfInfo}>
                                      <span className={styles.pdfBadge}>☁️ CLOUDINARY (LEGACY)</span>
                                      <h5>PDF Actual (Legacy):</h5>
                                      <p><strong>URL:</strong> {item.content.pdfFile.secure_url}</p>
                                      <p><strong>Tamaño:</strong> {(item.content.pdfFile.bytes / (1024 * 1024)).toFixed(2)} MB</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className={styles.uploadSection}>
                                    <h5>📤 Subir Nuevo PDF</h5>
                                    <PDFUploaderDB
                                      onPDFUploaded={(pdfData) => handleDatabasePDFUploaded(item.id, pdfData)}
                                      onUploadStart={() => {/* console.log('Subiendo PDF a base de datos...') */}}
                                      onUploadProgress={(progress) => {/* console.log(`Progreso: ${progress}%`) */}}
                                      onError={handleUploadError}
                                      buttonText="Subir PDF a Base de Datos"
                                    />
                                    
                                    <div className={styles.uploadOptions}>
                                      <p className={styles.uploadNote}>
                                        <strong>Recomendado:</strong> Los PDFs ahora se almacenan directamente en la base de datos.
                                        Esto mejora la seguridad y elimina la dependencia de servicios externos.
                                      </p>
                                      
                                      <details className={styles.legacyOptions}>
                                        <summary>🔧 Opciones Legacy (Cloudinary)</summary>
                                        <div className={styles.legacyUpload}>
                                          <PDFUploader
                                            onPDFUploaded={(pdfData) => handlePDFUploaded(item.id, pdfData)}
                                            onUploadStart={() => console.log('Subiendo PDF...')}
                                            onUploadProgress={(progress) => console.log(`Progreso: ${progress}%`)}
                                            onError={handleUploadError}
                                            buttonText="Subir a Cloudinary (Legacy)"
                                          />
                                          <p className={styles.legacyWarning}>
                                            ⚠️ Este método está deprecado. Usa la opción de base de datos arriba.
                                          </p>
                                        </div>
                                      </details>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Imagen */}
                          {item.type === 'image' && (
                            <div className={styles.imageContent}>
                              {formErrors[`contenido_${index}_image`] && (
                                <div className={styles.errorMessage}>{formErrors[`contenido_${index}_image`]}</div>
                              )}
                              {!item.content.imageFile ? (
                                <div className={styles.uploadSection}>
                                  <ImageUploader
                                    onImageUploaded={(imageData) => handleImageUploaded(item.id, imageData)}
                                    onUploadStart={() => {/* console.log('Subiendo imagen...') */}}
                                    onUploadProgress={(progress) => {/* console.log(`Progreso: ${progress}%`) */}}
                                    onError={handleUploadError}
                                    maxFiles={1}
                                    multiple={false}
                                    buttonText="Subir Imagen"
                                  />
                                </div>
                              ) : (
                                <div className={styles.uploadedFile}>
                                  <div className={styles.imagePreview}>
                                    <img 
                                      src={item.content.imageFile.secure_url} 
                                      alt="Vista previa"
                                      className={styles.previewImage}
                                    />
                                  </div>
                                  <div className={styles.fileInfo}>
                                    <Image size={20} />
                                    <div className={styles.fileDetails}>
                                      <p className={styles.fileName}>
                                        {item.content.imageFile.public_id.split('/').pop()}
                                      </p>
                                      <p className={styles.fileSize}>
                                        {item.content.imageFile.width} × {item.content.imageFile.height} •{' '}
                                        {Math.round(item.content.imageFile.bytes / 1024)} KB
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      actualizarContenido(item.id, 'content', {
                                        imageFile: undefined,
                                        imageUrl: '',
                                        imageAlt: '',
                                        imageCaption: ''
                                      });
                                    }}
                                    className={styles.removeFileButton}
                                  >
                                    <Trash2 size={16} />
                                    Eliminar
                                  </button>
                                </div>
                              )}
                              <input
                                type="text"
                                value={item.content.imageAlt || ''}
                                onChange={(e) => actualizarContenido(item.id, 'content', { imageAlt: e.target.value })}
                                placeholder="Texto alternativo"
                                className={getFieldClass(`contenido_${index}_imageAlt`)}
                              />
                              <input
                                type="text"
                                value={item.content.imageCaption || ''}
                                onChange={(e) => actualizarContenido(item.id, 'content', { imageCaption: e.target.value })}
                                placeholder="Descripción de la imagen"
                                className={getFieldClass(`contenido_${index}_imageCaption`)}
                              />
                            </div>
                          )}

                          {/* Texto */}
                          {item.type === 'text' && (
                            <div className={styles.textContent}>
                              <textarea
                                value={item.content.text || ''}
                                onChange={(e) => {
                                  actualizarContenido(item.id, 'content', { text: e.target.value });
                                  clearFieldError(`contenido_${index}_text`);
                                }}
                                placeholder="Contenido de texto"
                                rows={6}
                                className={getFieldClass(`contenido_${index}_text`)}
                              />
                              {formErrors[`contenido_${index}_text`] && (
                                <span className={styles.errorMessage}>{formErrors[`contenido_${index}_text`]}</span>
                              )}
                            </div>
                          )}

                          {/* Descripción opcional */}
                          <textarea
                            value={item.content.description || ''}
                            onChange={(e) => actualizarContenido(item.id, 'content', { description: e.target.value })}
                            placeholder="Descripción o notas adicionales (opcional)"
                            className={getFieldClass(`contenido_${index}_description`)}
                            rows={2}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingLesson(null);
                      resetForm();
                    }}
                    className={styles.cancelButton}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={editingLesson ? actualizarLeccion : crearLeccion}
                    className={styles.saveButton}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={16} className={styles.spinning} />
                        {editingLesson ? 'Actualizando...' : 'Creando...'}
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        {editingLesson ? 'Actualizar' : 'Crear'} Lección
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const adminCheck = await verifyAdminAccess(context);
  
  if (!adminCheck.isAdmin) {
    return {
      redirect: {
        destination: adminCheck.redirectTo || '/',
        permanent: false,
      },
    };
  }

  return {
    props: {
      session: adminCheck.session
    },
  };
};

export default AdminLecciones; 