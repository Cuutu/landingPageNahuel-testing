import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder: boolean;
  url: string;
  secure_url: string;
  folder?: string;
  access_mode: string;
  overwritten?: boolean;
  original_filename: string;
}

/**
 * Sube una imagen a Cloudinary
 * @param fileBuffer Buffer del archivo de imagen
 * @param fileName Nombre del archivo
 * @param folder Carpeta donde se guardará la imagen (opcional)
 * @returns Promise con resultado del upload
 */
export async function uploadImageToCloudinary(
  fileBuffer: Buffer,
  fileName: string,
  folder?: string
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      resource_type: 'image',
      public_id: `${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}`,
      overwrite: true,
      quality: 100,
    };

    if (folder) {
      uploadOptions.folder = folder;
    }

    cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('❌ Error subiendo imagen a Cloudinary:', error);
          reject(error);
        } else if (result) {
          console.log('✅ Imagen subida exitosamente a Cloudinary:', result.public_id);
          resolve(result);
        } else {
          reject(new Error('No se recibió respuesta de Cloudinary'));
        }
      }
    ).end(fileBuffer);
  });
}

/**
 * Elimina una imagen de Cloudinary
 * @param publicId Public ID de la imagen a eliminar
 * @returns Promise<boolean> Éxito de la eliminación
 */
export async function deleteImageFromCloudinary(publicId: string): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando imagen de Cloudinary:', publicId);
    
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      console.log('✅ Imagen eliminada exitosamente de Cloudinary');
      return true;
    } else {
      console.warn('⚠️ La imagen no pudo ser eliminada:', result.result);
      return false;
    }
  } catch (error) {
    console.error('❌ Error eliminando imagen de Cloudinary:', error);
    return false;
  }
}

/**
 * Genera URL optimizada de Cloudinary
 * @param publicId Public ID de la imagen
 * @param options Opciones de transformación
 * @returns URL optimizada
 */
export function getCloudinaryImageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'crop' | 'thumb' | 'limit' | 'mfit' | 'mpad';
    quality?: 'auto' | number | string;
    format?: 'webp' | 'jpg' | 'png';
    gravity?: 'auto' | 'face' | 'center' | 'north' | 'south' | 'east' | 'west';
  } = {}
): string {
  const {
    width,
    height,
    crop = 'scale',
    quality = 'auto',
    format,
    gravity = 'auto'
  } = options;

  const transformations: string[] = [];
  
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (crop) transformations.push(`c_${crop}`);
  if (quality) transformations.push(`q_${quality}`);
  if (format) transformations.push(`f_${format}`);
  if (gravity && crop !== 'scale') transformations.push(`g_${gravity}`);

  const transformString = transformations.length > 0 ? `${transformations.join(',')}/` : '';
  
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${transformString}${publicId}`;
}

/**
 * Valida si un public ID es válido
 * @param publicId Public ID a validar
 * @returns boolean
 */
export function isValidCloudinaryPublicId(publicId: string): boolean {
  return typeof publicId === 'string' && publicId.length > 0;
}

/**
 * Sube un archivo PDF u otro documento a Cloudinary
 * @param fileBuffer Buffer del archivo
 * @param fileName Nombre del archivo
 * @param folder Carpeta donde se guardará el archivo (opcional)
 * @returns Promise con resultado del upload
 */
export async function uploadFileToCloudinary(
  fileBuffer: Buffer,
  fileName: string,
  folder?: string
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadOptions: any = {
      resource_type: 'raw', // Para archivos no-imagen (PDFs, documentos, etc.)
      public_id: `${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}`,
      overwrite: true,
    };

    if (folder) {
      uploadOptions.folder = folder;
    }

    cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('❌ Error subiendo archivo a Cloudinary:', error);
          reject(error);
        } else if (result) {
          console.log('✅ Archivo subido exitosamente a Cloudinary:', result.public_id);
          resolve(result);
        } else {
          reject(new Error('No se recibió respuesta de Cloudinary'));
        }
      }
    ).end(fileBuffer);
  });
}

/**
 * Elimina un archivo de Cloudinary
 * @param publicId Public ID del archivo a eliminar
 * @param resourceType Tipo de recurso ('image' | 'raw')
 * @returns Promise<boolean> Éxito de la eliminación
 */
export async function deleteFileFromCloudinary(
  publicId: string, 
  resourceType: 'image' | 'raw' = 'raw'
): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando archivo de Cloudinary:', publicId);
    
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    
    if (result.result === 'ok') {
      console.log('✅ Archivo eliminado exitosamente de Cloudinary');
      return true;
    } else {
      console.warn('⚠️ El archivo no pudo ser eliminado:', result.result);
      return false;
    }
  } catch (error) {
    console.error('❌ Error eliminando archivo de Cloudinary:', error);
    return false;
  }
}

/**
 * Genera URL para archivos de Cloudinary
 * @param publicId Public ID del archivo
 * @param resourceType Tipo de recurso
 * @returns URL del archivo
 */
export function getCloudinaryFileUrl(
  publicId: string,
  resourceType: 'image' | 'raw' = 'raw'
): string {
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${publicId}`;
}

