import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export interface CloudinaryImage {
  public_id: string;
  url: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  caption?: string;
  order?: number;
}

interface ImageUploaderProps {
  onImageUploaded: (image: CloudinaryImage) => void;
  onUploadStart?: () => void;
  onUploadComplete?: () => void;
  onUploadProgress?: (progress: number) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  allowedFormats?: string[];
  className?: string;
  buttonText?: string;
  multiple?: boolean;
}

export default function ImageUploader({
  onImageUploaded,
  onUploadStart,
  onUploadComplete,
  onUploadProgress,
  onError,
  maxFiles = 5,
  maxSizeBytes = 10 * 1024 * 1024, // 10MB por defecto
  allowedFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp'],
  className = '',
  buttonText = 'Subir Imagen',
  multiple = false
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const uploadToCloudinary = async (file: File): Promise<CloudinaryImage> => {
    const formData = new FormData();
    formData.append('image', file);

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setProgress(progress);
          onUploadProgress?.(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success && response.data) {
              resolve(response.data);
            } else {
              reject(new Error(response.error || 'Error desconocido'));
            }
          } catch (error) {
            reject(new Error('Error procesando respuesta del servidor'));
          }
        } else {
          reject(new Error(`Error HTTP: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Error de red al subir imagen'));
      });

      xhr.open('POST', '/api/upload/image');
      xhr.send(formData);
    });
  };

  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);
    onUploadStart?.();

    try {
      for (const file of files) {
        // console.log('📤 Subiendo imagen:', file.name);
        
        const uploadedImage = await uploadToCloudinary(file);
        
        // console.log('✅ Imagen subida exitosamente:', uploadedImage.public_id);
        
        onImageUploaded(uploadedImage);
      }
      
      // Llamar al callback de completado después de subir todas las imágenes
      onUploadComplete?.();
    } catch (error) {
      console.error('❌ Error subiendo imagen:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      onError?.(errorMessage);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [onImageUploaded, onUploadStart, onUploadComplete, onError]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles && rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      let errorMessage = 'Error al seleccionar archivo';
      
      if (rejection.errors && rejection.errors.length > 0) {
        const error = rejection.errors[0];
        if (error.code === 'file-too-large') {
          errorMessage = `El archivo es demasiado grande. Máximo: ${Math.round(maxSizeBytes / (1024 * 1024))}MB`;
        } else if (error.code === 'file-invalid-type') {
          errorMessage = `Tipo de archivo no válido. Formatos permitidos: ${allowedFormats.join(', ').toUpperCase()}`;
        } else if (error.code === 'too-many-files') {
          errorMessage = `Demasiados archivos. Máximo: ${maxFiles}`;
        } else {
          errorMessage = error.message || 'Error al seleccionar archivo';
        }
      }
      
      console.error('❌ Archivo rechazado:', rejection);
      onError?.(errorMessage);
      return;
    }
    
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles);
    }
  }, [maxSizeBytes, maxFiles, allowedFormats, onError, handleFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp']
    },
    maxFiles: multiple ? maxFiles : 1,
    maxSize: maxSizeBytes,
    multiple,
    disabled: uploading,
    onError: (error: any) => {
      console.error('❌ Error en dropzone:', error);
      onError?.(error.message || 'Error al seleccionar archivo');
    }
  });

  return (
    <div className={`image-uploader ${className}`}>
      <div
        {...getRootProps()}
        className={`
          dropzone
          ${isDragActive || dragActive ? 'active' : ''}
          ${uploading ? 'uploading' : ''}
        `}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
      >
        <input {...getInputProps()} />
        
        <div className="upload-content">
          {uploading ? (
            <div className="upload-progress">
              <div className="spinner"></div>
              <p>Subiendo imagen... {progress}%</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="upload-icon">📸</div>
              <p className="upload-text">
                {isDragActive || dragActive
                  ? 'Suelta las imágenes aquí...'
                  : 'Arrastra imágenes aquí o haz clic para seleccionar'
                }
              </p>
              <button type="button" className="upload-button">
                {buttonText}
              </button>
              <p className="upload-info">
                Formatos: {allowedFormats.join(', ').toUpperCase()} | 
                Máximo: {Math.round(maxSizeBytes / (1024 * 1024))}MB
                {multiple && ` | Hasta ${maxFiles} archivos`}
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .image-uploader {
          width: 100%;
        }

        .dropzone {
          border: 2px dashed rgba(139, 92, 246, 0.3);
          border-radius: 16px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.02) 0%, rgba(59, 130, 246, 0.02) 100%);
          min-height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .dropzone::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(from 0deg, transparent, rgba(139, 92, 246, 0.01), transparent);
          animation: rotate 20s linear infinite;
          pointer-events: none;
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .dropzone:hover,
        .dropzone.active {
          border-color: rgba(139, 92, 246, 0.5);
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(139, 92, 246, 0.15);
        }

        .dropzone.uploading {
          cursor: not-allowed;
          opacity: 0.8;
          border-color: rgba(139, 92, 246, 0.4);
        }

        .upload-content {
          width: 100%;
          position: relative;
          z-index: 1;
        }

        .upload-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          filter: drop-shadow(0 2px 4px rgba(139, 92, 246, 0.3));
        }

        .upload-text {
          font-size: 1.1rem;
          color: #e2e8f0;
          margin-bottom: 1.5rem;
          font-weight: 500;
        }

        .upload-button {
          background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
          color: white;
          border: none;
          padding: 0.875rem 2rem;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
          font-size: 0.95rem;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.2);
        }

        .upload-button::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .upload-button:hover {
          background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(139, 92, 246, 0.3);
        }

        .upload-button:hover::before {
          opacity: 1;
        }

        .upload-button:active {
          transform: translateY(0);
        }

        .upload-info {
          font-size: 0.875rem;
          color: rgba(226, 232, 240, 0.6);
          margin-top: 1rem;
          font-weight: 400;
        }

        .upload-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          position: relative;
          z-index: 1;
        }

        .upload-progress p {
          color: #e2e8f0;
          font-weight: 600;
          font-size: 1rem;
        }

        .spinner {
          width: 2.5rem;
          height: 2.5rem;
          border: 3px solid rgba(139, 92, 246, 0.2);
          border-top: 3px solid #8b5cf6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          filter: drop-shadow(0 2px 4px rgba(139, 92, 246, 0.3));
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .progress-bar {
          width: 250px;
          height: 10px;
          background: rgba(139, 92, 246, 0.2);
          border-radius: 5px;
          overflow: hidden;
          border: 1px solid rgba(139, 92, 246, 0.3);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
          border-radius: 4px;
          transition: width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
        }

        .progress-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
} 