/**
 * ✅ OPTIMIZADO: Modal de visualización de informes extraído para lazy loading
 * Este componente se carga dinámicamente solo cuando se necesita
 */
import React, { useState, useEffect } from 'react';
import styles from '@/styles/TraderCall.module.css';

export interface ReportViewModalProps {
  report: any;
  onClose: () => void;
  onEdit?: (report: any) => void;
  userRole?: string;
}

const ReportViewModal: React.FC<ReportViewModalProps> = ({ report, onClose, onEdit, userRole }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [stickyImage, setStickyImage] = useState<any>(null);
  const [showStickyModal, setShowStickyModal] = useState(false);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return '🎥';
      case 'analisis':
        return '📊';
      case 'mixed':
        return '📋';
      default:
        return '📄';
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'video':
        return 'Video';
      case 'analisis':
        return 'Análisis';
      case 'mixed':
        return 'Mixto';
      default:
        return 'Informe';
    }
  };

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.reportViewModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>
              <h2>{report.title}</h2>
              {/* Información del informe - OCULTA */}
              <div className={styles.reportMeta} style={{ display: 'none' }}>
                <span className={styles.reportDate}>
                  📅 {formatDate(report.publishedAt || report.createdAt)}
                </span>
                <span className={styles.reportType}>
                  {getReportTypeIcon(report.type)} {getReportTypeLabel(report.type)}
                </span>
                {report.author && (
                  <span className={styles.reportAuthor}>
                    👤 {typeof report.author === 'object' ? report.author.name || report.author.email : report.author}
                  </span>
                )}
                {report.category && (
                  <span className={styles.reportType}>
                    📂 {report.category.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                )}
              </div>
            </div>
            <div className={styles.modalActions}>
              {userRole === 'admin' && onEdit && (
                <button
                  className={styles.editButton}
                  onClick={() => onEdit(report)}
                  aria-label="Editar informe"
                  title="Editar informe"
                >
                  ✏️ Editar
                </button>
              )}
              <button
                className={styles.closeModal}
                onClick={onClose}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>
          </div>

          <div className={styles.reportContent}>
            {/* Imagen de portada */}
            {report.coverImage && (
              <div className={styles.reportCover}>
                <img 
                  src={report.coverImage.secure_url || report.coverImage.url} 
                  alt={report.title}
                  className={styles.coverImage}
                  loading="lazy"
                />
              </div>
            )}

            {/* Contenido del informe */}
            <div className={styles.reportText}>
              <div 
                className={styles.reportBody}
                dangerouslySetInnerHTML={{ __html: report.content }}
              />
            </div>

            {/* Imágenes adicionales */}
            {report.images && report.images.length > 0 && (
              <div className={styles.reportImages}>
                <h3>📸 Imágenes del Informe ({report.images.length})</h3>
                <div className={styles.imagesGrid}>
                  {report.images.map((image: any, index: number) => (
                    <div 
                      key={image.public_id} 
                      className={styles.imageThumbnail}
                    >
                      <div className={styles.imageContainer}>
                        <img 
                          src={image.secure_url || image.url} 
                          alt={image.caption || `Imagen ${index + 1}`}
                          loading="lazy"
                          onClick={() => handleImageClick(index)}
                        />
                        <div className={styles.imageActions}>
                          <button 
                            className={styles.stickyButton}
                            onClick={() => handleImageSticky(image, index)}
                            title="Hacer sticky"
                          >
                            📌
                          </button>
                          <button 
                            className={styles.viewButton}
                            onClick={() => handleImageClick(index)}
                            title="Ver en grande"
                          >
                            👁️
                          </button>
                        </div>
                      </div>
                      {image.caption && (
                        <div className={styles.imageCaption}>
                          {image.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estadísticas del informe */}
            <div className={styles.reportStats}>
              {report.images && report.images.length > 0 && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>📸 Imágenes</span>
                  <span className={styles.statValue}>{report.images.length}</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.modalFooter}>
            {/* Botones de descarga y compartir ELIMINADOS POR SEGURIDAD */}
          </div>
        </div>
      </div>

      {/* Modal para imágenes */}
      {showImageModal && report.images && report.images.length > 0 && (
        <div className={styles.imageModalOverlay} onClick={closeImageModal}>
          <div className={styles.imageModal} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeImageModal} 
              onClick={closeImageModal}
              aria-label="Cerrar modal de imagen"
            >
              ×
            </button>
            
            {/* Controles de zoom */}
            <div className={styles.zoomControls}>
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
                  src={report.images[currentImageIndex].secure_url || report.images[currentImageIndex].url}
                  alt={report.images[currentImageIndex].caption || `Imagen ${currentImageIndex + 1}`}
                  className={styles.modalImage}
                  loading="lazy"
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
            <div className={styles.imageModalInfo}>
              <span className={styles.imageCounter}>
                {currentImageIndex + 1} de {report.images.length}
              </span>
              {report.images[currentImageIndex].caption && (
                <span className={styles.imageCaption}>
                  {report.images[currentImageIndex].caption}
                </span>
              )}
            </div>
            
            {/* ✅ NUEVO: Botón de cerrar visible en móviles */}
            <button 
              onClick={closeImageModal}
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '12px 24px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                zIndex: 1000,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                minWidth: '120px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
                e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
              }}
              aria-label="Cerrar imagen"
            >
              <span>✕</span>
              <span>Cerrar</span>
            </button>
          </div>
        </div>
      )}

      {/* Imagen Sticky Flotante */}
      {stickyImage && (
        <div className={styles.stickyImageContainer}>
          <div className={styles.stickyImage} onClick={openStickyModal}>
            <img 
              src={stickyImage.secure_url || stickyImage.url}
              alt={stickyImage.caption || `Imagen ${stickyImage.index + 1}`}
            />
            <div className={styles.stickyImageTitle}>
              {stickyImage.caption || `Imagen ${stickyImage.index + 1}`}
            </div>
            <button 
              className={styles.closeStickyButton}
              onClick={closeStickyImage}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Modal para imagen sticky */}
      {showStickyModal && report.images && report.images.length > 0 && (
        <div className={styles.imageModalOverlay} onClick={closeStickyModal}>
          <div className={styles.imageModal} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.closeImageModal} 
              onClick={closeStickyModal}
              aria-label="Cerrar modal de imagen"
            >
              ×
            </button>
            
            {/* Controles de zoom */}
            <div className={styles.zoomControls}>
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
                  src={report.images[currentImageIndex].secure_url || report.images[currentImageIndex].url}
                  alt={report.images[currentImageIndex].caption || `Imagen ${currentImageIndex + 1}`}
                  className={styles.modalImage}
                  loading="lazy"
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
            <div className={styles.imageModalInfo}>
              <span className={styles.imageCounter}>
                {currentImageIndex + 1} de {report.images.length}
              </span>
              {report.images[currentImageIndex].caption && (
                <span className={styles.imageCaption}>
                  {report.images[currentImageIndex].caption}
                </span>
              )}
            </div>
            
            {/* ✅ NUEVO: Botón de cerrar visible en móviles */}
            <button 
              onClick={closeStickyModal}
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '12px 24px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                zIndex: 1000,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
                minWidth: '120px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
                e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
              }}
              aria-label="Cerrar imagen"
            >
              <span>✕</span>
              <span>Cerrar</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportViewModal;

