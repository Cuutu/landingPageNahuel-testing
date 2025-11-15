import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ImageUploader, { CloudinaryImage } from '@/components/ImageUploader';
import { motion } from 'framer-motion';
import { 
  ArrowLeft,
  Calendar,
  Clock,
  User as UserIcon,
  Eye,
  BookOpen,
  TrendingUp,
  FileText,
  ChevronLeft,
  ChevronRight,
  List,
  Edit,
  Save,
  X
} from 'lucide-react';
import styles from '@/styles/ReportView.module.css';
import dbConnect from '@/lib/mongodb';
import Report from '@/models/Report';
import User from '@/models/User';
import { htmlToText, textToHtml } from '@/lib/textUtils';

interface Article {
  _id: string;
  title: string;
  content: string;
  order: number;
  isPublished: boolean;
  readTime: number;
  createdAt: string;
}

interface ReportData {
  _id: string;
  title: string;
  content: string;
  articles?: Article[];
  author: {
    _id: string;
    name: string;
    email: string;
    image?: string;
  };
  type: string;
  category: string;
  coverImage?: {
    url: string;
    optimizedUrl?: string;
  };
  images?: Array<{
    url: string;
    secure_url?: string;
    optimizedUrl?: string;
    originalUrl?: string;
    thumbnailUrl?: string;
    caption?: string;
    order: number;
    public_id?: string;
    width?: number;
    height?: number;
    format?: string;
    bytes?: number;
  }>;
  isPublished: boolean;
  publishedAt: string;
  views: number;
  readTime: number;
  createdAt: string;
}

interface ReportViewProps {
  report: ReportData;
  currentUser: any;
  userRole: string;
}

