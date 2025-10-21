import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import EmailList from '@/models/EmailList';
import dbConnect from '@/lib/mongodb';
import formidable from 'formidable';
import fs from 'fs';
import csv from 'csv-parser';

/**
 * API para importar emails desde archivo CSV de forma asíncrona
 * POST: Inicia el procesamiento en background y retorna inmediatamente
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('📥 [IMPORT CSV ASYNC] Método:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Verificar autenticación de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Verificar que sea admin
    await dbConnect();
    const User = (await import('@/models/User')).default;
    const user = await User.findOne({ email: session.user.email });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado - Solo administradores' });
    }

    console.log('✅ [IMPORT CSV ASYNC] Acceso de admin confirmado para:', session.user.email);

    // Configurar formidable para manejar archivos
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB máximo
      filter: ({ mimetype }) => {
        return Boolean(mimetype && mimetype.includes('text/csv'));
      }
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.csv) ? files.csv[0] : files.csv;

    if (!file) {
      return res.status(400).json({ error: 'No se encontró archivo CSV' });
    }

    console.log('📁 [IMPORT CSV ASYNC] Procesando archivo CSV...');

    // Leer y procesar archivo CSV
    const emails: Array<{
      email: string;
      source: string;
    }> = [];
    const errors: string[] = [];
    let lineNumber = 0;

    return new Promise((resolve) => {
      fs.createReadStream(file.filepath)
        .pipe(csv({
          headers: ['email'] // Solo email
        }))
        .on('data', (row) => {
          lineNumber++;
          
          try {
            const email = row.email?.trim();
            if (!email) {
              errors.push(`Línea ${lineNumber}: Email vacío`);
              return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
              errors.push(`Línea ${lineNumber}: Email inválido - ${email}`);
              return;
            }

            emails.push({
              email: email.toLowerCase(),
              source: 'import'
            });

          } catch (error) {
            errors.push(`Línea ${lineNumber}: Error procesando - ${error}`);
          }
        })
        .on('end', async () => {
          try {
            console.log(`📊 [IMPORT CSV ASYNC] Procesados ${emails.length} emails, ${errors.length} errores`);
            fs.unlinkSync(file.filepath);

            if (emails.length === 0) {
              return res.status(400).json({
                success: false,
                error: 'No se encontraron emails válidos en el archivo CSV',
                errors
              });
            }

            // Iniciar procesamiento asíncrono
            console.log(`🚀 [IMPORT CSV ASYNC] Iniciando procesamiento asíncrono de ${emails.length} emails`);
            
            // Procesar inmediatamente sin esperar
            processEmailsAsync(emails, session.user.email).catch(error => {
              console.error('❌ [IMPORT CSV ASYNC] Error en procesamiento asíncrono:', error);
            });

            // Responder inmediatamente al cliente
            return res.status(200).json({
              success: true,
              message: `Procesamiento iniciado para ${emails.length} emails`,
              total: emails.length,
              csvErrors: errors,
              status: 'processing'
            });

          } catch (error) {
            console.error('❌ [IMPORT CSV ASYNC] Error en procesamiento final:', error);
            return res.status(500).json({
              success: false,
              error: 'Error procesando archivo CSV',
              message: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
        })
        .on('error', (error) => {
          console.error('❌ [IMPORT CSV ASYNC] Error leyendo archivo CSV:', error);
          return res.status(500).json({
            success: false,
            error: 'Error leyendo archivo CSV',
            message: error.message
          });
        });
    });

  } catch (error) {
    console.error('❌ [IMPORT CSV ASYNC] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}

/**
 * Procesa emails de forma asíncrona sin bloquear la respuesta
 */
async function processEmailsAsync(emails: Array<{email: string, source: string}>, adminEmail: string) {
  console.log(`🔄 [ASYNC PROCESS] Iniciando procesamiento de ${emails.length} emails`);
  
  try {
    await dbConnect();
    
    const results = {
      total: emails.length,
      processed: 0,
      errors: [] as string[]
    };

    // Procesar en lotes grandes para máxima eficiencia
    const bulkBatchSize = 200;
    const bulkOps = [];
    const now = new Date();

    // Preparar todas las operaciones upsert
    for (const emailData of emails) {
      bulkOps.push({
        updateOne: {
          filter: { email: emailData.email },
          update: { 
            $set: { 
              email: emailData.email,
              source: emailData.source,
              isActive: true,
              updatedAt: now
            },
            $setOnInsert: {
              addedAt: now,
              createdAt: now
            }
          },
          upsert: true
        }
      });
    }

    // Ejecutar en lotes
    for (let i = 0; i < bulkOps.length; i += bulkBatchSize) {
      const batch = bulkOps.slice(i, i + bulkBatchSize);
      console.log(`📦 [ASYNC PROCESS] Procesando lote ${Math.floor(i/bulkBatchSize) + 1}/${Math.ceil(bulkOps.length/bulkBatchSize)} (${batch.length} operaciones)`);
      
      try {
        await EmailList.bulkWrite(batch, { ordered: false });
        results.processed += batch.length;
        console.log(`✅ [ASYNC PROCESS] Lote completado: ${batch.length} operaciones`);
      } catch (error) {
        console.error(`❌ [ASYNC PROCESS] Error en lote:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        results.errors.push(`Error en lote ${Math.floor(i/bulkBatchSize) + 1}: ${errorMessage}`);
      }
    }

    console.log(`✅ [ASYNC PROCESS] Procesamiento completado:`, results);
    console.log(`📧 [ASYNC PROCESS] ${results.processed} emails procesados exitosamente por ${adminEmail}`);

  } catch (error) {
    console.error('❌ [ASYNC PROCESS] Error en procesamiento asíncrono:', error);
  }
}

// Configurar para no parsear el body automáticamente
export const config = {
  api: {
    bodyParser: false,
  },
};
