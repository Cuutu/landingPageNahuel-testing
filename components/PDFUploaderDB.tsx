import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface DatabasePDF {
  pdfId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadDate: Date;
}

interface PDFUploaderDBProps {
  onPDFUploaded: (pdf: DatabasePDF) => void;
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onError?: (error: string) => void;
  maxSizeBytes?: number;
  className?: string;
  buttonText?: string;
}

export default function PDFUploaderDB({
  onPDFUploaded,
  onUploadStart,
  onUploadProgress,
  onError,
  maxSizeBytes = 50 * 1024 * 1024, // 50MB por defecto
  className = '',
  buttonText = 'Subir PDF'
}: PDFUploaderDBProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const uploadToDatabase = async (file: File): Promise<DatabasePDF> => {
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

      xhr.open('POST', '/api/upload/pdf-db');
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
      // console.log('📤 Subiendo PDF a base de datos:', file.name);
      
      const uploadedPDF = await uploadToDatabase(file);
      
      // console.log('✅ PDF subido exitosamente a base de datos:', uploadedPDF.pdfId);
      
      onPDFUploaded(uploadedPDF);
    } catch (error) {
      console.error('❌ Error subiendo PDF a base de datos:', error);
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
    <div className={`pdf-uploader-db ${className}`}>
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
              <p>Subiendo PDF a base de datos... {progress}%</p>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="upload-icon">💾📄</div>
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
                Formato: PDF | Máximo: {Math.round(maxSizeBytes / (1024 * 1024))}MB | Se almacena en base de datos
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .pdf-uploader-db {
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
          border-color: #059669;
          background: #ecfdf5;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.15);
        }

        .dropzone.uploading {
          border-color: #10b981;
          background: #ecfdf5;
          cursor: default;
        }

        .upload-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          width: 100%;
        }

        .upload-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e2e8f0;
          border-top: 3px solid #10b981;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .progress-bar {
          width: 200px;
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #059669);
          transition: width 0.3s ease;
        }

        .upload-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .upload-icon {
          font-size: 3rem;
          opacity: 0.7;
        }

        .upload-text {
          font-size: 1.1rem;
          color: #4b5563;
          margin: 0;
          font-weight: 500;
          text-align: center;
        }

        .upload-button {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 1rem;
        }

        .upload-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .upload-info {
          font-size: 0.85rem;
          color: #6b7280;
          margin: 0;
          text-align: center;
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
            padding: 0.6rem 1.2rem;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
} 