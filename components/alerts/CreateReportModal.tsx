/**
 * ✅ OPTIMIZADO: Modal de creación/edición de informes extraído para lazy loading
 * Este componente se carga dinámicamente solo cuando se necesita
 */
import React, { useState, useEffect } from 'react';
import ImageUploader, { CloudinaryImage } from '@/components/ImageUploader';
import { htmlToText } from '../../lib/textUtils';
import styles from '@/styles/TraderCall.module.css';

export interface CreateReportModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
  initialData?: any;
  isEdit?: boolean;
}

const CreateReportModal: React.FC<CreateReportModalProps> = ({ 
  onClose, 
  onSubmit, 
  loading, 
  initialData, 
  isEdit = false 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    type: 'text',
    category: 'trader-call',
    content: '',
    isFeature: false,
    publishedAt: new Date().toISOString().split('T')[0],
    status: 'published'
  });

  const [images, setImages] = useState<CloudinaryImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Cargar datos iniciales cuando se edita
  useEffect(() => {
    if (isEdit && initialData) {
      // Resetear el formulario primero
      setFormData({
        title: '',
        type: 'text',
        category: 'trader-call',
        content: '',
        isFeature: false,
        publishedAt: new Date().toISOString().split('T')[0],
        status: 'published'
      });
      
      // Convertir HTML a texto plano
      const originalContent = initialData.content || '';
      const plainTextContent = htmlToText(originalContent);
      
      // Actualizar el formulario con los datos convertidos
      setFormData({
        title: initialData.title || '',
        type: initialData.type || 'text',
        category: initialData.category || 'trader-call',
        content: plainTextContent,
        isFeature: initialData.isFeature || false,
        publishedAt: initialData.publishedAt ?
          new Date(initialData.publishedAt).toISOString().split('T')[0] :
          new Date().toISOString().split('T')[0],
        status: initialData.status || 'published'
      });

      // Cargar imágenes si existen
      if (initialData.images && Array.isArray(initialData.images)) {
        setImages(initialData.images.map((img: any) => ({
          public_id: img.public_id,
          url: img.url || img.secure_url,
          secure_url: img.secure_url || img.url,
          width: img.width,
          height: img.height,
          format: img.format,
          bytes: img.bytes,
          caption: img.caption || '',
          order: img.order || 0
        })));
      } else {
        setImages([]);
      }
    } else if (!isEdit) {
      // Resetear formulario cuando se cierra o se abre para crear nuevo
      setFormData({
        title: '',
        type: 'text',
        category: 'trader-call',
        content: '',
        isFeature: false,
        publishedAt: new Date().toISOString().split('T')[0],
        status: 'published'
      });
      setImages([]);
    }
  }, [isEdit, initialData]);

  // Función para actualizar el caption de una imagen
  const updateImageCaption = (publicId: string, caption: string) => {
    setImages(prev => prev.map(img => 
      img.public_id === publicId ? { ...img, caption } : img
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('Título y contenido son obligatorios');
      return;
    }

    // Preparar datos con imágenes de Cloudinary con orden correcto
    const imagesWithOrder = images.map((img, index) => ({
      ...img,
      order: index + 1
    }));
    
    const submitData = {
      ...formData,
      publishedAt: new Date(formData.publishedAt),
      images: imagesWithOrder
    };
    
    onSubmit(submitData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUploaded = (image: CloudinaryImage) => {
    setImages(prev => [...prev, image]);
  };

  const handleUploadComplete = () => {
    setUploadingImages(false);
  };

  const removeImage = (publicId: string) => {
    setImages(prev => prev.filter(img => img.public_id !== publicId));
  };

  // Funciones para reordenar imágenes
  const moveImageUp = (index: number) => {
    if (index <= 0) return;
    setImages(prev => {
      const newImages = [...prev];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      return newImages;
    });
  };

  const moveImageDown = (index: number) => {
    if (index >= images.length - 1) return;
    setImages(prev => {
      const newImages = [...prev];
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
      return newImages;
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.createReportModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{isEdit ? 'Editar Informe Trader Call' : 'Crear Nuevo Informe Trader Call'}</h2>
          <button 
            className={styles.closeModal}
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.createReportForm}>
          <div className={styles.formSection}>
            <div className={styles.formGroup}>
              <label htmlFor="title">Título *</label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Título del informe Trader Call"
                required
                disabled={loading}
              />
            </div>

            {/* Campo Tipo - OCULTO */}
            <div className={styles.formGroup} style={{ display: 'none' }}>
              <label htmlFor="type">Tipo</label>
              <input
                id="type"
                type="text"
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                placeholder="Ej: Texto, Video, Mixto, Análisis, Reporte..."
                disabled={loading}
                style={{ 
                  cursor: 'text',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  border: '2px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  width: '100%'
                }}
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="publishedAt">Fecha de Publicación</label>
                <input
                  id="publishedAt"
                  type="date"
                  value={formData.publishedAt}
                  onChange={(e) => handleInputChange('publishedAt', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="content">Contenido Principal del Informe *</label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Contenido principal del informe"
                rows={6}
                required
                disabled={loading}
              />
            </div>

            {/* Imágenes adicionales */}
            <div className={styles.formGroup}>
              <label>Imágenes Adicionales</label>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Imágenes que se mostrarán dentro del contenido del informe
              </p>
              
              <ImageUploader
                onImageUploaded={handleImageUploaded}
                onUploadStart={() => setUploadingImages(true)}
                onUploadComplete={handleUploadComplete}
                onError={(error) => {
                  alert('Error subiendo imagen: ' + error);
                  setUploadingImages(false);
                }}
                maxFiles={5}
                multiple={true}
                buttonText="Subir Imágenes Adicionales"
                className={styles.additionalImagesUploader}
              />

              {/* Preview de imágenes adicionales */}
              {images.length > 0 && (
                <div className={styles.additionalImagesPreview}>
                  <h4>Imágenes Adicionales ({images.length}/5)</h4>
                  <div className={styles.imagesGrid}>
                    {images.map((image, index) => (
                      <div key={image.public_id} className={styles.imagePreviewItem} style={{ position: 'relative' }}>
                        {/* Badge numérico y botones de mover */}
                        <div style={{
                          position: 'absolute',
                          top: '5px',
                          left: '5px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          zIndex: 10
                        }}>
                          <div className={styles.imageOrderBadge} style={{
                            backgroundColor: 'rgba(139, 92, 246, 0.9)',
                            color: 'white',
                            borderRadius: '50%',
                            width: '25px',
                            height: '25px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 'bold'
                          }}>
                            {index + 1}
                          </div>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}>
                            {index > 0 && (
                              <button 
                                type="button" 
                                onClick={() => moveImageUp(index)}
                                className={styles.reorderButton}
                                title="Mover arriba"
                                style={{
                                  backgroundColor: 'rgba(59, 130, 246, 0.9)',
                                  border: 'none',
                                  borderRadius: '3px',
                                  color: 'white',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  fontSize: '0.75rem',
                                  minWidth: '20px',
                                  height: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: 1
                                }}
                              >
                                ↑
                              </button>
                            )}
                            {index < images.length - 1 && (
                              <button 
                                type="button" 
                                onClick={() => moveImageDown(index)}
                                className={styles.reorderButton}
                                title="Mover abajo"
                                style={{
                                  backgroundColor: 'rgba(59, 130, 246, 0.9)',
                                  border: 'none',
                                  borderRadius: '3px',
                                  color: 'white',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  fontSize: '0.75rem',
                                  minWidth: '20px',
                                  height: '20px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: 1
                                }}
                              >
                                ↓
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Botón de eliminar */}
                        <button 
                          type="button" 
                          onClick={() => removeImage(image.public_id)}
                          className={styles.removeImageButton}
                          title="Eliminar imagen"
                          style={{
                            position: 'absolute',
                            top: '5px',
                            right: '5px',
                            backgroundColor: 'rgba(239, 68, 68, 0.9)',
                            border: 'none',
                            borderRadius: '4px',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontSize: '0.875rem',
                            minWidth: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            lineHeight: 1,
                            zIndex: 10
                          }}
                        >
                          ×
                        </button>
                        <img 
                          src={image.secure_url} 
                          alt={`Imagen adicional ${index + 1}`}
                          className={styles.previewThumbnail}
                        />
                        {/* Campo para título/caption de la imagen */}
                        <div className={styles.imageCaptionInput}>
                          <label htmlFor={`caption-${image.public_id}`} style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block', color: 'var(--text-muted)' }}>
                            Título de la imagen:
                          </label>
                          <input
                            id={`caption-${image.public_id}`}
                            type="text"
                            value={image.caption || ''}
                            onChange={(e) => updateImageCaption(image.public_id, e.target.value)}
                            placeholder="Ej: Gráfico de tendencia alcista"
                            className={styles.captionInput}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              borderRadius: '6px',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              color: '#ffffff',
                              fontSize: '0.875rem',
                              marginTop: '0.5rem'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.formActions}>
            <button 
              type="button" 
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={loading || uploadingImages}
            >
              {loading ? (isEdit ? 'Actualizando...' : 'Creando...') : uploadingImages ? 'Subiendo...' : (isEdit ? 'Actualizar Informe' : 'Crear Informe')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateReportModal;

