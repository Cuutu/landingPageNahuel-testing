import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface CloudinaryPDF {
  public_id: string;
  url: string;
  secure_url: string;
  format: string;
  bytes: number;
  pages?: number;
}

interface PDFUploaderProps {
  onPDFUploaded: (pdf: CloudinaryPDF) => void;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onError?: (error: string) => void;
  maxSizeBytes?: number;
  className?: string;
  buttonText?: string;
}

export default function PDFUploader({
  onPDFUploaded,
  onUploadStart,
  onUploadProgress,
  onError,
  maxSizeBytes = 50 * 1024 * 1024, // 50MB por defecto
  className = '',
  buttonText = 'Subir PDF'
}: PDFUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const uploadToCloudinary = async (file: File): Promise<CloudinaryPDF> => {
    const formData = new FormData();
    formData.append('pdf', file);

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
        reject(new Error('Error de red al subir PDF'));
      });

      xhr.open('POST', '/api/upload/pdf');
      xhr.send(formData);
    });
  };

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0]; // Solo un PDF a la vez
    setUploading(true);
    setProgress(0);
    onUploadStart?.();

    try {
      // console.log('📤 Subiendo PDF:', file.name);
      
      const uploadedPDF = await uploadToCloudinary(file);
      
      // console.log('✅ PDF subido exitosamente:', uploadedPDF.public_id);
      
      onPDFUploaded(uploadedPDF);
    } catch (error) {
      console.error('❌ Error subiendo PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      onError?.(errorMessage);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: maxSizeBytes,
    multiple: false,
    disabled: uploading,
    onError: (error: any) => {
      console.error('❌ Error en dropzone:', error);
      onError?.(error.message);
    }
  });

  return (
    <div className={`pdf-uploader ${className}`}>
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
              <p>Subiendo PDF... {progress}%</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="upload-icon">📄</div>
              <p className="upload-text">
                {isDragActive || dragActive
                  ? 'Suelta el archivo PDF aquí...'
                  : 'Arrastra un archivo PDF aquí o haz clic para seleccionar'
                }
              </p>
              <button type="button" className="upload-button">
                {buttonText}
              </button>
              <p className="upload-info">
                Formato: PDF | Máximo: {Math.round(maxSizeBytes / (1024 * 1024))}MB
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .pdf-uploader {
          width: 100%;
        }

        .dropzone {
          border: 2px dashed #e2e8f0;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          background: #f8fafc;
          transition: all 0.3s ease;
          cursor: pointer;
          min-height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .dropzone:hover,
        .dropzone.active {
          border-color: #3b82f6;
          background: #eff6ff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }

        .dropzone.uploading {
          border-color: #10b981;
          background: #ecfdf5;
          cursor: default;
        }

        .upload-content {
          width: 100%;
        }

        .upload-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .upload-icon {
          font-size: 3rem;
          margin-bottom: 0.5rem;
        }

        .upload-text {
          font-size: 1.1rem;
          color: #64748b;
          margin: 0;
          font-weight: 500;
        }

        .upload-button {
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
        }

        .upload-button:hover {
          background: linear-gradient(135deg, #1d4ed8, #1e40af);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .upload-info {
          font-size: 0.875rem;
          color: #94a3b8;
          margin: 0;
        }

        .upload-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e2e8f0;
          border-left: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .progress-bar {
          width: 100%;
          max-width: 300px;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(135deg, #10b981, #059669);
          transition: width 0.3s ease;
          border-radius: 4px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .dropzone {
            padding: 1.5rem;
            min-height: 120px;
          }

          .upload-icon {
            font-size: 2.5rem;
          }

          .upload-text {
            font-size: 1rem;
          }

          .upload-button {
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
} 