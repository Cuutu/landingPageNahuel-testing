import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  PlayCircle,
  BookOpen,
  Clock,
  Target,
  CheckCircle,
  Lock,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  FileText,
  Image,
  Youtube,
  FileDown,
  Star,
  Settings,
  Eye,
  Maximize2
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/LeccionesViewer.module.css';
import { 
  getCloudinaryPDFViewUrl, 
  getCloudinaryPDFDownloadUrl, 
  getCloudinaryDirectPDFUrl,
  getCloudinaryPDFDirectViewUrl,
  extractFileNameFromPublicId 
} from '@/lib/cloudinary';
import { 
  getDatabasePDFViewUrl,
  getDatabasePDFDownloadUrl,
  getPDFType,
  formatFileSize
} from '@/lib/databasePdf';

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
    imageUrl?: string;
    imageAlt?: string;
    imageCaption?: string;
    // Nuevos campos para archivos de Cloudinary
    pdfFile?: CloudinaryPDF;
    imageFile?: CloudinaryImage;
    text?: string;
    html?: string;
    description?: string;
    cloudinaryPdf?: {
      publicId: string;
      originalFileName?: string;
      fileSize?: number;
    };
    // Nuevo campo para PDFs en base de datos
    databasePdf?: {
      pdfId: string;
      fileName: string;
      originalName: string;
      fileSize: number;
      mimeType: string;
      uploadDate: Date;
    };
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
}

interface LeccionesViewerProps {
  lecciones: Lesson[];
  tipoEntrenamiento: string;
  userTrainings: string[]; // Array de tipos de entrenamientos que tiene el usuario
}

