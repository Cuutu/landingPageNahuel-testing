import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import formidable from 'formidable';
import fs from 'fs';
import { uploadImageToCloudinary } from '../../../lib/cloudinary';

// Configuración para permitir archivos
export const config = {
  api: {
    bodyParser: false, // Desactivar body parser para manejar archivos
  },
};

interface UploadImageResponse {
  success: boolean;
  data?: {
    public_id: string;
    url: string;
    secure_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadImageResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método no permitido'
    });
  }

  try {
    console.log('🔧 Verificando configuración de Cloudinary...');
    
    // Verificar variables de entorno
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    
    if (!cloudName || !apiKey || !apiSecret) {
      console.error('❌ Variables de Cloudinary faltantes:', {
        cloudName: !!cloudName,
        apiKey: !!apiKey,
        apiSecret: !!apiSecret
      });
      return res.status(500).json({
        success: false,
        error: 'Configuración de Cloudinary incompleta'
      });
    }
    
    console.log('✅ Variables de Cloudinary configuradas correctamente');

    // Verificar autenticación y rol de admin
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado'
      });
    }

    // Verificar que el usuario sea admin
    if (session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo los administradores pueden subir imágenes'
      });
    }

    console.log('📤 Iniciando upload de imagen para usuario:', session.user.email);

    // Configurar formidable para manejar archivos
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB max
      keepExtensions: true,
      filter: ({ mimetype }) => {
        // Solo permitir imágenes
        const isImage = Boolean(mimetype && mimetype.includes('image'));
        console.log('🔍 Validando archivo:', { mimetype, isImage });
        return isImage;
      }
    });

    // Procesar el archivo
    console.log('📁 Procesando archivo con formidable...');
    
    let fields: any, files: any;
    try {
      [fields, files] = await form.parse(req);
      console.log('📁 Archivos recibidos:', Object.keys(files || {}));
      console.log('📁 Campos recibidos:', Object.keys(fields || {}));
    } catch (parseError: any) {
      console.error('❌ Error parseando formulario:', parseError);
      return res.status(400).json({
        success: false,
        error: `Error procesando archivo: ${parseError.message || 'Error desconocido'}`
      });
    }
    
    const file = Array.isArray(files.image) ? files.image[0] : files.image;
    console.log('📁 Archivo extraído:', file ? 'SÍ' : 'NO');

    if (!file) {
      console.error('❌ No se encontró archivo de imagen en la request');
      console.error('📁 Archivos disponibles:', Object.keys(files || {}));
      return res.status(400).json({
        success: false,
        error: 'No se encontró archivo de imagen. Asegúrate de enviar el archivo con el campo "image"'
      });
    }

    console.log('📁 Archivo recibido:', {
      originalFilename: file.originalFilename,
      mimetype: file.mimetype,
      size: file.size
    });

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype || '')) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de archivo no válido. Solo se permiten: JPG, PNG, GIF, WEBP'
      });
    }

    // Leer el archivo como buffer
    const fileBuffer = fs.readFileSync(file.filepath);
    const fileName = file.originalFilename || `image_${Date.now()}`;

    console.log('📤 Subiendo imagen a Cloudinary...', {
      fileName,
      bufferSize: fileBuffer.length
    });

    // Subir a Cloudinary
    const uploadResult = await uploadImageToCloudinary(
      fileBuffer, 
      fileName,
      'nahuel-trading/reports' // Carpeta específica para reportes
    );

    console.log('✅ Imagen subida exitosamente:', {
      public_id: uploadResult.public_id,
      url: uploadResult.secure_url,
      size: uploadResult.bytes
    });

    // Limpiar archivo temporal
    fs.unlinkSync(file.filepath);

    // Responder con información de la imagen
    return res.status(200).json({
      success: true,
      data: {
        public_id: uploadResult.public_id,
        url: uploadResult.url,
        secure_url: uploadResult.secure_url,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes
      }
    });

  } catch (error) {
    console.error('❌ Error detallado en upload de imagen:', {
      message: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    });
  }
} 