/**
 * Genera URL de PDF para visualización en navegador
 * @param publicId Public ID del PDF
 * @param originalFileName Nombre original del archivo (opcional)
 * @returns URL para visualizar en navegador
 */
export function getCloudinaryPDFViewUrl(
  publicId: string,
  originalFileName?: string
): string {
  // Encodificar el public_id para manejar carpetas correctamente
  const encodedPublicId = encodeURIComponent(publicId);
  return `/api/pdf/view/${encodedPublicId}${originalFileName ? `?fileName=${encodeURIComponent(originalFileName)}` : ''}`;
}

/**
 * Genera URL de PDF para descarga forzada con nombre específico
 * @param publicId Public ID del PDF  
 * @param fileName Nombre que se usará para la descarga
 * @returns URL para descarga forzada con nombre específico
 */
export function getCloudinaryPDFDownloadUrl(
  publicId: string,
  fileName: string
): string {
  // Encodificar el public_id para manejar carpetas correctamente
  const encodedPublicId = encodeURIComponent(publicId);
  const encodedFileName = encodeURIComponent(fileName);
  return `/api/pdf/download/${encodedPublicId}?fileName=${encodedFileName}`;
}

/**
 * Genera URL directa de Cloudinary para PDFs (fallback)
 * @param publicId Public ID del PDF
 * @returns URL directa de Cloudinary
 */
export function getCloudinaryDirectPDFUrl(publicId: string): string {
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${publicId}`;
}

/**
 * Genera URL de PDF para visualización directa en Cloudinary (sin proxy)
 * @param publicId Public ID del PDF
 * @returns URL directa para visualización
 */
export function getCloudinaryPDFDirectViewUrl(publicId: string): string {
  // Usar fl_attachment para forzar descarga o sin él para visualización
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/fl_attachment:false/${publicId}`;
}

/**
 * Extrae el nombre original del archivo desde el public_id de Cloudinary
 * @param publicId Public ID del archivo
 * @param extension Extensión del archivo (ej: 'pdf')
 * @returns Nombre de archivo limpio
 */
export function extractFileNameFromPublicId(
  publicId: string,
  extension: string = 'pdf'
): string {
  // Remover timestamp y carpetas, conservar solo el nombre base
  const parts = publicId.split('/');
  const baseName = parts[parts.length - 1];
  
  // Remover timestamp del inicio si existe (formato: 123456789_nombre)
  const nameWithoutTimestamp = baseName.replace(/^\d+_/, '');
  
  // Agregar extensión si no la tiene
  if (!nameWithoutTimestamp.includes('.')) {
    return `${nameWithoutTimestamp}.${extension}`;
  }
  
  return nameWithoutTimestamp;
}

export default cloudinary; 