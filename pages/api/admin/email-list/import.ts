import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import EmailList from '@/models/EmailList';
import formidable from 'formidable';
import fs from 'fs';
import csv from 'csv-parser';

/**
 * API para importar emails desde archivo CSV
 * POST: Importar emails desde archivo CSV subido
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('📥 [IMPORT CSV] Método:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Configurar timeout más agresivo para evitar cancelación de Vercel
  const startTime = Date.now();
  const maxExecutionTime = 180000; // 3 minutos (más conservador)

  try {
    // Verificar autenticación de admin
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Conectar a la base de datos
    await dbConnect();

    // Verificar que el usuario sea admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }

    console.log('✅ [IMPORT CSV] Acceso de admin confirmado para:', session.user.email);

    // Configurar formidable para manejar archivos
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB max
      keepExtensions: true,
      filter: ({ mimetype }) => {
        // Solo permitir archivos CSV
        const isCsv = Boolean(mimetype && (
          mimetype === 'text/csv' || 
          mimetype === 'application/csv' ||
          mimetype === 'text/plain'
        ));
        console.log('🔍 [IMPORT CSV] Validando archivo:', { mimetype, isCsv });
        return isCsv;
      }
    });

    // Procesar el archivo
    console.log('📁 [IMPORT CSV] Procesando archivo CSV...');
    const [fields, files] = await form.parse(req);
    console.log('📁 [IMPORT CSV] Archivos recibidos:', Object.keys(files));
    
    const file = Array.isArray(files.csv) ? files.csv[0] : files.csv;
    console.log('📁 [IMPORT CSV] Archivo extraído:', file ? 'SÍ' : 'NO');

    if (!file) {
      console.error('❌ [IMPORT CSV] No se encontró archivo CSV en la request');
      return res.status(400).json({
        success: false,
        error: 'No se encontró archivo CSV'
      });
    }

    console.log('📁 [IMPORT CSV] Procesando archivo:', file.filepath);

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
          headers: ['email'] // Solo email, sin source
        }))
        .on('data', (row) => {
          lineNumber++;
          
          try {
            // Validar email
            const email = row.email?.trim();
            if (!email) {
              errors.push(`Línea ${lineNumber}: Email vacío`);
              return;
            }

            // Validar formato de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
              errors.push(`Línea ${lineNumber}: Email inválido - ${email}`);
              return;
            }

            // Procesar datos - solo email, source será 'import' por defecto
            emails.push({
              email: email.toLowerCase(),
              source: 'import' // Todos los emails del CSV se marcan como 'import'
            });

          } catch (error) {
            errors.push(`Línea ${lineNumber}: Error procesando - ${error}`);
          }
        })
        .on('end', async () => {
          try {
            console.log(`📊 [IMPORT CSV] Procesados ${emails.length} emails, ${errors.length} errores`);

            // Limpiar archivo temporal
            fs.unlinkSync(file.filepath);

            if (emails.length === 0) {
              return res.status(400).json({
                success: false,
                error: 'No se encontraron emails válidos en el archivo CSV',
                errors
              });
            }

            // No limitar emails - procesar todos los que vengan
            console.log(`📊 [IMPORT CSV] Procesando ${emails.length} emails sin límite`);

            // Usar operaciones bulk de MongoDB para mayor eficiencia
            const results = {
              total: emails.length,
              processed: 0,
              errors: [] as string[]
            };

            console.log(`📦 [IMPORT CSV] Procesando ${emails.length} emails usando operaciones bulk`);

            // Enviar respuesta temprana para evitar timeout del cliente
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Transfer-Encoding': 'chunked'
            });
            
            // Enviar progreso inicial
            res.write(JSON.stringify({
              success: true,
              message: 'Procesando archivo CSV...',
              progress: 'Iniciando importación',
              total: emails.length
            }) + '\n');

            // Verificar timeout antes de consultar la base de datos
            if (Date.now() - startTime > maxExecutionTime) {
              console.log(`⏰ [IMPORT CSV] Timeout alcanzado antes de consultar BD`);
              const timeoutResult = {
                success: false,
                error: 'Timeout: El archivo es demasiado grande para procesar en el tiempo disponible',
                message: 'Intenta con un archivo más pequeño (máximo 200 emails)',
                completed: true
              };
              res.write(JSON.stringify(timeoutResult) + '\n');
              res.end();
              return;
            }

            // Estrategia optimizada: usar upsert para evitar consultas previas
            const bulkOps = [];
            const now = new Date();

            // Preparar operaciones upsert - más eficiente que consultar primero
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

            // Ejecutar operaciones bulk en lotes más grandes para mayor eficiencia
            const bulkBatchSize = 100; // Aumentado para procesar más rápido
            for (let i = 0; i < bulkOps.length; i += bulkBatchSize) {
              // Verificar timeout antes de cada lote
              if (Date.now() - startTime > maxExecutionTime) {
                console.log(`⏰ [IMPORT CSV] Timeout alcanzado, procesando ${i}/${bulkOps.length} operaciones`);
                results.errors.push(`Timeout: Solo se procesaron ${i} de ${bulkOps.length} operaciones`);
                break;
              }

              const batch = bulkOps.slice(i, i + bulkBatchSize);
              console.log(`📦 [IMPORT CSV] Ejecutando lote bulk ${Math.floor(i/bulkBatchSize) + 1}/${Math.ceil(bulkOps.length/bulkBatchSize)} (${batch.length} operaciones)`);
              
              try {
                const bulkResult = await EmailList.bulkWrite(batch, { ordered: false });
                results.processed += batch.length;
                
                console.log(`✅ [IMPORT CSV] Lote ${Math.floor(i/bulkBatchSize) + 1} completado: ${batch.length} operaciones`);
                
                // Sin pausa entre lotes para máxima velocidad
              } catch (error) {
                console.error(`❌ [IMPORT CSV] Error en operación bulk:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
                results.errors.push(`Error en lote ${Math.floor(i/bulkBatchSize) + 1}: ${errorMessage}`);
              }
            }

            console.log('✅ [IMPORT CSV] Importación completada:', results);

            // Enviar resultado final
            const finalResult = {
              success: true,
              message: `Importación completada: ${results.processed} emails procesados exitosamente`,
              results: {
                ...results,
                csvErrors: errors
              },
              completed: true
            };

            res.write(JSON.stringify(finalResult) + '\n');
            res.end();

          } catch (error) {
            console.error('❌ [IMPORT CSV] Error en procesamiento final:', error);
            const errorResult = {
              success: false,
              error: 'Error procesando archivo CSV',
              message: error instanceof Error ? error.message : 'Error desconocido',
              completed: true
            };
            res.write(JSON.stringify(errorResult) + '\n');
            res.end();
          }
        })
        .on('error', (error) => {
          console.error('❌ [IMPORT CSV] Error leyendo archivo CSV:', error);
          const errorResult = {
            success: false,
            error: 'Error leyendo archivo CSV',
            message: error.message,
            completed: true
          };
          res.write(JSON.stringify(errorResult) + '\n');
          res.end();
        });
    });

  } catch (error) {
    console.error('❌ [IMPORT CSV] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
