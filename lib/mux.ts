// Configuración para MUX Video Streaming e Imágenes
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID || 'development_token_id';
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET || 'development_token_secret';

if ((!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) && process.env.NODE_ENV === 'production') {
  throw new Error(
    'Por favor define las variables de entorno MUX_TOKEN_ID y MUX_TOKEN_SECRET en producción'
  );
}

interface MuxAsset {
  id: string;
  status: string;
  playback_ids?: Array<{
    id: string;
    policy: string;
  }>;
}

interface MuxUploadResponse {
  data: MuxAsset;
}

interface MuxUploadUrl {
  data: {
    id: string;
    url: string;
    status: string;
  };
}

interface MuxImageUploadResult {
  assetId: string;
  uploadUrl: string;
  status: string;
}

/**
 * Crea un asset en MUX desde una URL de video
 * @param videoUrl URL del video a procesar
 * @returns Promise con el playback ID
 */
export async function createMuxAsset(videoUrl: string): Promise<string> {
  console.log('🎥 Creando asset en MUX para:', videoUrl);
  
  try {
    const response = await fetch('https://api.mux.com/video/v1/assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64')}`
      },
      body: JSON.stringify({
        input: videoUrl,
        playback_policy: ['public'],
        mp4_support: 'standard'
      })
    });

    if (!response.ok) {
      throw new Error(`Error en MUX API: ${response.status}`);
    }

    const data: MuxUploadResponse = await response.json();
    const playbackId = data.data.playback_ids?.[0]?.id;

    if (!playbackId) {
      throw new Error('No se pudo obtener el playback ID de MUX');
    }

    console.log('✅ Asset creado en MUX con playback ID:', playbackId);
    return playbackId;
    
  } catch (error) {
    console.error('❌ Error creando asset en MUX:', error);
    throw error;
  }
}

/**
 * Crea un upload directo en MUX para imágenes
 * @param filename Nombre del archivo
 * @returns Promise con la información de upload
 */
export async function createMuxImageUpload(filename: string = 'report-image'): Promise<MuxImageUploadResult> {
  console.log('📤 Creando upload directo en MUX para imagen:', filename);
  
  try {
    const response = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64')}`
      },
      body: JSON.stringify({
        new_asset_settings: {
          playback_policy: ['public'],
          input_info: [
            {
              file_type: 'image'
            }
          ]
        },
        cors_origin: process.env.NODE_ENV === 'production' 
          ? process.env.NEXTAUTH_URL 
          : 'http://localhost:3000'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en MUX Upload API: ${response.status} - ${errorText}`);
    }

    const data: MuxUploadUrl = await response.json();

    console.log('✅ Upload URL creado en MUX:', data.data.id);

    return {
      assetId: data.data.id,
      uploadUrl: data.data.url,
      status: data.data.status
    };
    
  } catch (error) {
    console.error('❌ Error creando upload en MUX:', error);
    throw error;
  }
}

/**
 * Sube una imagen directamente a MUX
 * @param file Buffer del archivo
 * @param filename Nombre del archivo
 * @returns Promise con la información del asset creado
 */
export async function uploadImageToMux(file: Buffer, filename: string = 'report-image'): Promise<string> {
  console.log('📤 Subiendo imagen a MUX...');
  
  try {
    // Crear upload URL
    const upload = await createMuxImageUpload(filename);
    
    // Subir el archivo directamente a MUX
    // Convertir Buffer a Uint8Array para compatibilidad con BodyInit
    const uploadResponse = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg'
      },
      body: new Uint8Array(file)
    });

    if (!uploadResponse.ok) {
      throw new Error(`Error subiendo archivo a MUX: ${uploadResponse.status}`);
    }

    console.log('✅ Imagen subida exitosamente a MUX. Asset ID:', upload.assetId);
    
    // Retornar el asset ID que se puede usar como referencia
    return upload.assetId;
    
  } catch (error) {
    console.error('❌ Error subiendo imagen a MUX:', error);
    throw error;
  }
}

/**
 * Obtiene información de un asset de MUX
 * @param assetId ID del asset en MUX
 * @returns Promise con la información del asset
 */
export async function getMuxAsset(assetId: string): Promise<MuxAsset> {
  try {
    const response = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Error obteniendo asset de MUX: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
    
  } catch (error) {
    console.error('❌ Error obteniendo asset de MUX:', error);
    throw error;
  }
}

/**
 * Elimina un asset de MUX
 * @param assetId ID del asset a eliminar
 * @returns Promise<boolean> Éxito de la eliminación
 */
export async function deleteMuxAsset(assetId: string): Promise<boolean> {
  try {
    console.log('🗑️ Eliminando asset de MUX:', assetId);

    const response = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`).toString('base64')}`
      }
    });

    if (response.ok) {
      console.log('✅ Asset eliminado exitosamente de MUX');
      return true;
    } else {
      console.warn('⚠️ El asset ya no existe o no se pudo eliminar');
      return false;
    }

  } catch (error) {
    console.error('❌ Error eliminando asset de MUX:', error);
    return false;
  }
}

/**
 * Genera URL de imagen desde MUX
 * @param assetId ID del asset en MUX
 * @param options Opciones de transformación
 * @returns URL de la imagen
 */
export function getMuxImageUrl(
  assetId: string,
  options: {
    width?: number;
    height?: number;
    fit_mode?: 'preserve' | 'crop' | 'fill';
    time?: number;
  } = {}
): string {
  const {
    width = 800,
    height = 600,
    fit_mode = 'crop',
    time = 0
  } = options;

  // MUX permite generar thumbnails desde assets
  return `https://image.mux.com/${assetId}/thumbnail.jpg?width=${width}&height=${height}&fit_mode=${fit_mode}&time=${time}`;
}

/**
 * Valida si un playback ID es válido
 * @param playbackId Playback ID a validar
 * @returns boolean
 */
export function isValidPlaybackId(playbackId: string): boolean {
  return typeof playbackId === 'string' && playbackId.length > 0;
}

/**
 * Valida si un asset ID es válido
 * @param assetId Asset ID a validar
 * @returns boolean
 */
export function isValidAssetId(assetId: string): boolean {
  return typeof assetId === 'string' && assetId.length > 0;
} 