const LeccionesViewer: React.FC<LeccionesViewerProps> = ({ 
  lecciones, 
  tipoEntrenamiento,
  userTrainings 
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

  const currentLesson = lecciones[currentLessonIndex];

  // Verificar acceso a lección
  const hasAccessToLesson = (lesson: Lesson) => {
    if (lesson.esGratuita) return true;
    if (!lesson.requiereSuscripcion) return true;
    
    // Verificar si el usuario tiene el entrenamiento asignado
    return session && userTrainings.includes(lesson.tipoEntrenamiento);
  };

  // Marcar lección como completada
  const markLessonCompleted = async (lessonId: string) => {
    try {
      // API call para marcar como completada
      const response = await fetch('/api/lessons/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lessonId,
          action: 'complete'
        })
      });

      if (response.ok) {
        setCompletedLessons(prev => new Set([...Array.from(prev), lessonId]));
        toast.success('Lección completada');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Navegar entre lecciones
  const goToLesson = (index: number) => {
    if (index >= 0 && index < lecciones.length) {
      setCurrentLessonIndex(index);
    }
  };

  const goToPreviousLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    }
  };

  const goToNextLesson = () => {
    if (currentLessonIndex < lecciones.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    }
  };

  // Renderizar contenido por tipo
  const renderContent = (content: LessonContent) => {
    const hasAccess = hasAccessToLesson(currentLesson);

    if (!hasAccess) {
      return (
        <div className={styles.lockedContent}>
          <Lock size={48} />
          <h3>Contenido Bloqueado</h3>
          <p>Necesitas suscribirte para acceder a esta lección</p>
        </div>
      );
    }

    switch (content.type) {
      case 'youtube':
        return (
          <div className={styles.youtubePlayer}>
            <div className={styles.videoWrapper}>
              <iframe
                src={`https://www.youtube.com/embed/${content.content.youtubeId}`}
                title={content.content.youtubeTitle || content.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            {content.content.youtubeTitle && (
              <div className={styles.videoInfo}>
                <h4>{content.content.youtubeTitle}</h4>
                {content.content.youtubeDuration && (
                  <span className={styles.duration}>
                    <Clock size={16} />
                    {content.content.youtubeDuration}
                  </span>
                )}
              </div>
            )}
            {content.content.description && (
              <p className={styles.contentDescription}>{content.content.description}</p>
            )}
          </div>
        );

      case 'pdf':
        const pdfType = getPDFType(content.content);
        
        // Determinar URLs y información según el tipo de PDF
        let viewUrl: string | undefined;
        let downloadUrl: string | undefined;
        let directViewUrl: string | undefined;
        let pdfFileName: string;
        let pdfInfo: { size?: string; type?: string } = {};

        if (pdfType === 'database' && content.content.databasePdf) {
          // PDF almacenado en base de datos (nuevo sistema)
          viewUrl = getDatabasePDFViewUrl(
            content.content.databasePdf.pdfId,
            content.content.databasePdf.originalName
          );
          downloadUrl = getDatabasePDFDownloadUrl(
            content.content.databasePdf.pdfId,
            content.content.databasePdf.originalName
          );
          directViewUrl = viewUrl; // Para PDFs de BD, es la misma URL
          pdfFileName = content.content.databasePdf.originalName;
          pdfInfo = {
            size: formatFileSize(content.content.databasePdf.fileSize),
            type: 'Base de Datos'
          };
        } else if (pdfType === 'cloudinary' && content.content.cloudinaryPdf) {
          // PDF de Cloudinary (sistema anterior)
          pdfFileName = extractFileNameFromPublicId(
            content.content.cloudinaryPdf.publicId || ''
          );
          
          viewUrl = getCloudinaryPDFViewUrl(
            content.content.cloudinaryPdf.publicId,
            content.content.cloudinaryPdf.originalFileName || pdfFileName
          );
          downloadUrl = getCloudinaryPDFDownloadUrl(
            content.content.cloudinaryPdf.publicId,
            content.content.cloudinaryPdf.originalFileName || pdfFileName
          );
          directViewUrl = getCloudinaryPDFDirectViewUrl(content.content.cloudinaryPdf.publicId);
          
          pdfInfo = {
            size: content.content.cloudinaryPdf.fileSize 
              ? formatFileSize(content.content.cloudinaryPdf.fileSize)
              : undefined,
            type: 'Cloudinary'
          };
        } else {
          // Fallback para PDFs legacy
          pdfFileName = extractFileNameFromPublicId(
            content.content.pdfUrl || ''
          );
          viewUrl = content.content.pdfUrl;
          downloadUrl = content.content.pdfUrl;
          directViewUrl = content.content.pdfUrl;
          pdfInfo = { type: 'Legacy' };
        }

        return (
          <div className={styles.pdfContent}>
            <div className={styles.pdfHeader}>
              <FileText size={24} />
              <div className={styles.pdfInfo}>
                <h4>{content.title}</h4>
                {content.content.description && (
                  <p className={styles.pdfDescription}>{content.content.description}</p>
                )}
                <div className={styles.pdfMeta}>
                  <span>PDF: {pdfFileName}</span>
                  {pdfInfo.size && <span>• Tamaño: {pdfInfo.size}</span>}
                  {pdfInfo.type && (
                    <span className={`${styles.pdfTypeBadge} ${styles[`badge${pdfInfo.type.replace(/\s+/g, '')}`]}`}>
                      • {pdfInfo.type}
                    </span>
                  )}
                  {pdfType === 'database' && content.content.databasePdf && (
                    <span>• Subido: {new Date(content.content.databasePdf.uploadDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Viewer integrado del PDF */}
            <div className={styles.pdfViewer}>
              <iframe
                src={viewUrl}
                className={styles.pdfFrame}
                title={content.title}
                style={{ width: '100%', height: '600px', border: 'none', borderRadius: '0.5rem' }}
                onLoad={() => {
                  console.log(`✅ PDF cargado exitosamente desde ${pdfInfo.type}:`, pdfFileName);
                }}
                onError={(e) => {
                  console.warn(`❌ Error cargando PDF desde ${pdfInfo.type}, intentando fallback`);
                  // En caso de error, cambiar src al URL directo (solo para Cloudinary)
                  const iframe = e.target as HTMLIFrameElement;
                  if (directViewUrl && iframe.src !== directViewUrl) {
                    console.log('🔄 Cambiando a URL directa');
                    iframe.src = directViewUrl;
                  }
                }}
              />
              
              {/* Mensaje de fallback si el iframe no funciona */}
              <div className={styles.pdfFallback} style={{ display: 'none' }}>
                <p>Si el PDF no se visualiza correctamente, puedes:</p>
                <ul>
                  <li>
                    <a href={directViewUrl} target="_blank" rel="noopener noreferrer">
                      Abrir el PDF directamente en una nueva pestaña
                    </a>
                  </li>
                  <li>Descargar el archivo y abrirlo con tu lector de PDF preferido</li>
                </ul>
              </div>
            </div>
            
            {/* Acciones del PDF */}
            <div className={styles.pdfActions}>
              <button
                className={styles.pdfActionButton}
                onClick={() => window.open(downloadUrl, '_blank')}
                title="Descargar PDF"
              >
                <Download size={16} />
                Descargar PDF
              </button>
              
              <button
                className={styles.pdfActionButton}
                onClick={() => window.open(viewUrl, '_blank')}
                title="Abrir en nueva pestaña"
              >
                <ExternalLink size={16} />
                Abrir en Nueva Pestaña
              </button>
              
              {directViewUrl && directViewUrl !== viewUrl && (
                <button
                  className={`${styles.pdfActionButton} ${styles.fallbackButton}`}
                  onClick={() => window.open(directViewUrl, '_blank')}
                  title="Enlace directo (fallback)"
                >
                  <Eye size={16} />
                  Enlace Directo
                </button>
              )}
              
              {/* Información para administradores */}
              {userTrainings.includes('admin') && (
                <div className={styles.adminDebugInfo}>
                  <details>
                    <summary>🔧 Info Debug (Admin)</summary>
                    <div className={styles.debugDetails}>
                      <p><strong>Tipo:</strong> {pdfType}</p>
                      <p><strong>View URL:</strong> {viewUrl}</p>
                      <p><strong>Download URL:</strong> {downloadUrl}</p>
                      {pdfType === 'database' && content.content.databasePdf && (
                        <p><strong>PDF ID:</strong> {content.content.databasePdf.pdfId}</p>
                      )}
                      {pdfType === 'cloudinary' && content.content.cloudinaryPdf && (
                        <p><strong>Public ID:</strong> {content.content.cloudinaryPdf.publicId}</p>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </div>
        );

      case 'image':
        // Manejar imágenes de Cloudinary y URLs legacy
        const imageFile = content.content.imageFile;
        const imageUrl = imageFile?.secure_url || content.content.imageUrl;
        const imageAlt = content.content.imageAlt || content.title || 'Imagen';

        return (
          <div className={styles.imageContent}>
            <img 
              src={imageUrl}
              alt={imageAlt}
              className={styles.contentImage}
            />
            {content.content.imageCaption && (
              <p className={styles.imageCaption}>{content.content.imageCaption}</p>
            )}
            {content.content.description && (
              <p className={styles.contentDescription}>{content.content.description}</p>
            )}
          </div>
        );

      case 'text':
        return (
          <div className={styles.textContent}>
            {content.title && <h4>{content.title}</h4>}
            <div className={styles.textBody}>
              {content.content.text?.split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            {content.content.description && (
              <p className={styles.contentDescription}>{content.content.description}</p>
            )}
          </div>
        );

      case 'html':
        return (
          <div className={styles.htmlContent}>
            {content.title && <h4>{content.title}</h4>}
            <div 
              className={styles.htmlBody}
              dangerouslySetInnerHTML={{ __html: content.content.html || '' }}
            />
            {content.content.description && (
              <p className={styles.contentDescription}>{content.content.description}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Head>
        <title>
          {currentLesson?.titulo} - {tipoEntrenamiento === 'SwingTrading' ? 'Zero 2 Trader' : 'Dow Jones'}
        </title>
        <meta name="description" content={currentLesson?.descripcion} />
      </Head>

      <Navbar />

      <div className={styles.container}>
        {/* Sidebar con lista de lecciones */}
        <div className={`${styles.sidebar} ${showSidebar ? styles.sidebarOpen : styles.sidebarClosed}`}>
          <div className={styles.sidebarHeader}>
            <h3>
              {tipoEntrenamiento === 'SwingTrading' ? 'Zero 2 Trader' : 'Dow Jones'}
            </h3>
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={styles.sidebarToggle}
            >
              {showSidebar ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          <div className={styles.lessonsList}>
            {lecciones.map((lesson, index) => {
              const isCurrentLesson = index === currentLessonIndex;
              const isCompleted = completedLessons.has(lesson._id);
              const hasAccess = hasAccessToLesson(lesson);

              return (
                <motion.div
                  key={lesson._id}
                  className={`${styles.lessonItem} ${isCurrentLesson ? styles.lessonItemActive : ''}`}
                  onClick={() => hasAccess && goToLesson(index)}
                  whileHover={hasAccess ? { x: 4 } : {}}
                >
                  <div className={styles.lessonItemHeader}>
                    <div className={styles.lessonItemMeta}>
                      <span className={styles.lessonNumber}>
                        {lesson.modulo}.{lesson.numeroLeccion}
                      </span>
                      <div className={styles.lessonItemStatus}>
                        {!hasAccess && <Lock size={14} />}
                        {isCompleted && <CheckCircle size={14} />}
                      </div>
                    </div>
                    <span className={styles.lessonDuration}>
                      <Clock size={12} />
                      {lesson.duracionEstimada}min
                    </span>
                  </div>
                  <h4 className={styles.lessonItemTitle}>{lesson.titulo}</h4>
                  <div className={styles.lessonItemProgress}>
                    <div 
                      className={styles.progressBar}
                      style={{ 
                        width: isCompleted ? '100%' : isCurrentLesson ? '50%' : '0%' 
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Contenido principal */}
        <div className={styles.mainContent}>
          {currentLesson ? (
            <>
              {/* Header de la lección */}
              <div className={styles.lessonHeader}>
                <div className={styles.lessonHeaderLeft}>
                  <div className={styles.lessonMeta}>
                    <span className={styles.moduleTag}>
                      Módulo {currentLesson.modulo}
                    </span>
                    <span className={styles.lessonNumber}>
                      Lección {currentLesson.numeroLeccion}
                    </span>
                    <span className={`${styles.difficultyTag} ${styles[currentLesson.dificultad.toLowerCase()]}`}>
                      {currentLesson.dificultad}
                    </span>
                    {/* Botón de administración solo para admins */}
                    {session?.user?.role === 'admin' && (
                      <a
                        href={`/admin/lecciones?tipo=${tipoEntrenamiento}`}
                        className={styles.adminButton}
                        title="Administrar lecciones"
                      >
                        <Settings size={16} />
                        Admin
                      </a>
                    )}
                  </div>
                  <h1 className={styles.lessonTitle}>{currentLesson.titulo}</h1>
                  <p className={styles.lessonDescription}>{currentLesson.descripcion}</p>
                  
                  {/* Objetivos */}
                  {currentLesson.objetivos.length > 0 && (
                    <div className={styles.objectives}>
                      <h3>
                        <Target size={20} />
                        Objetivos de Aprendizaje
                      </h3>
                      <ul>
                        {currentLesson.objetivos.map((objetivo, index) => (
                          <li key={index}>
                            <CheckCircle size={16} />
                            {objetivo}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className={styles.lessonHeaderRight}>
                  <div className={styles.lessonStats}>
                    <div className={styles.stat}>
                      <Clock size={20} />
                      <span>{currentLesson.duracionEstimada} min</span>
                    </div>
                    <div className={styles.stat}>
                      <FileText size={20} />
                      <span>{currentLesson.contenido.length} elementos</span>
                    </div>
                  </div>
                  
                  {hasAccessToLesson(currentLesson) && (
                    <button
                      onClick={() => markLessonCompleted(currentLesson._id)}
                      className={styles.completeButton}
                      disabled={completedLessons.has(currentLesson._id)}
                    >
                      {completedLessons.has(currentLesson._id) ? (
                        <>
                          <CheckCircle size={16} />
                          Completada
                        </>
                      ) : (
                        <>
                          <Star size={16} />
                          Marcar como Completada
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Contenido de la lección */}
              <div className={styles.lessonContent}>
                {currentLesson.contenido
                  .sort((a, b) => a.orden - b.orden)
                  .map((content, index) => (
                    <motion.div
                      key={content.id}
                      className={styles.contentSection}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      {content.title && (
                        <h3 className={styles.contentTitle}>
                          {content.type === 'youtube' && <Youtube size={20} />}
                          {content.type === 'pdf' && <FileDown size={20} />}
                          {content.type === 'image' && <Image size={20} />}
                          {content.type === 'text' && <FileText size={20} />}
                          {content.type === 'html' && <FileText size={20} />}
                          {content.title}
                        </h3>
                      )}
                      {renderContent(content)}
                    </motion.div>
                  ))}
              </div>

              {/* Recursos adicionales */}
              {currentLesson.recursos.length > 0 && hasAccessToLesson(currentLesson) && (
                <div className={styles.resources}>
                  <h3>Recursos Adicionales</h3>
                  <div className={styles.resourcesList}>
                    {currentLesson.recursos.map((recurso, index) => (
                      <a
                        key={index}
                        href={recurso.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${styles.resourceItem} ${styles[recurso.tipo]}`}
                      >
                        {recurso.tipo === 'descarga' && <Download size={16} />}
                        {recurso.tipo === 'enlace' && <ExternalLink size={16} />}
                        {recurso.tipo === 'referencia' && <BookOpen size={16} />}
                        <span>{recurso.titulo}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Navegación entre lecciones */}
              <div className={styles.lessonNavigation}>
                <button
                  onClick={goToPreviousLesson}
                  disabled={currentLessonIndex === 0}
                  className={styles.navButton}
                >
                  <ChevronLeft size={20} />
                  Lección Anterior
                </button>

                <span className={styles.lessonProgress}>
                  {currentLessonIndex + 1} de {lecciones.length}
                </span>

                <button
                  onClick={goToNextLesson}
                  disabled={currentLessonIndex === lecciones.length - 1}
                  className={styles.navButton}
                >
                  Siguiente Lección
                  <ChevronRight size={20} />
                </button>
              </div>
            </>
          ) : (
            <div className={styles.noLesson}>
              <BookOpen size={48} />
              <h3>No hay lecciones disponibles</h3>
              <p>Este entrenamiento aún no tiene lecciones publicadas.</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { tipo } = context.query;

  // Validar tipo de entrenamiento
  if (!tipo || !['SwingTrading', 'DowJones'].includes(tipo as string)) {
    return {
      notFound: true
    };
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    // Obtener lecciones del tipo específico
    const leccionesResponse = await fetch(`${baseUrl}/api/lessons?tipo=${tipo}&activa=true&limit=100`);
    
    if (!leccionesResponse.ok) {
      throw new Error('Error fetching lessons');
    }
    
    const leccionesData = await leccionesResponse.json();

    // Intentar obtener entrenamientos del usuario si está autenticado
    let userTrainings: string[] = [];
    
    try {
      // Obtener session del contexto
      const { getServerSession } = await import('next-auth/next');
      const { authOptions } = await import('@/lib/googleAuth');
      const session = await getServerSession(context.req, context.res, authOptions);
      
      if (session?.user?.email) {
        // Buscar usuario directamente en la BD para obtener entrenamientos
        const { default: connectDB } = await import('@/lib/mongodb');
        const { default: User } = await import('@/models/User');
        
        await connectDB();
        const usuario = await User.findOne({ email: session.user.email });
        
        if (usuario && usuario.entrenamientos) {
          // Extraer tipos de entrenamientos activos
          for (const entrenamiento of usuario.entrenamientos) {
            if (entrenamiento.activo) {
              userTrainings.push(entrenamiento.tipo);
            }
          }
        }
      }
    } catch (userError) {
      console.error('Error fetching user trainings:', userError);
      // Continuar sin entrenamientos de usuario si hay error
    }
    
    return {
      props: {
        lecciones: leccionesData.data.lecciones || [],
        tipoEntrenamiento: tipo,
        userTrainings: userTrainings
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    
    return {
      props: {
        lecciones: [],
        tipoEntrenamiento: tipo,
        userTrainings: []
      }
    };
  }
};

export default LeccionesViewer; 