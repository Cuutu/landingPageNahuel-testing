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
          headers: ['email', 'source'] // Headers esperados
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

            // Procesar datos
            const source = row.source?.trim() || 'import';

            emails.push({
              email: email.toLowerCase(),
              source: ['manual', 'registration', 'import'].includes(source) ? source : 'import'
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

            // Limitar el número de emails para evitar timeout
            const maxEmails = 1000;
            if (emails.length > maxEmails) {
              console.log(`⚠️ [IMPORT CSV] Limitando a ${maxEmails} emails de ${emails.length} total`);
              emails.splice(maxEmails);
            }

            // Agregar emails a la base de datos en lotes para evitar timeout
            const results = {
              total: emails.length,
              added: 0,
              alreadyExists: 0,
              reactivated: 0,
              errors: [] as string[]
            };

            // Procesar en lotes de 50 emails para evitar timeout
            const batchSize = 50;
            const batches = [];
            for (let i = 0; i < emails.length; i += batchSize) {
              batches.push(emails.slice(i, i + batchSize));
            }

            console.log(`📦 [IMPORT CSV] Procesando ${batches.length} lotes de máximo ${batchSize} emails cada uno`);

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
              const batch = batches[batchIndex];
              console.log(`📦 [IMPORT CSV] Procesando lote ${batchIndex + 1}/${batches.length} (${batch.length} emails)`);

              // Procesar lote en paralelo
              const batchPromises = batch.map(async (emailData) => {
                try {
                  const result = await (EmailList as any).addEmailIfNotExists(
                    emailData.email,
                    emailData.source
                  );

                  if (result.wasAdded) {
                    results.added++;
                  } else if (result.wasReactivated) {
                    results.reactivated++;
                  } else {
                    results.alreadyExists++;
                  }

                  return { success: true, email: emailData.email };

                } catch (error) {
                  console.error(`❌ [IMPORT CSV] Error agregando email ${emailData.email}:`, error);
                  results.errors.push(`${emailData.email}: ${error}`);
                  return { success: false, email: emailData.email, error };
                }
              });

              // Esperar a que termine el lote actual
              await Promise.all(batchPromises);

              // Pequeña pausa entre lotes para evitar sobrecarga
              if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            console.log('✅ [IMPORT CSV] Importación completada:', results);

            return res.status(200).json({
              success: true,
              message: `Importación completada: ${results.added} agregados, ${results.reactivated} reactivados, ${results.alreadyExists} ya existían`,
              results: {
                ...results,
                csvErrors: errors
              }
            });

          } catch (error) {
            console.error('❌ [IMPORT CSV] Error en procesamiento final:', error);
            return res.status(500).json({
              success: false,
              error: 'Error procesando archivo CSV',
              message: error instanceof Error ? error.message : 'Error desconocido'
            });
          }
        })
        .on('error', (error) => {
          console.error('❌ [IMPORT CSV] Error leyendo archivo CSV:', error);
          return res.status(500).json({
            success: false,
            error: 'Error leyendo archivo CSV',
            message: error.message
          });
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