const ReportView: React.FC<ReportViewProps> = ({ report, currentUser, userRole }) => {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const [showArticlesList, setShowArticlesList] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [stickyImage, setStickyImage] = useState<any>(null);
  const [showStickyModal, setShowStickyModal] = useState(false);
  const [currentStickyImageIndex, setCurrentStickyImageIndex] = useState(0);
  const [isScrolledPastImages, setIsScrolledPastImages] = useState(false);
  
  // Estados para edición de informe
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    content: '',
    isPublished: true
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [editImages, setEditImages] = useState<CloudinaryImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const handleBack = () => {
    router.back();
  };

  // Funciones para edición de informe
  const openEditModal = () => {
    // Convertir el contenido HTML a texto plano para edición
    const plainTextContent = htmlToText(report.content || '');
    
    console.log('🔄 Abriendo modal de edición:', {
      title: report.title,
      contentLength: report.content?.length || 0,
      plainTextLength: plainTextContent.length,
      contentPreview: plainTextContent.substring(0, 100)
    });
    
    setEditFormData({
      title: report.title,
      content: plainTextContent, // Usar texto plano en lugar de HTML
      isPublished: report.isPublished
    });
    // Convertir las imágenes del reporte al formato CloudinaryImage
    const cloudinaryImages: CloudinaryImage[] = (report.images || []).map((img: any) => ({
      public_id: img.public_id || `temp_${Date.now()}_${Math.random()}`,
      url: img.url,
      secure_url: img.optimizedUrl || img.url,
      width: img.width || 0,
      height: img.height || 0,
      format: img.format || 'jpg',
      bytes: img.bytes || 0,
      caption: img.caption,
      order: img.order
    }));
    setEditImages(cloudinaryImages);
    setShowEditModal(true);
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleUpdateReport = async () => {
    if (!editFormData.title.trim() || !editFormData.content.trim()) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setIsUpdating(true);
    try {
      // Convertir el contenido de texto plano a HTML antes de enviar
      const htmlContent = textToHtml(editFormData.content);
      
      console.log('📤 Enviando actualización:', {
        title: editFormData.title,
        plainTextLength: editFormData.content.length,
        htmlContentLength: htmlContent.length,
        htmlPreview: htmlContent.substring(0, 100)
      });
      
      // Actualizar el campo 'order' de cada imagen basándose en su posición actual
      const imagesWithOrder = editImages.map((img, index) => ({
        ...img,
        order: index + 1
      }));

      const response = await fetch(`/api/reports/${report._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editFormData.title,
          content: htmlContent, // Enviar HTML en lugar de texto plano
          isPublished: editFormData.isPublished,
          images: imagesWithOrder
        }),
      });

      if (response.ok) {
        const updatedReport = await response.json();
        // Actualizar el estado local del reporte
        Object.assign(report, updatedReport.data.report);
        setShowEditModal(false);
        alert('Informe actualizado exitosamente');
        // Recargar la página para mostrar los cambios
        router.reload();
      } else {
        const error = await response.json();
        alert(`Error al actualizar el informe: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating report:', error);
      alert('Error al actualizar el informe');
    } finally {
      setIsUpdating(false);
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditFormData({
      title: '',
      content: '',
      isPublished: true
    });
    setEditImages([]);
  };

  // Funciones para manejo de imágenes en edición
  const handleImageUploaded = (image: CloudinaryImage) => {
    setEditImages(prev => [...prev, image]);
    setUploadingImages(false);
    console.log('✅ Imagen adicional agregada:', image.public_id);
  };
  
  // Funciones para reordenar imágenes
  const moveImageUp = (index: number) => {
    if (index <= 0) return;
    setEditImages(prev => {
      const newImages = [...prev];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      return newImages;
    });
  };

  const moveImageDown = (index: number) => {
    if (index >= editImages.length - 1) return;
    setEditImages(prev => {
      const newImages = [...prev];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      return newImages;
    });
  };

  const handleUploadStart = () => {
    setUploadingImages(true);
  };

  const handleUploadError = (error: string) => {
    console.error('❌ Error subiendo imagen:', error);
    alert(`Error subiendo imagen: ${error}`);
    setUploadingImages(false);
  };

  const removeImage = (publicId: string) => {
    setEditImages(prev => prev.filter(img => img.public_id !== publicId));
  };

  // Función para actualizar el caption de una imagen en edición
  const updateImageCaption = (publicId: string, caption: string) => {
    setEditImages(prev => prev.map(img => 
      img.public_id === publicId ? { ...img, caption } : img
    ));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'trader-call':
        return <TrendingUp size={20} />;
      case 'smart-money':
        return <BookOpen size={20} />;
      case 'cash-flow':
        return <FileText size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'trader-call':
        return 'Trader Call';
      case 'smart-money':
        return 'Smart Money';
      case 'cash-flow':
        return 'Cash Flow';
      default:
        return 'Análisis';
    }
  };

  // Obtener artículos publicados ordenados
  const publishedArticles = report.articles?.filter(article => article.isPublished).sort((a, b) => a.order - b.order) || [];

  // Tiempo de lectura total (solo del informe principal)
  const totalReadTime = report.readTime;

  const handlePreviousArticle = () => {
    if (currentArticleIndex > 0) {
      setCurrentArticleIndex(currentArticleIndex - 1);
    }
  };

  const handleNextArticle = () => {
    if (currentArticleIndex < publishedArticles.length - 1) {
      setCurrentArticleIndex(currentArticleIndex + 1);
    }
  };

  const handleArticleSelect = (index: number) => {
    setCurrentArticleIndex(index);
    setShowArticlesList(false);
  };

  // Funciones para navegación de imágenes
  const handleImageClick = (index: number) => {
    setCurrentImageIndex(index);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleImageSticky = (image: any, index: number) => {
    setStickyImage({ ...image, index });
  };

  const closeStickyImage = () => {
    setStickyImage(null);
  };

  const openStickyModal = () => {
    if (stickyImage) {
      setCurrentImageIndex(stickyImage.index);
      setShowStickyModal(true);
    }
  };

  const closeStickyModal = () => {
    setShowStickyModal(false);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const nextImage = () => {
    if (report.images && report.images.length > 0 && currentImageIndex < report.images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      resetZoom();
    }
  };

  const prevImage = () => {
    if (report.images && report.images.length > 0 && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      resetZoom();
    }
  };

  // Navegación con teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!showImageModal) return;
      
      if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      } else if (e.key === 'Escape') {
        closeImageModal();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [showImageModal, currentImageIndex, report.images]);

  // Detectar scroll para hacer sticky automáticamente las imágenes
  useEffect(() => {
    const handleScroll = () => {
      const imageGalleryElement = document.querySelector('[data-image-gallery]');
      if (!imageGalleryElement || !report.images || report.images.length === 0) return;

      const galleryRect = imageGalleryElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Si la galería de imágenes se ha scrolleado fuera de la vista (completamente arriba)
      if (galleryRect.bottom < 0) {
        if (!isScrolledPastImages) {
          setIsScrolledPastImages(true);
          // Hacer sticky la primera imagen automáticamente
          setStickyImage({ ...report.images[0], index: 0 });
          setCurrentStickyImageIndex(0);
        }
      } else {
        if (isScrolledPastImages) {
          setIsScrolledPastImages(false);
          setStickyImage(null);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isScrolledPastImages, report.images]);

  // Cambiar imagen sticky automáticamente cada 5 segundos - DESHABILITADO
  /*
  useEffect(() => {
    if (!stickyImage || !report.images || report.images.length <= 1) return;

    const interval = setInterval(() => {
      const nextIndex = (currentStickyImageIndex + 1) % (report.images?.length || 1);
      if (report.images && report.images[nextIndex]) {
        setStickyImage({ ...report.images[nextIndex], index: nextIndex });
        setCurrentStickyImageIndex(nextIndex);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [stickyImage, currentStickyImageIndex, report.images]);
  */

  return (
    <>
      <Head>
        <title>{report.title} - Informe de Análisis | Nahuel Lozano</title>
        <meta name="description" content={`Informe de análisis: ${report.title}. ${report.content.substring(0, 160)}...`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* Header con navegación */}
        <div className={styles.header}>
          <div className={styles.container}>
            <button onClick={handleBack} className={styles.backButton}>
              <ArrowLeft size={20} />
              Volver
            </button>
            
            <div className={styles.breadcrumb}>
              <span>Recursos</span>
              <span>/</span>
              <span>Informes</span>
              <span>/</span>
              <span>{report.title}</span>
            </div>
          </div>
        </div>

        <div className={styles.container}>
          {/* Hero Section */}
          <motion.section 
            className={styles.heroSection}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className={styles.heroContent}>
              {/* Badge de categoría */}
              <div className={styles.categoryBadge}>
                {getCategoryIcon(report.category)}
                <span>{getCategoryName(report.category)}</span>
              </div>

              {/* Título */}
              <h1 className={styles.title}>{report.title}</h1>

              {/* Meta información - OCULTA */}

              {/* Botón de editar para administradores */}
              {userRole === 'admin' && (
                <div className={styles.adminActions}>
                  <button 
                    onClick={openEditModal}
                    className={styles.editReportButton}
                  >
                    ✏️ Editar Informe
                  </button>
                </div>
              )}
            </div>
          </motion.section>

          {/* Contenido del informe */}
          <motion.section 
            className={styles.contentSection}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className={styles.contentWrapper}>
              {/* Contenido principal */}
              <div className={styles.mainContent}>
                {/* Contenido principal del informe - AHORA PRIMERO */}
                <div className={styles.reportContent}>
                  <h2>📋 Contenido Principal del Informe</h2>
                  <div 
                    className={styles.content}
                    dangerouslySetInnerHTML={{ __html: report.content }}
                  />
                </div>

                {/* Navegación de artículos - AHORA DESPUÉS */}
                {publishedArticles.length > 0 && (
                  <div className={styles.articlesNavigation}>
                    <div className={styles.articlesHeader}>
                      <h2>📚 Artículos del Informe</h2>
                      <button 
                        onClick={() => setShowArticlesList(!showArticlesList)}
                        className={styles.articlesListButton}
                      >
                        <List size={20} />
                        Lista de Artículos
                      </button>
                    </div>

                    {/* Lista desplegable de artículos */}
                    {showArticlesList && (
                      <div className={styles.articlesList}>
                        {publishedArticles.map((article, index) => (
                          <button
                            key={article._id}
                            onClick={() => handleArticleSelect(index)}
                            className={`${styles.articleListItem} ${index === currentArticleIndex ? styles.activeArticle : ''}`}
                          >
                            <div className={styles.articleListInfo}>
                              <span className={styles.articleOrder}>Artículo {article.order}</span>
                              <h4 className={styles.articleListTitle}>{article.title}</h4>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Navegación entre artículos */}
                    <div className={styles.articleNavigation}>
                      <button
                        onClick={handlePreviousArticle}
                        disabled={currentArticleIndex === 0}
                        className={styles.articleNavButton}
                      >
                        <ChevronLeft size={20} />
                        Anterior
                      </button>
                      
                      <span className={styles.articleCounter}>
                        Artículo {currentArticleIndex + 1} de {publishedArticles.length}
                      </span>
                      
                      <button
                        onClick={handleNextArticle}
                        disabled={currentArticleIndex === publishedArticles.length - 1}
                        className={styles.articleNavButton}
                      >
                        Siguiente
                        <ChevronRight size={20} />
                      </button>
                    </div>

                    {/* Contenido del artículo actual */}
                    <div className={styles.currentArticle}>
                      <h3 className={styles.articleTitle}>
                        Artículo {publishedArticles[currentArticleIndex].order}: {publishedArticles[currentArticleIndex].title}
                      </h3>
                      <div 
                        className={styles.articleContent}
                        dangerouslySetInnerHTML={{ __html: publishedArticles[currentArticleIndex].content }}
                      />
                      <div className={styles.articleMeta}>
                        <span>Publicado: {formatDate(publishedArticles[currentArticleIndex].createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar con información adicional */}
              <aside className={styles.sidebar} data-sidebar>
                {/* Información del informe - OCULTA */}
                <div className={styles.sidebarCard} style={{ display: 'none' }}>
                  <h3>Información del Informe</h3>
                  <div className={styles.infoItem}>
                    <strong>Tipo:</strong> {report.type}
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Categoría:</strong> {getCategoryName(report.category)}
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Autor:</strong> {report.author.name}
                  </div>
                  <div className={styles.infoItem}>
                    <strong>Publicado:</strong> {formatDate(report.publishedAt)}
                  </div>
                  {publishedArticles.length > 0 && (
                    <div className={styles.infoItem}>
                      <strong>Artículos:</strong> {publishedArticles.length} publicados
                    </div>
                  )}
                </div>

                {/* Lista de artículos en sidebar */}
                {publishedArticles.length > 0 && (
                  <div className={styles.sidebarCard}>
                    <h3>📚 Artículos del Informe</h3>
                    <div className={styles.sidebarArticlesList}>
                      {publishedArticles.map((article, index) => (
                        <button
                          key={article._id}
                          onClick={() => handleArticleSelect(index)}
                          className={`${styles.sidebarArticleItem} ${index === currentArticleIndex ? styles.activeSidebarArticle : ''}`}
                        >
                          <div className={styles.sidebarArticleInfo}>
                            <span className={styles.sidebarArticleOrder}>Artículo {article.order}</span>
                            <h4 className={styles.sidebarArticleTitle}>{article.title}</h4>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Imágenes adicionales */}
                {report.images && report.images.length > 0 && (
                  <div className={styles.sidebarCard}>
                    <h3>📸 Imágenes del Informe ({report.images.length})</h3>
                    <div className={styles.imageGallery} data-image-gallery>
                      {report.images.map((image, index) => (
                        <div 
                          key={index}
                          className={styles.galleryItem}
                          onClick={() => handleImageClick(index)}
                        >
                          <img 
                            src={image.thumbnailUrl || image.secure_url || image.url}
                            alt={image.caption || `Imagen ${index + 1}`}
                            className={styles.galleryThumbnail}
                            onError={(e) => {
                              console.error('Error loading image:', image);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          {image.caption && (
                            <p className={styles.imageCaption}>{image.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </motion.section>

          {/* Modal para imágenes mejorado */}
          {report.images && report.images.length > 0 && showImageModal && (
            <div 
              className={styles.imageModal}
              onClick={closeImageModal}
            >
              <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeImageModal} 
              onClick={closeImageModal}
              aria-label="Cerrar modal de imagen"
            >
              ×
            </button>
            
            <div 
              className={styles.imageModalContent}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {report.images.length > 1 && (
                <button 
                  className={styles.imageNavButton} 
                  onClick={prevImage}
                  disabled={currentImageIndex === 0}
                  aria-label="Imagen anterior"
                >
                  ‹
                </button>
              )}
              
              <div 
                className={styles.zoomableImageContainer}
                style={{
                  transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center'
                }}
              >
                <img 
                  src={report.images[currentImageIndex]?.originalUrl || report.images[currentImageIndex]?.secure_url || report.images[currentImageIndex]?.url}
                  alt={report.images[currentImageIndex]?.caption || `Imagen ${currentImageIndex + 1}`}
                  className={styles.modalImage}
                  draggable={false}
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    width: 'auto', 
                    height: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </div>
              
              {report.images.length > 1 && (
                <button 
                  className={styles.imageNavButton} 
                  onClick={nextImage}
                  disabled={currentImageIndex === report.images.length - 1}
                  aria-label="Imagen siguiente"
                >
                  ›
                </button>
              )}
            </div>

            {/* Controles de zoom ABAJO con caption integrado */}
            <div className={styles.zoomControls}>
              <span className={styles.imageCounter}>
                {currentImageIndex + 1} de {report.images.length}
              </span>
              {report.images[currentImageIndex]?.caption && (
                <span className={styles.imageCaption}>
                  {report.images[currentImageIndex].caption}
                </span>
              )}
              <div className={styles.zoomButtonGroup}>
                <button 
                  className={styles.zoomButton} 
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.5}
                  aria-label="Alejar"
                >
                  −
                </button>
                <span className={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
                <button 
                  className={styles.zoomButton} 
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3}
                  aria-label="Acercar"
                >
                  +
                </button>
                <button 
                  className={styles.zoomButton} 
                  onClick={resetZoom}
                  aria-label="Resetear zoom"
                >
                  ⌂
                </button>
              </div>
            </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Imagen Sticky Flotante */}
      {stickyImage && (
        <div className={styles.stickyImageContainer}>
          <div className={styles.stickyImage} onClick={openStickyModal}>
            <img 
              src={stickyImage.optimizedUrl || stickyImage.url}
              alt={stickyImage.caption || `Imagen ${stickyImage.index + 1}`}
            />
            <div className={styles.stickyImageTitle}>
              {stickyImage.caption || `Imagen ${stickyImage.index + 1}`}
            </div>
            <div className={styles.stickyImageCounter}>
              {stickyImage.index + 1} / {report.images?.length || 1}
            </div>
            <button 
              className={styles.closeStickyButton}
              onClick={closeStickyImage}
            >
              ×
            </button>
            {/* Controles de navegación */}
            {report.images && report.images.length > 1 && (
              <>
                <button 
                  className={styles.stickyNavButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (report.images) {
                      const prevIndex = currentStickyImageIndex === 0 ? report.images.length - 1 : currentStickyImageIndex - 1;
                      setStickyImage({ ...report.images[prevIndex], index: prevIndex });
                      setCurrentStickyImageIndex(prevIndex);
                    }
                  }}
                  style={{ left: '4px' }}
                >
                  ‹
                </button>
                <button 
                  className={styles.stickyNavButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (report.images) {
                      const nextIndex = (currentStickyImageIndex + 1) % report.images.length;
                      setStickyImage({ ...report.images[nextIndex], index: nextIndex });
                      setCurrentStickyImageIndex(nextIndex);
                    }
                  }}
                  style={{ right: '4px' }}
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal para imagen sticky */}
      {showStickyModal && report.images && report.images.length > 0 && (
        <div className={styles.imageModal} onClick={closeStickyModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeImageModal} 
              onClick={closeStickyModal}
              aria-label="Cerrar modal de imagen"
            >
              ×
            </button>
            
            <div 
              className={styles.imageModalContent}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {report.images.length > 1 && (
                <button 
                  className={styles.imageNavButton} 
                  onClick={prevImage}
                  disabled={currentImageIndex === 0}
                  aria-label="Imagen anterior"
                >
                  ‹
                </button>
              )}
              
              <div 
                className={styles.zoomableImageContainer}
                style={{
                  transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                  transformOrigin: 'center center'
                }}
              >
                <img 
                  src={report.images[currentImageIndex]?.originalUrl || report.images[currentImageIndex]?.secure_url || report.images[currentImageIndex]?.url}
                  alt={report.images[currentImageIndex]?.caption || `Imagen ${currentImageIndex + 1}`}
                  className={styles.modalImage}
                  draggable={false}
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    width: 'auto', 
                    height: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </div>
              
              {report.images.length > 1 && (
                <button 
                  className={styles.imageNavButton} 
                  onClick={nextImage}
                  disabled={currentImageIndex === report.images.length - 1}
                  aria-label="Imagen siguiente"
                >
                  ›
                </button>
              )}
            </div>

            {/* Controles de zoom ABAJO con caption integrado */}
            <div className={styles.zoomControls}>
              <span className={styles.imageCounter}>
                {currentImageIndex + 1} de {report.images.length}
              </span>
              {report.images[currentImageIndex]?.caption && (
                <span className={styles.imageCaption}>
                  {report.images[currentImageIndex].caption}
                </span>
              )}
              <div className={styles.zoomButtonGroup}>
                <button 
                  className={styles.zoomButton} 
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.5}
                  aria-label="Alejar"
                >
                  −
                </button>
                <span className={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
                <button 
                  className={styles.zoomButton} 
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3}
                  aria-label="Acercar"
                >
                  +
                </button>
                <button 
                  className={styles.zoomButton} 
                  onClick={resetZoom}
                  aria-label="Resetear zoom"
                >
                  ⌂
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición de informe */}
      {showEditModal && (
        <div className={styles.editModal}>
          <div className={styles.editModalContent}>
            <div className={styles.editModalHeader}>
              <h2>✏️ Editar Informe</h2>
              <button 
                onClick={closeEditModal}
                className={styles.closeEditModal}
              >
                <X size={24} />
              </button>
            </div>

            <div className={styles.editForm}>
              <div className={styles.formGroup}>
                <label htmlFor="title">Título del Informe</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={editFormData.title}
                  onChange={handleEditFormChange}
                  className={styles.formInput}
                  placeholder="Ingresa el título del informe"
                />
              </div>


              <div className={styles.formGroup}>
                <label htmlFor="content">Contenido del Informe</label>
                <textarea
                  id="content"
                  name="content"
                  value={editFormData.content}
                  onChange={handleEditFormChange}
                  className={styles.formTextarea}
                  placeholder="Escribe el contenido del informe aquí..."
                  rows={10}
                />
              </div>

              {/* Sección de imágenes */}
              <div className={styles.formGroup}>
                <label>Imágenes del Informe</label>
                
                {/* Componente ImageUploader */}
                <ImageUploader
                  onImageUploaded={handleImageUploaded}
                  onUploadStart={handleUploadStart}
                  onError={handleUploadError}
                  multiple={true}
                  maxFiles={10}
                  buttonText="📸 Agregar Imágenes"
                  className={styles.imageUploader}
                />

                {/* Lista de imágenes */}
                {editImages.length > 0 && (
                  <div className={styles.editImagesList}>
                    {editImages.map((image, index) => (
                      <div key={image.public_id} className={styles.editImageItem}>
                        <img 
                          src={image.secure_url} 
                          alt={`Imagen ${index + 1}`}
                          className={styles.editImagePreview}
                        />
                        <div className={styles.editImageActions}>
                          <button
                            onClick={() => moveImageUp(index)}
                            disabled={index === 0}
                            className={styles.imageActionButton}
                            title="Mover arriba"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveImageDown(index)}
                            disabled={index === editImages.length - 1}
                            className={styles.imageActionButton}
                            title="Mover abajo"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removeImage(image.public_id)}
                            className={styles.imageActionButton}
                            title="Eliminar"
                          >
                            ×
                          </button>
                        </div>
                        <div className={styles.editImageOrder}>
                          {index + 1}
                        </div>
                        {/* Campo para título/caption de la imagen */}
                        <div style={{ marginTop: '0.75rem', width: '100%' }}>
                          <label htmlFor={`edit-caption-${image.public_id}`} style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block', color: 'var(--text-muted)' }}>
                            Título de la imagen:
                          </label>
                          <input
                            id={`edit-caption-${image.public_id}`}
                            type="text"
                            value={image.caption || ''}
                            onChange={(e) => updateImageCaption(image.public_id, e.target.value)}
                            placeholder="Ej: Gráfico de tendencia alcista"
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              color: '#ffffff',
                              fontSize: '0.875rem'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="isPublished"
                    checked={editFormData.isPublished}
                    onChange={handleEditFormChange}
                    className={styles.checkbox}
                  />
                  <span>Publicar informe</span>
                </label>
              </div>

              <div className={styles.editModalActions}>
                <button
                  onClick={closeEditModal}
                  className={styles.cancelButton}
                  disabled={isUpdating}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateReport}
                  className={styles.saveButton}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <div className={styles.spinner}></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      Guardar Cambios
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const session = await getSession(context);
    
    if (!session?.user?.email) {
      return {
        redirect: {
          destination: '/auth/signin',
          permanent: false,
        },
      };
    }

    // Obtener el rol del usuario
    await dbConnect();
    const user = await User.findOne({ email: session.user.email }).select('role');
    const userRole = user?.role || 'normal';
    
    const { id } = context.params!;
    
    if (!id || typeof id !== 'string') {
      return {
        notFound: true,
      };
    }

    // Obtener el informe directamente desde la base de datos para evitar problemas de fetch
    await dbConnect();

    // Asegurar que el modelo User esté registrado
    try {
      const mongoose = require('mongoose');
      if (!mongoose.models.User) {
        require('@/models/User');
      }
    } catch (modelError) {
      console.log('⚠️ [REPORT] Modelo User ya registrado o error menor:', modelError);
    }

    let reportDoc;
    try {
      // Primero obtenemos el informe sin populate
      reportDoc = await Report.findById(id).lean() as any;
      
      // Si existe el informe, obtenemos el autor por separado
      if (reportDoc && reportDoc.author) {
        const authorDoc = await User.findById(reportDoc.author)
          .select('name email image')
          .lean() as any;
        
        if (authorDoc) {
          reportDoc.author = authorDoc;
        }
      }

      if (!reportDoc) {
        return {
          notFound: true,
        };
      }

      // Verificar que el informe esté publicado
      if (!reportDoc.isPublished) {
        return {
          notFound: true,
        };
      }
    } catch (dbError) {
      console.error('💥 [REPORT] Error de base de datos:', dbError);
      return {
        notFound: true,
      };
    }

    // Procesar informe para incluir URLs optimizadas de Cloudinary
    let optimizedImageUrl = null;
    if (reportDoc.coverImage?.public_id) {
      try {
        const { getCloudinaryImageUrl } = await import('@/lib/cloudinary');
        // Usar 'limit' para mantener aspect ratio, solo limita el tamaño máximo
        optimizedImageUrl = getCloudinaryImageUrl(reportDoc.coverImage.public_id, {
          width: 1200,
          height: 800,
          crop: 'limit',
          format: 'webp',
          quality: 'auto'
        });
      } catch (error) {
        console.log('Error procesando imagen de portada:', error);
      }
    }

    // Generar URLs optimizadas para imágenes adicionales
    let optimizedImages: any[] = [];
    if (reportDoc.images && reportDoc.images.length > 0) {
      try {
        const { getCloudinaryImageUrl } = await import('@/lib/cloudinary');
        optimizedImages = reportDoc.images
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
          .map((img: any) => ({
            ...img,
            // URL optimizada para vista normal (mantiene aspect ratio)
            optimizedUrl: getCloudinaryImageUrl(img.public_id, {
              width: 1200,
              height: 1200,
              crop: 'limit',
              format: 'webp',
              quality: 'auto'
            }),
            // URL original para modal (sin transformaciones para ver tamaño completo)
            originalUrl: img.secure_url || img.url,
            // Thumbnail para galería (mantiene aspect ratio)
            thumbnailUrl: getCloudinaryImageUrl(img.public_id, {
              width: 400,
              height: 400,
              crop: 'limit',
              format: 'webp',
              quality: 'auto'
            })
          }));
      } catch (error) {
        console.log('Error procesando imágenes adicionales:', error);
        optimizedImages = reportDoc.images || [];
      }
    }

    const processedReport = {
      ...reportDoc,
      _id: reportDoc._id.toString(),
      author: {
        ...reportDoc.author,
        _id: reportDoc.author._id.toString()
      },
      // Imágenes adicionales optimizadas
      images: optimizedImages,
      // Procesar artículos si existen
      articles: reportDoc.articles ? reportDoc.articles.map((article: any) => ({
        ...article,
        _id: article._id.toString()
      })) : []
    };

    // DEBUG: Verificar qué valores están llegando
    console.log('🔍 [DEBUG] Valores de readTime:', {
      original: reportDoc.readTime,
      processed: processedReport.readTime,
      contentLength: reportDoc.content?.length,
      calculated: Math.ceil((reportDoc.content?.length || 0) / 1000)
    });

    return {
      props: {
        report: processedReport,
        currentUser: session.user,
        userRole: userRole,
      },
    };
  } catch (error) {
    console.error('Error en getServerSideProps:', error);
    return {
      notFound: true,
    };
  }
};

export default ReportView; 