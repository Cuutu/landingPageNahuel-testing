import dbConnect from '@/lib/mongodb';
import Notification from '@/models/Notification';
import NotificationTemplate from '@/models/NotificationTemplate';
import UserSubscription from '@/models/UserSubscription';
import User from '@/models/User';
import { IAlert } from '@/models/Alert';
import { sendEmail, generateAlertEmailTemplate } from '@/lib/emailService';

/**
 * Crea notificación automática cuando se crea una alerta
 * @param alert - La alerta para la cual crear la notificación
 * @param overrides - Opciones para sobreescribir valores por defecto
 * @param overrides.skipDuplicateCheck - Si es true, omite la verificación de duplicados (útil para notificaciones de conversión de rango)
 */
export async function createAlertNotification(alert: IAlert, overrides?: { message?: string; imageUrl?: string; price?: number; action?: 'BUY' | 'SELL'; title?: string; priceRange?: { min: number; max: number }; liquidityPercentage?: number; soldPercentage?: number; profitPercentage?: number; profitLoss?: number; skipDuplicateCheck?: boolean }): Promise<void> {
  try {
    await dbConnect();
    
    console.log('🔔 [ALERT NOTIFICATION] Iniciando creación de notificación para alerta:', alert.symbol);
    console.log('🔔 [ALERT NOTIFICATION] Detalles de alerta:', {
      symbol: alert.symbol,
      action: alert.action,
      tipo: alert.tipo,
      entryPriceRange: alert.entryPriceRange
    });
    if (overrides) {
      console.log('🎛️ [ALERT NOTIFICATION] Overrides recibidos:', overrides);
    }
    
    // ✅ NUEVO: Obtener porcentaje de liquidez desde la distribución si no se pasa en overrides
    let liquidityPercentage = overrides?.liquidityPercentage;
    if (!liquidityPercentage && alert.action === 'BUY') {
      try {
        const LiquidityModule = await import('@/models/Liquidity');
        const Liquidity = LiquidityModule.default;
        
        // Determinar el pool basado en el tipo de alerta
        const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
        
        // Buscar la distribución de liquidez para esta alerta
        const liquidity = await Liquidity.findOne({ pool });
        if (liquidity) {
          const distribution = liquidity.distributions.find((dist: any) => 
            dist.alertId === alert._id.toString() && dist.isActive
          );
          if (distribution) {
            liquidityPercentage = distribution.percentage;
            console.log(`📊 [ALERT NOTIFICATION] Porcentaje de liquidez obtenido desde distribución: ${liquidityPercentage}%`);
          }
        }
      } catch (liquidityError) {
        console.log('⚠️ [ALERT NOTIFICATION] Error obteniendo porcentaje de liquidez desde distribución:', liquidityError);
        // Continuar sin porcentaje de liquidez
      }
    }

    // Determinar el grupo de usuarios basado en el tipo de alerta
    let targetUsers = 'alertas_trader'; // por defecto
    
    if (alert.tipo === 'SmartMoney') {
      targetUsers = 'alertas_smart';
    } else if (alert.tipo === 'TraderCall') {
      targetUsers = 'alertas_trader';
    }

    console.log('🔔 [ALERT NOTIFICATION] Grupo de usuarios objetivo:', targetUsers);
    console.log('🔔 [ALERT NOTIFICATION] Tipo de alerta:', alert.tipo);
    console.log('🔔 [ALERT NOTIFICATION] Fecha actual:', new Date().toISOString());

    // Buscar usuarios con suscripciones activas al servicio específico para validar
    // ✅ IMPORTANTE: Buscar en TODOS los sistemas de suscripciones
    // ✅ INCLUYE: Suscripciones de pago (full) Y pruebas de 30 días (trial)
    const now = new Date();
    
    // ✅ MEJORADO: Consulta más explícita para activeSubscriptions
    // ✅ INCLUYE TANTO 'full' COMO 'trial' (no filtra por subscriptionType)
    const subscribedUsers = await User.find({
      $or: [
        {
          'suscripciones': {
            $elemMatch: {
              servicio: alert.tipo,
              activa: true,
              fechaVencimiento: { $gte: now }
            }
          }
        },
        {
          'subscriptions': {
            $elemMatch: {
              tipo: alert.tipo,
              activa: true,
              $or: [
                { fechaFin: { $gte: now } },
                { fechaFin: { $exists: false } }
              ]
            }
          }
        },
        {
          // ✅ NUEVO: Buscar en activeSubscriptions (sistema MercadoPago/Admin)
          // ✅ INCLUYE tanto suscripciones 'full' como 'trial' de 30 días
          'activeSubscriptions': {
            $elemMatch: {
              service: alert.tipo,
              isActive: true,
              expiryDate: { $gte: now }
              // ✅ NO filtramos por subscriptionType para incluir 'full' y 'trial'
            }
          }
        }
      ]
    }, 'email name role suscripciones subscriptions activeSubscriptions').lean();
    
    // ✅ NUEVO: Filtrar manualmente para asegurar que las fechas sean válidas
    // ✅ INCLUYE tanto suscripciones de pago como trials
    // (por si acaso hay algún problema con la consulta de MongoDB)
    const validSubscribedUsers = subscribedUsers.filter(user => {
      // Verificar suscripciones legacy
      const hasLegacySub = user.suscripciones?.some((sub: any) => 
        sub.servicio === alert.tipo && 
        sub.activa === true && 
        new Date(sub.fechaVencimiento) >= now
      );
      
      // Verificar subscriptions intermedio
      const hasIntermediateSub = user.subscriptions?.some((sub: any) => 
        sub.tipo === alert.tipo && 
        sub.activa === true && 
        (!sub.fechaFin || new Date(sub.fechaFin) >= now)
      );
      
      // Verificar activeSubscriptions (el más importante)
      // ✅ INCLUYE tanto 'full' como 'trial' - no filtramos por subscriptionType
      const hasActiveSub = user.activeSubscriptions?.some((sub: any) => 
        sub.service === alert.tipo && 
        sub.isActive === true && 
        new Date(sub.expiryDate) >= now
        // ✅ NO verificamos subscriptionType - incluye 'full' y 'trial'
      );
      
      return hasLegacySub || hasIntermediateSub || hasActiveSub;
    });

    console.log('👥 [ALERT NOTIFICATION] Usuarios encontrados por query:', subscribedUsers.length);
    console.log('👥 [ALERT NOTIFICATION] Usuarios válidos después de filtrado (incluye trials):', validSubscribedUsers.length);
    console.log('🔍 [ALERT NOTIFICATION] Tipo de alerta buscado:', alert.tipo);
    console.log('🔍 [ALERT NOTIFICATION] Fecha actual para comparación:', new Date().toISOString());
    
    // Usar validSubscribedUsers en lugar de subscribedUsers
    const finalSubscribedUsers = validSubscribedUsers;
    
    // ✅ NUEVO: Log para verificar que se incluyen trials
    const trialUsers = finalSubscribedUsers.filter(user => {
      return user.activeSubscriptions?.some((sub: any) => 
        sub.service === alert.tipo && 
        sub.subscriptionType === 'trial' &&
        sub.isActive === true && 
        new Date(sub.expiryDate) >= now
      );
    });
    console.log('🎁 [ALERT NOTIFICATION] Usuarios con trial incluidos:', trialUsers.length);
    
    if (finalSubscribedUsers.length === 0) {
      console.log('⚠️ [ALERT NOTIFICATION] No hay usuarios suscritos al servicio:', alert.tipo);
      
      // Debug: Ver si hay usuarios en la DB
      const totalUsers = await User.countDocuments();
      console.log('📊 [ALERT NOTIFICATION] Total usuarios en DB:', totalUsers);
      
      // ✅ NUEVO: Buscar usuarios con activeSubscriptions para el tipo específico
      const usersWithActiveSubs = await User.find({
        'activeSubscriptions.service': alert.tipo
      }, 'email activeSubscriptions').limit(5);
      
      console.log('🔍 [ALERT NOTIFICATION] Usuarios con activeSubscriptions para', alert.tipo, ':', usersWithActiveSubs.length);
      usersWithActiveSubs.forEach(u => {
        const subs = u.activeSubscriptions?.filter((sub: any) => sub.service === alert.tipo) || [];
        console.log(`  - ${u.email}:`, {
          totalActiveSubs: u.activeSubscriptions?.length || 0,
          matchingSubs: subs.length,
          subs: subs.map((sub: any) => ({
            service: sub.service,
            isActive: sub.isActive,
            expiryDate: sub.expiryDate,
            isExpired: new Date(sub.expiryDate) < new Date(),
            daysUntilExpiry: Math.ceil((new Date(sub.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          }))
        });
      });
      
      // Debug: Ver algunos usuarios y sus suscripciones
      const sampleUsers = await User.find({}, 'email suscripciones subscriptions activeSubscriptions').limit(3);
      console.log('🔍 [ALERT NOTIFICATION] Muestra de usuarios:');
      sampleUsers.forEach(u => {
        console.log(`  - ${u.email}:`, {
          suscripciones: u.suscripciones?.length || 0,
          subscriptions: u.subscriptions?.length || 0,
          activeSubscriptions: u.activeSubscriptions?.length || 0,
          activeSubsDetails: u.activeSubscriptions?.map((sub: any) => ({
            service: sub.service,
            isActive: sub.isActive,
            expiryDate: sub.expiryDate
          })) || []
        });
      });
    } else {
      console.log('✅ [ALERT NOTIFICATION] Usuarios que recibirán email:');
      finalSubscribedUsers.forEach(u => {
        const matchingSub = u.activeSubscriptions?.find((sub: any) => sub.service === alert.tipo && sub.isActive);
        console.log(`  - ${u.email}:`, {
          hasActiveSub: !!matchingSub,
          expiryDate: matchingSub?.expiryDate,
          daysUntilExpiry: matchingSub ? Math.ceil((new Date(matchingSub.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
        });
      });
    }

    // Buscar plantilla específica para alertas
    const template = await NotificationTemplate.findOne({ name: 'nueva_alerta' });
    console.log('🎨 [ALERT NOTIFICATION] Plantilla encontrada:', !!template);
    
    let notification: any;
    
    if (template) {
      // Usar plantilla con variables dinámicas
      // Determinar el precio a mostrar: priorizar overrides, luego entryPriceRange, luego entryPrice
      let priceDisplay = 'N/A';
      if (overrides?.priceRange) {
        priceDisplay = `${overrides.priceRange.min} - ${overrides.priceRange.max}`;
      } else if (alert.entryPriceRange?.min && alert.entryPriceRange?.max) {
        priceDisplay = `${alert.entryPriceRange.min} - ${alert.entryPriceRange.max}`;
      } else if (overrides?.price != null) {
        priceDisplay = overrides.price.toString();
      } else if (alert.entryPrice) {
        priceDisplay = alert.entryPrice.toString();
      }
      
      const variables = {
        alertType: alert.tipo,
        symbol: alert.symbol,
        action: alert.action,
        price: priceDisplay,
        takeProfit: alert.takeProfit?.toString() || 'N/A',
        stopLoss: alert.stopLoss?.toString() || 'N/A'
      };
      
      const rendered = template.render(variables);

      const finalImageUrl = overrides?.imageUrl || (alert as any)?.chartImage?.secure_url || (alert as any)?.chartImage?.url || null;

      // Determinar el tab según si es una operación ejecutada
      // Si hay soldPercentage o profitPercentage, es una operación ejecutada -> operaciones
      // Si el título contiene "Venta Ejecutada" o "Compra Confirmada", también es operación ejecutada
      const isExecutedOperation = overrides?.soldPercentage != null || 
                                   overrides?.profitPercentage != null || 
                                   overrides?.profitLoss != null ||
                                   (overrides?.title && (overrides.title.includes('Venta Ejecutada') || overrides.title.includes('Compra Confirmada')));
      const targetTab = isExecutedOperation ? 'operaciones' : 'seguimiento';

      notification = {
        title: overrides?.title || rendered.title,
        message: overrides?.message || rendered.message,
        type: 'alerta',
        priority: 'alta', // Usar valor válido en español
        targetUsers: targetUsers,
        icon: '🚨',
        actionUrl: getAlertActionUrl(alert.tipo, targetTab),
        actionText: 'Ver Alertas',
        isActive: true,
        createdBy: 'sistema', // Campo requerido
        isAutomatic: true,
        relatedAlertId: alert._id,
        templateId: template._id,
        metadata: {
          alertSymbol: alert.symbol,
          alertAction: overrides?.action || alert.action,
          alertPrice: (overrides?.priceRange ? `${overrides.priceRange.min}-${overrides.priceRange.max}` : (overrides?.price != null ? overrides.price : (alert.entryPriceRange?.max || alert.entryPrice || null))),
          alertService: alert.tipo,
          automatic: true,
          imageUrl: finalImageUrl,
          priceRange: overrides?.priceRange || (alert.entryPriceRange?.min && alert.entryPriceRange?.max ? { min: alert.entryPriceRange.min, max: alert.entryPriceRange.max } : null),
          participationPercentage: alert.participationPercentage || alert.originalParticipationPercentage || 100,
          liquidityPercentage: overrides?.liquidityPercentage != null ? overrides.liquidityPercentage : (liquidityPercentage || null),
          soldPercentage: overrides?.soldPercentage != null ? overrides.soldPercentage : null,
          profitPercentage: overrides?.profitPercentage != null ? overrides.profitPercentage : null,
          profitLoss: overrides?.profitLoss != null ? overrides.profitLoss : null
        }
      };
    } else {
      console.log('🎨 [ALERT NOTIFICATION] Usando notificación manual (sin plantilla)');
      // Crear notificación manual si no hay plantilla
      // Determinar el precio a mostrar en el mensaje
      let priceMessage = 'N/A';
      if (overrides?.priceRange) {
        priceMessage = `$${overrides.priceRange.min} - $${overrides.priceRange.max}`;
      } else if (alert.entryPriceRange?.min && alert.entryPriceRange?.max) {
        priceMessage = `$${alert.entryPriceRange.min} - $${alert.entryPriceRange.max}`;
      } else if (overrides?.price != null) {
        priceMessage = `$${overrides.price}`;
      } else if (alert.entryPrice) {
        priceMessage = `$${alert.entryPrice}`;
      }
      
      const defaultMessage = `${alert.action} ${alert.symbol} en ${priceMessage}. TP: $${alert.takeProfit}, SL: $${alert.stopLoss}`;
      const finalImageUrl = overrides?.imageUrl || (alert as any)?.chartImage?.secure_url || (alert as any)?.chartImage?.url || null;
      
      // Determinar el tab según si es una operación ejecutada
      // Si hay soldPercentage o profitPercentage, es una operación ejecutada -> operaciones
      // Si el título contiene "Venta Ejecutada" o "Compra Confirmada", también es operación ejecutada
      const isExecutedOperation = overrides?.soldPercentage != null || 
                                   overrides?.profitPercentage != null || 
                                   overrides?.profitLoss != null ||
                                   (overrides?.title && (overrides.title.includes('Venta Ejecutada') || overrides.title.includes('Compra Confirmada')));
      const targetTab = isExecutedOperation ? 'operaciones' : 'seguimiento';
      
      notification = {
        title: overrides?.title || `🚨 Nueva Alerta ${alert.tipo} 🚨`,
        message: overrides?.message || defaultMessage,
        type: 'alerta',
        priority: 'alta', // Usar valor válido en español
        targetUsers: targetUsers,
        icon: '🚨',
        actionUrl: getAlertActionUrl(alert.tipo, targetTab),
        actionText: 'Ver Alertas',
        isActive: true,
        createdBy: 'sistema', // Campo requerido
        isAutomatic: true,
        relatedAlertId: alert._id,
        metadata: {
          alertSymbol: alert.symbol,
          alertAction: overrides?.action || alert.action,
          alertPrice: (overrides?.priceRange ? `${overrides.priceRange.min}-${overrides.priceRange.max}` : (overrides?.price != null ? overrides.price : (alert.entryPriceRange?.max || alert.entryPrice || null))),
          alertService: alert.tipo,
          automatic: true,
          imageUrl: finalImageUrl,
          priceRange: overrides?.priceRange || (alert.entryPriceRange?.min && alert.entryPriceRange?.max ? { min: alert.entryPriceRange.min, max: alert.entryPriceRange.max } : null),
          participationPercentage: alert.participationPercentage || alert.originalParticipationPercentage || 100,
          liquidityPercentage: overrides?.liquidityPercentage != null ? overrides.liquidityPercentage : (liquidityPercentage || null),
          soldPercentage: overrides?.soldPercentage != null ? overrides.soldPercentage : null,
          profitPercentage: overrides?.profitPercentage != null ? overrides.profitPercentage : null,
          profitLoss: overrides?.profitLoss != null ? overrides.profitLoss : null
        }
      };
    }

    console.log('📧 [ALERT NOTIFICATION] Creando notificación global:', {
      title: notification.title,
      targetUsers: notification.targetUsers,
      subscribedUsers: finalSubscribedUsers.length,
      trialUsers: trialUsers.length,
      hasImage: !!notification.metadata?.imageUrl
    });

    // ✅ CORREGIDO: Verificar si ya existe una notificación para esta alerta para evitar duplicados
    // ✅ NUEVO: Si skipDuplicateCheck es true, omitir esta verificación (útil para conversiones de rango)
    if (!overrides?.skipDuplicateCheck) {
      const existingNotification = await Notification.findOne({
        relatedAlertId: alert._id.toString(),
        targetUsers: notification.targetUsers,
        isActive: true
      });

      if (existingNotification) {
        console.log(`⚠️ [ALERT NOTIFICATION] Ya existe una notificación para esta alerta (${alert._id}), no se creará duplicado`);
        return;
      }
    } else {
      console.log(`🔄 [ALERT NOTIFICATION] skipDuplicateCheck=true - Omitiendo verificación de duplicados para alerta ${alert._id}`);
    }

    // Crear UNA notificación global que se muestre a todos los usuarios del grupo
    const notificationDoc = new Notification(notification);
    await notificationDoc.save();

    console.log(`✅ [ALERT NOTIFICATION] Notificación global creada exitosamente: ${notificationDoc._id}`);
    console.log(`📊 [ALERT NOTIFICATION] Se mostrará a ${finalSubscribedUsers.length} usuarios suscritos al servicio ${alert.tipo} (incluye ${trialUsers.length} con trial)`);

    // ✅ NUEVO: Enviar notificación a Telegram
    try {
      const { sendAlertToTelegram } = await import('@/lib/telegramBot');
      await sendAlertToTelegram(alert, {
        message: overrides?.message,
        imageUrl: overrides?.imageUrl || notification.metadata?.imageUrl,
        priceRange: overrides?.priceRange || notification.metadata?.priceRange,
        price: overrides?.price,
        action: overrides?.action, // ✅ CORREGIDO: Pasar action para ventas
        liquidityPercentage: overrides?.liquidityPercentage || notification.metadata?.liquidityPercentage,
        soldPercentage: overrides?.soldPercentage || notification.metadata?.soldPercentage,
        profitPercentage: overrides?.profitPercentage || notification.metadata?.profitPercentage,
        profitLoss: overrides?.profitLoss || notification.metadata?.profitLoss
      });
    } catch (telegramError) {
      console.error('❌ [ALERT NOTIFICATION] Error enviando a Telegram:', telegramError);
      // No fallar la notificación si Telegram falla
    }

    // ✅ TESTING MODE: Solo enviar emails a administradores si está activado
    const TESTING_MODE = process.env.EMAIL_TESTING_MODE === 'true';
    
    // Filtrar usuarios: si está en modo testing, solo admins
    const usersToEmail = TESTING_MODE 
      ? finalSubscribedUsers.filter((user: any) => user.role === 'admin')
      : finalSubscribedUsers;
    
    if (TESTING_MODE) {
      console.log(`🧪 [ALERT NOTIFICATION] MODO TESTING ACTIVADO - Solo enviando emails a ${usersToEmail.length} administradores`);
    }
    
    // Enviar emails a usuarios suscritos con rate limiting
    let emailsSent = 0;
    const emailErrors: string[] = [];

    // Procesar en lotes pequeños para evitar rate limiting de Gmail
    const batchSize = 5;
    for (let i = 0; i < usersToEmail.length; i += batchSize) {
      const batch = usersToEmail.slice(i, i + batchSize);
      console.log(`📧 [ALERT NOTIFICATION] Procesando lote de emails ${Math.floor(i / batchSize) + 1}/${Math.ceil(usersToEmail.length / batchSize)}`);
      
      for (const user of batch) {
        try {
          const emailSuccess = await sendEmailNotification(user, notificationDoc);
          if (emailSuccess) {
            emailsSent++;
          } else {
            emailErrors.push(`Error enviando email a ${user.email}`);
          }
          // Pequeña pausa entre emails (500ms) para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ Error enviando email a ${user.email}:`, error);
          emailErrors.push(`Error para ${user.email}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
          
          // Si es error de rate limiting, esperar más tiempo
          if (error instanceof Error && error.message.includes('Too many login attempts')) {
            console.warn('⚠️ [ALERT NOTIFICATION] Rate limiting detectado, esperando 10 segundos...');
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }
      
      // Pausa entre lotes (2 segundos)
      if (i + batchSize < usersToEmail.length) {
        console.log('⏰ [ALERT NOTIFICATION] Pausa de 2 segundos entre lotes...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`📧 [ALERT NOTIFICATION] Emails enviados: ${emailsSent}/${usersToEmail.length}${TESTING_MODE ? ' (solo admins - modo testing)' : ''}`);
    
    if (emailErrors.length > 0) {
      console.error('❌ [ALERT NOTIFICATION] Errores de email:', emailErrors.slice(0, 3));
    }

  } catch (error) {
    console.error('❌ [ALERT NOTIFICATION] Error creando notificación de alerta:', error);
  }
}

/**
 * Crea notificación automática cuando se crea un informe
 */
export async function createReportNotification(report: any): Promise<void> {
  try {
    await dbConnect();
    
    console.log('📰 [REPORT NOTIFICATION] Iniciando creación de notificación para informe:', report.title);
    console.log('📰 [REPORT NOTIFICATION] Detalles del informe:', {
      title: report.title,
      type: report.type,
      category: report.category,
      author: report.author
    });

    // Mapear categoría del informe al grupo de usuarios
    let targetUsers = 'alertas_trader'; // por defecto
    let serviceType = 'TraderCall';
    
    if (report.category === 'trader-call') {
      targetUsers = 'alertas_trader';
      serviceType = 'TraderCall';
    } else if (report.category === 'smart-money') {
      targetUsers = 'alertas_smart';
      serviceType = 'SmartMoney';
    }

    console.log('📰 [REPORT NOTIFICATION] Grupo de usuarios objetivo:', targetUsers, 'para servicio:', serviceType);

    // Buscar usuarios con suscripciones activas al servicio específico para validar
    // ✅ IMPORTANTE: Buscar en TODOS los sistemas de suscripciones
    // ✅ INCLUYE: Suscripciones de pago (full) Y pruebas de 30 días (trial)
    const now = new Date();
    const subscribedUsers = await User.find({
      $or: [
        {
          'suscripciones': {
            $elemMatch: {
              servicio: serviceType,
              activa: true,
              fechaVencimiento: { $gte: now }
            }
          }
        },
        {
          'subscriptions': {
            $elemMatch: {
              tipo: serviceType,
              activa: true,
              $or: [
                { fechaFin: { $gte: now } },
                { fechaFin: { $exists: false } }
              ]
            }
          }
        },
        {
          // ✅ NUEVO: Buscar en activeSubscriptions (sistema MercadoPago/Admin)
          // ✅ INCLUYE tanto suscripciones 'full' como 'trial' de 30 días
          'activeSubscriptions': {
            $elemMatch: {
              service: serviceType,
              isActive: true,
              expiryDate: { $gte: now }
              // ✅ NO filtramos por subscriptionType para incluir 'full' y 'trial'
            }
          }
        }
      ]
    }, 'email name role suscripciones subscriptions activeSubscriptions').lean();
    
    // ✅ NUEVO: Filtrar manualmente para asegurar que las fechas sean válidas
    // ✅ INCLUYE tanto suscripciones de pago como trials
    const validSubscribedUsers = subscribedUsers.filter(user => {
      // Verificar suscripciones legacy
      const hasLegacySub = user.suscripciones?.some((sub: any) => 
        sub.servicio === serviceType && 
        sub.activa === true && 
        new Date(sub.fechaVencimiento) >= now
      );
      
      // Verificar subscriptions intermedio
      const hasIntermediateSub = user.subscriptions?.some((sub: any) => 
        sub.tipo === serviceType && 
        sub.activa === true && 
        (!sub.fechaFin || new Date(sub.fechaFin) >= now)
      );
      
      // Verificar activeSubscriptions (el más importante)
      // ✅ INCLUYE tanto 'full' como 'trial' - no filtramos por subscriptionType
      const hasActiveSub = user.activeSubscriptions?.some((sub: any) => 
        sub.service === serviceType && 
        sub.isActive === true && 
        new Date(sub.expiryDate) >= now
        // ✅ NO verificamos subscriptionType - incluye 'full' y 'trial'
      );
      
      return hasLegacySub || hasIntermediateSub || hasActiveSub;
    });

    console.log('👥 [REPORT NOTIFICATION] Usuarios encontrados por query:', subscribedUsers.length);
    console.log('👥 [REPORT NOTIFICATION] Usuarios válidos después de filtrado (incluye trials):', validSubscribedUsers.length);
    
    // Usar validSubscribedUsers en lugar de subscribedUsers
    const finalSubscribedUsers = validSubscribedUsers;
    
    if (finalSubscribedUsers.length === 0) {
      console.log('⚠️ [REPORT NOTIFICATION] No hay usuarios suscritos al servicio:', serviceType);
      return;
    }
    
    // ✅ NUEVO: Log para verificar que se incluyen trials
    const trialUsers = finalSubscribedUsers.filter(user => {
      return user.activeSubscriptions?.some((sub: any) => 
        sub.service === serviceType && 
        sub.subscriptionType === 'trial' &&
        sub.isActive === true && 
        new Date(sub.expiryDate) >= now
      );
    });
    console.log('🎁 [REPORT NOTIFICATION] Usuarios con trial incluidos:', trialUsers.length);

    // Crear notificación para informe
    const notification = {
      title: `📰 Nuevo Informe ${serviceType}: ${report.title}`,
      message: `Se ha publicado un nuevo informe de análisis para ${serviceType}. ${report.content.substring(0, 100)}...`,
      type: 'actualizacion',
      priority: 'media', // Usar valor válido en español
      targetUsers: targetUsers,
      icon: '📰',
      actionUrl: `/reports/${report._id}`, // URL específica del informe
      actionText: 'Leer Informe',
      isActive: true,
      createdBy: 'sistema', // Campo requerido
      isAutomatic: true,
      relatedReportId: report._id,
      metadata: {
        reportTitle: report.title,
        reportType: report.type,
        reportCategory: report.category,
        serviceType: serviceType,
        automatic: true
      }
    };

    console.log('📧 [REPORT NOTIFICATION] Creando notificación global:', {
      title: notification.title,
      targetUsers: notification.targetUsers,
      subscribedUsers: finalSubscribedUsers.length,
      trialUsers: trialUsers.length
    });

    // ✅ CORREGIDO: Verificar si ya existe una notificación para este informe para evitar duplicados
    // Usar metadata.reportTitle y targetUsers para identificar duplicados
    const existingNotification = await Notification.findOne({
      'metadata.reportTitle': report.title,
      targetUsers: notification.targetUsers,
      type: 'actualizacion',
      isActive: true,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24 horas
    });

    if (existingNotification) {
      console.log(`⚠️ [REPORT NOTIFICATION] Ya existe una notificación para este informe (${report.title}), no se creará duplicado`);
      return;
    }

    // Crear UNA notificación global que se muestre a todos los usuarios del grupo
    const notificationDoc = new Notification(notification);
    await notificationDoc.save();

    console.log(`✅ [REPORT NOTIFICATION] Notificación global creada exitosamente: ${notificationDoc._id}`);
    console.log(`📊 [REPORT NOTIFICATION] Se mostrará a ${finalSubscribedUsers.length} usuarios suscritos al servicio ${serviceType} (incluye ${trialUsers.length} con trial)`);

    // ✅ NUEVO: Enviar notificación a Telegram
    try {
      const { sendReportToTelegram } = await import('@/lib/telegramBot');
      await sendReportToTelegram(report);
    } catch (telegramError) {
      console.error('❌ [REPORT NOTIFICATION] Error enviando a Telegram:', telegramError);
      // No fallar la notificación si Telegram falla
    }

    // ✅ TESTING MODE: Solo enviar emails a administradores si está activado
    const TESTING_MODE = process.env.EMAIL_TESTING_MODE === 'true';
    
    // Filtrar usuarios: si está en modo testing, solo admins
    const usersToEmail = TESTING_MODE 
      ? finalSubscribedUsers.filter((user: any) => user.role === 'admin')
      : finalSubscribedUsers;
    
    if (TESTING_MODE) {
      console.log(`🧪 [REPORT NOTIFICATION] MODO TESTING ACTIVADO - Solo enviando emails a ${usersToEmail.length} administradores`);
    }

    // Enviar emails a usuarios suscritos (incluye trials) con rate limiting
    let emailsSent = 0;
    const emailErrors: string[] = [];

    // Procesar en lotes pequeños para evitar rate limiting de Gmail
    const batchSize = 5;
    for (let i = 0; i < usersToEmail.length; i += batchSize) {
      const batch = usersToEmail.slice(i, i + batchSize);
      console.log(`📧 [REPORT NOTIFICATION] Procesando lote de emails ${Math.floor(i / batchSize) + 1}/${Math.ceil(usersToEmail.length / batchSize)}`);
      
      for (const user of batch) {
        try {
          const emailSuccess = await sendEmailNotification(user, notificationDoc);
          if (emailSuccess) {
            emailsSent++;
          } else {
            emailErrors.push(`Error enviando email a ${user.email}`);
          }
          // Pequeña pausa entre emails (500ms) para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`❌ Error enviando email a ${user.email}:`, error);
          emailErrors.push(`Error para ${user.email}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
          
          // Si es error de rate limiting, esperar más tiempo
          if (error instanceof Error && error.message.includes('Too many login attempts')) {
            console.warn('⚠️ [REPORT NOTIFICATION] Rate limiting detectado, esperando 10 segundos...');
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }
      
      // Pausa entre lotes (2 segundos)
      if (i + batchSize < usersToEmail.length) {
        console.log('⏰ [REPORT NOTIFICATION] Pausa de 2 segundos entre lotes...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`📧 [REPORT NOTIFICATION] Emails enviados: ${emailsSent}/${usersToEmail.length}${TESTING_MODE ? ' (solo admins - modo testing)' : ' (incluye usuarios con trial)'}`);
    
    if (emailErrors.length > 0) {
      console.error('❌ [REPORT NOTIFICATION] Errores de email:', emailErrors.slice(0, 3));
    }

  } catch (error) {
    console.error('❌ [REPORT NOTIFICATION] Error creando notificación de informe:', error);
  }
}

/**
 * Envía notificación a usuarios suscritos (función original para notificaciones manuales)
 */
export async function sendNotificationToSubscribers(
  notification: any, 
  subscriptionType?: string, 
  shouldSendEmail: boolean = true
): Promise<{
  sent: number;
  failed: number;
  emailsSent: number;
  errors: string[];
}> {
  try {
    await dbConnect();

    // Determinar el tipo de suscripción basado en el tipo de notificación
    let targetSubscriptionType = subscriptionType || 'notificaciones_sistema';
    
    // Mapear tipos de notificación a tipos de suscripción
    switch (notification.type) {
      case 'alerta':
        targetSubscriptionType = 'notificaciones_alertas';
        break;
      case 'promocion':
        targetSubscriptionType = 'notificaciones_promociones';
        break;
      case 'actualizacion':
        targetSubscriptionType = 'notificaciones_actualizaciones';
        break;
      case 'sistema':
      default:
        targetSubscriptionType = 'notificaciones_sistema';
        break;
    }

    // Buscar usuarios suscritos para validar y enviar emails
    const subscriptions = await UserSubscription.find({
      [`subscriptions.${targetSubscriptionType}`]: true
    });

    if (subscriptions.length === 0) {
      console.log('📧 No hay usuarios suscritos para este tipo de notificación');
      return {
        sent: 0,
        failed: 0,
        emailsSent: 0,
        errors: []
      };
    }

    const userEmails = subscriptions.map(sub => sub.userEmail);
    console.log(`📧 Creando notificación global para ${userEmails.length} usuarios suscritos`);

    // Determinar targetUsers para la notificación global
    let targetUsers = 'todos'; // por defecto
    
    // Mapear tipos de suscripción a grupos de usuarios
    switch (targetSubscriptionType) {
      case 'notificaciones_alertas':
        targetUsers = 'suscriptores';
        break;
      case 'notificaciones_promociones':
        targetUsers = 'todos';
        break;
      case 'notificaciones_actualizaciones':
        targetUsers = 'suscriptores';
        break;
      case 'notificaciones_sistema':
      default:
        targetUsers = 'todos';
        break;
    }

    // Crear UNA notificación global que se muestre a todos los usuarios del grupo
    const notificationDoc = new Notification({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority || 'media',
      targetUsers: targetUsers,
      icon: notification.icon || '📧',
      actionUrl: notification.actionUrl,
      actionText: notification.actionText,
      isActive: true,
      createdBy: notification.metadata?.sentBy || 'admin',
      isAutomatic: notification.isAutomatic || false,
      metadata: notification.metadata || {}
    });

    await notificationDoc.save();
    console.log(`✅ Notificación global creada exitosamente: ${notificationDoc._id}`);

    // Enviar emails a usuarios suscritos
    let emailsSent = 0;
    const errors: string[] = [];

    // Procesar en lotes pequeños para evitar rate limiting de Gmail
    const batchSize = 5;
    for (let i = 0; i < userEmails.length; i += batchSize) {
      const batch = userEmails.slice(i, i + batchSize);
      console.log(`📧 [NOTIFICATION] Procesando lote de emails ${Math.floor(i / batchSize) + 1}/${Math.ceil(userEmails.length / batchSize)}`);
      
      for (const email of batch) {
        try {
          const user = await User.findOne({ email });
          if (!user) continue;

          // Enviar email si está habilitado
          if (shouldSendEmail) {
            const emailSuccess = await sendEmailNotification(user, notificationDoc);
            if (emailSuccess) {
              emailsSent++;
            } else {
              errors.push(`Error enviando email a ${email}`);
            }
            // Pequeña pausa entre emails (500ms) para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error) {
          console.error(`❌ Error enviando email a ${email}:`, error);
          errors.push(`Error para ${email}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
          
          // Si es error de rate limiting, esperar más tiempo
          if (error instanceof Error && error.message.includes('Too many login attempts')) {
            console.warn('⚠️ [NOTIFICATION] Rate limiting detectado, esperando 10 segundos...');
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }
      
      // Pausa entre lotes (2 segundos)
      if (i + batchSize < userEmails.length) {
        console.log('⏰ [NOTIFICATION] Pausa de 2 segundos entre lotes...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`📊 Notificación global creada. Emails enviados: ${emailsSent}/${userEmails.length}`);

    return {
      sent: 1, // Una notificación global creada
      failed: 0,
      emailsSent,
      errors
    };

  } catch (error) {
    console.error('❌ Error en sendNotificationToSubscribers:', error);
    return {
      sent: 0,
      failed: 1,
      emailsSent: 0,
      errors: [error instanceof Error ? error.message : 'Error desconocido']
    };
  }
}

/**
 * Envía notificación por email a un usuario específico
 */
export async function sendEmailNotification(user: any, notification: any): Promise<boolean> {
  try {
    console.log(`📧 Enviando email a: ${user.email}`);
    
    // Usar la nueva plantilla de email mejorada para alertas
    const htmlContent = generateAlertEmailTemplate(notification, user);
    
    // Enviar email usando el servicio real
    await sendEmail({
      to: user.email,
      subject: notification.title,
      html: htmlContent
    });

    console.log(`✅ Email enviado exitosamente a: ${user.email}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error enviando email a ${user.email}:`, error);
    return false;
  }
}

/**
 * Genera plantilla HTML para email
 */
export function generateEmailTemplate(notification: any, user: any): string {
  const actionButton = notification.actionUrl ? 
    `<a href="${notification.actionUrl}" style="display: inline-block; padding: 12px 24px; background: #00ff88; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">
      ${notification.actionText || 'Ver Más'}
    </a>` : '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${notification.title}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 700;">
          ${notification.icon} ${notification.title}
        </h1>
      </div>
      
      <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 16px; color: #555;">
          Hola ${user.name || user.email},
        </p>
        <p style="margin: 15px 0; font-size: 16px; color: #333;">
          ${notification.message}
        </p>
        
        ${actionButton}
      </div>
      
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666;">
        <p>Este es un email automático de <strong>Nahuel Lozano Trading</strong></p>
        <p>Si no deseas recibir estas notificaciones, puedes <a href="/perfil">configurar tus preferencias</a></p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Crea plantillas por defecto para alertas
 */
export async function createDefaultTemplates(): Promise<void> {
  try {
    await dbConnect();
    
    console.log('🎨 Creando plantillas por defecto...');
    
    // Plantilla para nuevas alertas
    const alertTemplate = {
      name: 'nueva_alerta',
      description: 'Plantilla para notificaciones de nuevas alertas',
      type: 'alerta',
      priority: 'alta',
      titleTemplate: '🚨 Nueva Alerta {alertType} 🚨',
      messageTemplate: '{action} {symbol} en ${price}. TP: ${takeProfit}, SL: ${stopLoss}',
      icon: '🚨',
      actionUrlTemplate: '/alertas/{alertType}',
      actionTextTemplate: 'Ver Alerta',
      targetUsers: 'todos',
      variables: [
        {
          name: 'alertType',
          description: 'Tipo de alerta (Trader Call, Smart Money, etc.)',
          type: 'string',
          required: true
        },
        {
          name: 'symbol',
          description: 'Símbolo del activo',
          type: 'string',
          required: true
        },
        {
          name: 'action',
          description: 'Acción de la alerta (BUY/SELL)',
          type: 'string',
          required: true
        },
        {
          name: 'price',
          description: 'Precio de entrada',
          type: 'number',
          required: true
        },
        {
          name: 'takeProfit',
          description: 'Precio de take profit',
          type: 'number',
          required: true
        },
        {
          name: 'stopLoss',
          description: 'Precio de stop loss',
          type: 'number',
          required: true
        }
      ],
      isActive: true,
      createdBy: 'system'
    };
    
    // Crear plantilla si no existe
    const existingTemplate = await NotificationTemplate.findOne({ name: 'nueva_alerta' });
    if (!existingTemplate) {
      await NotificationTemplate.create(alertTemplate);
      console.log('✅ Plantilla de alerta creada');
    } else {
      console.log('ℹ️ Plantilla de alerta ya existe');
    }
    
  } catch (error) {
    console.error('❌ Error creando plantillas por defecto:', error);
  }
}

/**
 * Inicializa suscripciones por defecto para un usuario nuevo
 */
export async function initializeUserSubscriptions(userEmail: string): Promise<void> {
  try {
    await dbConnect();
    
    console.log(`🔔 [INIT SUBSCRIPTIONS] Inicializando suscripciones para: ${userEmail}`);
    
    // Verificar si ya tiene suscripciones
    const existing = await UserSubscription.findOne({ userEmail });
    if (existing) {
      console.log(`ℹ️ [INIT SUBSCRIPTIONS] Usuario ${userEmail} ya tiene suscripciones configuradas`);
      return;
    }
    
    // Crear suscripciones por defecto - ACTIVAR ALERTAS POR DEFECTO
    await UserSubscription.create({
      userEmail,
      subscriptions: {
        // ✅ ALERTAS ACTIVADAS POR DEFECTO - los usuarios recibirán notificaciones
        alertas_trader: true,
        alertas_smart: true, 
        alertas_cashflow: true,
        // ✅ NOTIFICACIONES GENERALES ACTIVADAS
        notificaciones_sistema: true,
        notificaciones_promociones: true,
        notificaciones_actualizaciones: true
      },
      preferences: {
        emailNotifications: true,
        pushNotifications: true,
        browserNotifications: true
      }
    });
    
    console.log(`✅ [INIT SUBSCRIPTIONS] Suscripciones inicializadas para: ${userEmail} (todas las alertas ACTIVADAS)`);
    
  } catch (error) {
    console.error('❌ [INIT SUBSCRIPTIONS] Error inicializando suscripciones:', error);
  }
}

/**
 * Asigna notificaciones existentes a un usuario recién registrado
 */
export async function assignNotificationsToNewUser(userEmail: string): Promise<void> {
  try {
    await dbConnect();
    
    // Inicializar suscripciones
    await initializeUserSubscriptions(userEmail);
    
    // Obtener el usuario para verificar su rol
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.log(`❌ Usuario no encontrado: ${userEmail}`);
      return;
    }

    console.log(`📬 Asignando notificaciones a usuario nuevo: ${userEmail} (rol: ${user.role})`);
    
    // Las notificaciones se asignan automáticamente por el query de la API
    // En el futuro, aquí podríamos implementar un sistema de tracking más granular
    
  } catch (error) {
    console.error('❌ Error al asignar notificaciones a usuario nuevo:', error);
  }
}

/**
 * Obtiene estadísticas reales de notificaciones
 */
export async function getNotificationStats(): Promise<{
  totalNotifications: number;
  activeNotifications: number;
  notificationsByType: Record<string, number>;
  recentNotifications: any[];
}> {
  try {
    await dbConnect();
    
    const [
      totalNotifications,
      activeNotifications,
      notificationsByType,
      recentNotifications
    ] = await Promise.all([
      Notification.countDocuments(),
      Notification.countDocuments({ isActive: true }),
      Notification.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      Notification.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title type createdAt')
    ]);
    
    const typeStats = notificationsByType.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalNotifications,
      activeNotifications,
      notificationsByType: typeStats,
      recentNotifications
    };
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de notificaciones:', error);
    return {
      totalNotifications: 0,
      activeNotifications: 0,
      notificationsByType: {},
      recentNotifications: []
    };
  }
}

/**
 * Obtiene la URL de acción para las alertas según el tipo
 * @param tipo - Tipo de alerta (TraderCall, SmartMoney, etc.)
 * @param tab - Tab específico a mostrar (seguimiento, operaciones). Si no se especifica, usa 'seguimiento' por defecto
 */
function getAlertActionUrl(tipo: string, tab: string = 'seguimiento'): string {
  switch (tipo) {
    case 'TraderCall':
      return `/alertas/trader-call?tab=${tab}`;
    case 'SmartMoney':
      return `/alertas/smart-money?tab=${tab}`;

    default:
      return '/alertas';
  }
}

/**
 * Asegura que todos los usuarios tengan suscripciones configuradas
 */
export async function ensureUserSubscriptions(): Promise<void> {
  try {
    await dbConnect();
    
    console.log('🔔 [SUBSCRIPTION CHECK] Verificando suscripciones de usuarios...');
    
    // Obtener todos los usuarios
    const allUsers = await User.find({}, 'email');
    console.log('👥 [SUBSCRIPTION CHECK] Total usuarios encontrados:', allUsers.length);
    
    // Obtener usuarios que ya tienen suscripciones
    const usersWithSubscriptions = await UserSubscription.find({}, 'userEmail');
    const emailsWithSubscriptions = usersWithSubscriptions.map(sub => sub.userEmail);
    
    console.log('📋 [SUBSCRIPTION CHECK] Usuarios con suscripciones:', emailsWithSubscriptions.length);
    
    // Encontrar usuarios sin suscripciones
    const usersWithoutSubscriptions = allUsers.filter(user => 
      !emailsWithSubscriptions.includes(user.email)
    );
    
    console.log('⚠️ [SUBSCRIPTION CHECK] Usuarios SIN suscripciones:', usersWithoutSubscriptions.length);
    
    // Crear suscripciones para usuarios que no las tienen
    for (const user of usersWithoutSubscriptions) {
      await initializeUserSubscriptions(user.email);
      console.log('✅ [SUBSCRIPTION CHECK] Suscripciones creadas para:', user.email);
    }
    
    // Mostrar estadísticas finales
    const finalSubscriptions = await UserSubscription.find({});
    console.log('📊 [SUBSCRIPTION CHECK] Total usuarios con suscripciones después:', finalSubscriptions.length);
    
    // Mostrar ejemplos de suscripciones para debugging
    for (const sub of finalSubscriptions.slice(0, 3)) {
      console.log('📊 [SUBSCRIPTION CHECK] Ejemplo:', sub.userEmail, {
        alertas_trader: sub.subscriptions.alertas_trader,
        alertas_smart: sub.subscriptions.alertas_smart,

        notificaciones_actualizaciones: sub.subscriptions.notificaciones_actualizaciones
      });
    }
    
  } catch (error) {
    console.error('❌ [SUBSCRIPTION CHECK] Error verificando suscripciones:', error);
  }
}

/**
 * Crea notificación automática cuando se procesa un pago exitoso
 */
export async function createPaymentNotification(
  user: any,
  payment: any,
  service: string,
  amount: number,
  currency: string,
  paymentId: string
): Promise<void> {
  try {
    await dbConnect();
    
    console.log('💳 [PAYMENT NOTIFICATION] Iniciando creación de notificación para pago:', paymentId);
    console.log('💳 [PAYMENT NOTIFICATION] Detalles del pago:', {
      user: user.email,
      service,
      amount,
      currency,
      paymentId
    });

    // ✅ NUEVO: Verificar si ya existe una notificación para este pago
    const existingNotification = await Notification.findOne({
      'metadata.paymentId': paymentId,
      'metadata.userEmail': user.email,
      type: 'sistema',
      title: '💳 Pago procesado exitosamente'
    });

    if (existingNotification) {
      console.log(`ℹ️ [PAYMENT NOTIFICATION] Ya existe una notificación para el pago ${paymentId}. Saltando creación.`);
      return;
    }

    // Determinar el tipo de servicio y mensaje apropiado
    let serviceDisplayName = service;
    let actionUrl = '/perfil';
    let actionText = 'Ver Detalles';
    
    if (['TraderCall', 'SmartMoney', 'CashFlow'].includes(service)) {
      serviceDisplayName = service === 'TraderCall' ? 'Trader Call' : 
                          service === 'SmartMoney' ? 'Smart Money' : 'Cash Flow';
      actionUrl = '/alertas';
      actionText = 'Ver Alertas';
    } else if (['SwingTrading', 'DowJones'].includes(service)) {
      serviceDisplayName = service === 'SwingTrading' ? 'Zero 2 Trader' : 'Dow Jones';
      actionUrl = '/entrenamientos';
      actionText = 'Ver Entrenamientos';
    }

    // Crear notificación de pago exitoso
    const notification = {
      title: `💳 Pago procesado exitosamente`,
      message: `Tu suscripción a ${serviceDisplayName} ha sido renovada por $${amount} ${currency}. ¡Ya puedes acceder a todos los beneficios!`,
      type: 'sistema',
      priority: 'alta',
      targetUsers: 'todos', // Se mostrará a todos los usuarios, pero solo el usuario específico la verá
      icon: '💳',
      actionUrl: actionUrl,
      actionText: actionText,
      isActive: true,
      createdBy: 'sistema',
      isAutomatic: true,
      createdAt: new Date(), // ✅ NUEVO: Establecer explícitamente la fecha de creación
      metadata: {
        paymentId: paymentId,
        service: service,
        amount: amount,
        currency: currency,
        userEmail: user.email,
        transactionDate: new Date(),
        automatic: true
      }
    };

    console.log('💳 [PAYMENT NOTIFICATION] Creando notificación global:', {
      title: notification.title,
      targetUsers: notification.targetUsers,
      userEmail: user.email
    });

    // Crear la notificación en la base de datos
    const notificationDoc = new Notification(notification);
    await notificationDoc.save();

    console.log(`✅ [PAYMENT NOTIFICATION] Notificación de pago creada exitosamente: ${notificationDoc._id}`);
    console.log(`📊 [PAYMENT NOTIFICATION] Notificación visible para el usuario: ${user.email}`);

  } catch (error) {
    console.error('❌ [PAYMENT NOTIFICATION] Error creando notificación de pago:', error);
  }
}

/**
 * Función de diagnóstico para verificar el estado del sistema de notificaciones
 */
export async function diagnoseNotificationSystem(): Promise<{
  users: number;
  subscriptions: number;
  templates: number;
  recentNotifications: number;
  alertSubscribers: {
    trader: number;
    smart: number;

  };
}> {
  try {
    await dbConnect();
    
    const [
      totalUsers,
      totalSubscriptions,
      totalTemplates,
      recentNotifications,
      traderSubscribers,
      smartSubscribers,

    ] = await Promise.all([
      User.countDocuments(),
      UserSubscription.countDocuments(),
      NotificationTemplate.countDocuments(),
      Notification.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
      }),
      UserSubscription.countDocuments({ 'subscriptions.alertas_trader': true }),
      UserSubscription.countDocuments({ 'subscriptions.alertas_smart': true }),

    ]);
    
    return {
      users: totalUsers,
      subscriptions: totalSubscriptions,
      templates: totalTemplates,
      recentNotifications,
      alertSubscribers: {
        trader: traderSubscribers,
        smart: smartSubscribers,

      }
    };
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return {
      users: 0,
      subscriptions: 0,
      templates: 0,
      recentNotifications: 0,
      alertSubscribers: { trader: 0, smart: 0 }
    };
  }
} 

export async function notifyAlertSubscribers(
  alert: IAlert,
  options: { message?: string; imageUrl?: string; price?: number; title?: string; action?: 'BUY' | 'SELL'; priceRange?: { min: number; max: number }; liquidityPercentage?: number; soldPercentage?: number; profitPercentage?: number; profitLoss?: number; skipDuplicateCheck?: boolean }
): Promise<void> {
  // Reutilizamos createAlertNotification pero permitimos sobreescribir título si llega
  // Si llega title, lo aplicamos después de crear notificationDoc
  // ✅ NUEVO: Soporta skipDuplicateCheck para notificaciones de venta automática
  await createAlertNotification(alert, {
    message: options.message,
    imageUrl: options.imageUrl,
    price: options.price,
    action: options.action,
    title: options.title,
    priceRange: options.priceRange,
    liquidityPercentage: options.liquidityPercentage,
    soldPercentage: options.soldPercentage,
    profitPercentage: options.profitPercentage,
    profitLoss: options.profitLoss,
    skipDuplicateCheck: options.skipDuplicateCheck || true // ✅ Por defecto true para ventas
  });
} 