import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/googleAuth';
import dbConnect from '@/lib/mongodb';
import SiteConfig from '@/models/SiteConfig';
import Training from '@/models/Training';
import { verifyAdminAPI } from '@/lib/adminAuth';

/**
 * API para manejar la configuración del sitio web
 * GET: Obtiene la configuración actual
 * PUT: Actualiza la configuración (solo administradores)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      console.log('🔍 [SITE-CONFIG] Iniciando obtención de configuración...');
      
      // Verificar que los modelos estén disponibles
      console.log('📋 [SITE-CONFIG] Verificando modelos disponibles...');
      console.log('📋 [SITE-CONFIG] SiteConfig disponible:', !!SiteConfig);
      console.log('📋 [SITE-CONFIG] Training disponible:', !!Training);
      
      let config;
      
      try {
        console.log('🔍 [SITE-CONFIG] Intentando obtener configuración con populate...');
        config = await SiteConfig.findOne().populate('cursos.destacados');
        console.log('✅ [SITE-CONFIG] Configuración obtenida con populate exitoso');
      } catch (populateError) {
        console.error('❌ [SITE-CONFIG] Error en populate, intentando sin populate:', populateError);
        
        // Si falla el populate, obtener sin populate
        config = await SiteConfig.findOne();
        console.log('⚠️ [SITE-CONFIG] Configuración obtenida sin populate');
      }
      
      // Si no existe configuración, crear una por defecto
      if (!config) {
        console.log('🆕 [SITE-CONFIG] No existe configuración, creando por defecto...');
        config = new SiteConfig({
          heroVideo: {
            youtubeId: 'dQw4w9WgXcQ',
            title: 'Video de Presentación',
            description: 'Conoce más sobre nuestros servicios de trading',
            autoplay: true,
            muted: true,
            loop: true
          },
          learningVideo: {
            youtubeId: 'dQw4w9WgXcQ',
            title: 'Cursos de Inversión',
            description: 'Aprende a invertir desde cero con nuestros cursos especializados',
            autoplay: false,
            muted: true,
            loop: false
          },
          serviciosVideos: {
            alertas: {
              youtubeId: 'dQw4w9WgXcQ',
              title: 'Video de Alertas',
              description: 'Descubre cómo funcionan nuestras alertas de trading',
              autoplay: false,
              muted: true,
              loop: false
            },
            entrenamientos: {
              youtubeId: 'dQw4w9WgXcQ',
              title: 'Video de Entrenamientos',
              description: 'Conoce nuestros programas de formación especializados',
              autoplay: false,
              muted: true,
              loop: false
            },
            asesorias: {
              youtubeId: 'dQw4w9WgXcQ',
              title: 'Video de Asesorías',
              description: 'Asesorías personalizadas para optimizar tu portafolio',
              autoplay: false,
              muted: true,
              loop: false
            }
          },
          statistics: {
            visible: true,
            backgroundColor: '#7c3aed',
            textColor: '#ffffff',
            stats: [
              {
                id: 'estudiantes',
                number: '+2900',
                label: 'Estudiantes',
                color: '#ffffff',
                order: 1
              },
              {
                id: 'formaciones',
                number: '+15',
                label: 'Formaciones',
                color: '#ffffff',
                order: 2
              },
              {
                id: 'horas',
                number: '+70',
                label: 'Horas de contenido',
                color: '#ffffff',
                order: 3
              },
              {
                id: 'satisfaccion',
                number: '98%',
                label: 'Satisfacción',
                color: '#ffffff',
                order: 4
              }
            ]
          },
          servicios: {
            orden: 1,
            visible: true
          },
          cursos: {
            orden: 2,
            visible: true,
            destacados: []
          },
          trainingStartDates: {
            swingTrading: {
              startDate: new Date('2024-10-11T13:00:00.000Z'),
              startTime: '13:00',
              enabled: true
            },
            dowJones: {
              startDate: new Date('2024-11-01T14:00:00.000Z'),
              startTime: '14:00',
              enabled: true
            }
          },
          alertExamples: {
            traderCall: [],
            smartMoney: [],
            cashFlow: []
          },
          faqs: [],
          features: {
            mentoring: {
              enabled: false,
              updatedAt: new Date(),
              updatedBy: 'system'
            }
          }
        });
        await config.save();
        console.log('✅ [SITE-CONFIG] Configuración por defecto creada');
      }

      console.log('✅ [SITE-CONFIG] Configuración retornada exitosamente');
      res.status(200).json(config);
      
    } catch (error) {
      console.error('❌ [SITE-CONFIG] Error al obtener configuración del sitio:', error);
      console.error('❌ [SITE-CONFIG] Stack trace:', error instanceof Error ? error.stack : 'No stack available');
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  } else if (req.method === 'PUT') {
    try {
      console.log('🔄 [SITE-CONFIG] Iniciando actualización de configuración...');
      
      const adminVerification = await verifyAdminAPI(req, res);
      
      if (!adminVerification.isAdmin) {
        return res.status(adminVerification.error === 'No autorizado' ? 401 : 403)
          .json({ error: adminVerification.error });
      }

      const updateData = req.body;
      console.log('📝 [SITE-CONFIG] Datos de actualización recibidos');
      
      let config = await SiteConfig.findOne();
      
      if (!config) {
        console.log('🆕 [SITE-CONFIG] Creando nueva configuración...');
        config = new SiteConfig(updateData);
      } else {
        console.log('🔄 [SITE-CONFIG] Actualizando configuración existente...');
        Object.assign(config, updateData);
      }

      await config.save();
      console.log('✅ [SITE-CONFIG] Configuración guardada');
      
      // Intentar populate solo si es seguro
      try {
        await config.populate('cursos.destacados');
        console.log('✅ [SITE-CONFIG] Populate exitoso en actualización');
      } catch (populateError) {
        console.error('⚠️ [SITE-CONFIG] Error en populate durante actualización, continuando sin populate:', populateError);
      }

      console.log('✅ [SITE-CONFIG] Actualización completada exitosamente');
      res.status(200).json(config);
      
    } catch (error) {
      console.error('❌ [SITE-CONFIG] Error al actualizar configuración del sitio:', error);
      console.error('❌ [SITE-CONFIG] Stack trace:', error instanceof Error ? error.stack : 'No stack available');
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 