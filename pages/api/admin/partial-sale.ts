import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/googleAuth';
import dbConnect from '../../../lib/mongodb';
import Alert from '../../../models/Alert';
import User from '../../../models/User';
import Liquidity from '../../../models/Liquidity';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // Verificar si el usuario es admin directamente desde la base de datos
  let user;
  try {
    user = await User.findOne({ email: session.user.email });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado - Se requieren permisos de administrador' });
    }
  } catch (error) {
    console.error('Error checking admin role:', error);
    return res.status(500).json({ error: 'Error verificando permisos' });
  }

  const { alertId, percentage, priceRange, currentPrice, tipo, emailMessage, emailImageUrl } = req.body;

  // Log de debugging para identificar el problema
  console.log('🔍 [PARTIAL SALE DEBUG] Datos recibidos:', {
    alertId: alertId ? 'presente' : 'faltante',
    percentage: percentage,
    priceRange: priceRange ? 'presente' : 'faltante',
    currentPrice: currentPrice ? 'presente' : 'faltante',
    tipo: tipo,
    emailMessage: emailMessage ? 'presente' : 'faltante',
    emailImageUrl: emailImageUrl ? 'presente' : 'faltante'
  });

  // Validar parámetros requeridos
  if (!alertId || !percentage || !tipo) {
    console.log('❌ [PARTIAL SALE DEBUG] Validación fallida:', {
      alertId: !!alertId,
      percentage: percentage,
      tipo: tipo
    });
    return res.status(400).json({ error: 'Faltan datos requeridos: alertId, percentage, tipo' });
  }

  // Validar porcentaje
  if (percentage < 1 || percentage > 100) {
    console.log('❌ [PARTIAL SALE DEBUG] Porcentaje inválido:', percentage);
    return res.status(400).json({ error: 'Porcentaje debe estar entre 1 y 100' });
  }

  // ✅ CORRECCIÓN: Siempre usar el precio actual real de la alerta para el cálculo
  // El rango solo se usa para la notificación a los usuarios
  let sellPrice: number;
  let notificationPriceRange = null;
  
  console.log('🔍 [PARTIAL SALE DEBUG] Validando precios:', {
    priceRange: priceRange,
    currentPrice: currentPrice
  });
  
  // Primero intentar obtener el precio actual de la alerta
  try {
    const alert = await Alert.findById(alertId);
    if (alert && alert.currentPrice) {
      // Usar el precio actual real de la alerta para el cálculo
      sellPrice = typeof alert.currentPrice === 'string' 
        ? parseFloat(alert.currentPrice.replace('$', '')) 
        : alert.currentPrice;
      console.log(`💰 Usando precio actual real de la alerta: $${sellPrice}`);
    } else {
      throw new Error('No se pudo obtener precio actual de la alerta');
    }
  } catch (error) {
    console.log('⚠️ No se pudo obtener precio de la alerta, usando fallback');
    
    // Fallback: usar currentPrice si está disponible
    if (currentPrice) {
      sellPrice = typeof currentPrice === 'string' 
        ? parseFloat(currentPrice.replace('$', '')) 
        : currentPrice;
      console.log(`💰 Usando precio actual como fallback: $${sellPrice}`);
    } else {
      console.log('❌ [PARTIAL SALE DEBUG] No hay precio válido disponible');
      return res.status(400).json({ error: 'Se requiere precio actual de la alerta' });
    }
  }

  // Guardar el rango para la notificación (si se proporcionó)
  if (priceRange && priceRange.min && priceRange.max) {
    notificationPriceRange = {
      min: parseFloat(priceRange.min),
      max: parseFloat(priceRange.max)
    };
    console.log(`📊 Rango para notificación: $${notificationPriceRange.min} - $${notificationPriceRange.max}`);
  }

  // Validar que el precio es válido
  if (isNaN(sellPrice) || sellPrice <= 0) {
    console.log('❌ [PARTIAL SALE DEBUG] Precio de venta inválido:', sellPrice);
    return res.status(400).json({ error: 'Precio de venta inválido' });
  }

  try {
    console.log(`💰 Ejecutando venta parcial de ${percentage}% para alerta:`, alertId);

    // Buscar la alerta (ya la buscamos antes, pero la buscamos nuevamente para asegurar consistencia)
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alerta no encontrada' });
    }

    // Verificar que la alerta esté activa
    if (alert.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'La alerta no está activa' });
    }

    console.log(`📊 Alerta encontrada: ${alert.symbol}, precio actual: $${alert.currentPrice}, precio entrada: $${alert.entryPrice}`);

    // Calcular los valores de la venta parcial
    // Manejar diferentes formatos de precio de entrada
    let entryPrice: number;
    
    console.log('🔍 [PARTIAL SALE DEBUG] Validando entryPrice:', {
      entryPrice: alert.entryPrice,
      type: typeof alert.entryPrice,
      isNull: alert.entryPrice === null,
      isUndefined: alert.entryPrice === undefined
    });
    
    if (typeof alert.entryPrice === 'string') {
      entryPrice = parseFloat(alert.entryPrice.replace('$', ''));
      console.log(`💰 EntryPrice parseado desde string: $${entryPrice}`);
    } else if (typeof alert.entryPrice === 'number') {
      entryPrice = alert.entryPrice;
      console.log(`💰 EntryPrice como número: $${entryPrice}`);
    } else if (alert.entryPrice === null || alert.entryPrice === undefined) {
      console.log('⚠️ EntryPrice es null/undefined, usando precio actual como fallback');
      entryPrice = sellPrice; // Usar el precio actual como fallback
    } else {
      console.log('❌ [PARTIAL SALE DEBUG] EntryPrice inválido:', alert.entryPrice);
      return res.status(400).json({ error: 'Precio de entrada inválido' });
    }

    // Validar que los precios son números válidos
    if (isNaN(entryPrice) || isNaN(sellPrice)) {
      console.log('❌ [PARTIAL SALE DEBUG] Precios inválidos:', { entryPrice, sellPrice });
      return res.status(400).json({ error: 'Precios inválidos para el cálculo' });
    }
    
    console.log(`✅ Precios validados - Entry: $${entryPrice}, Sell: $${sellPrice}`);
    
    // Calcular ganancia/pérdida por acción
    const profitPerShare = sellPrice - entryPrice;
    
    // Obtener información de liquidez actual
    const liquidityData = alert.liquidityData || {};
    let allocatedAmount = liquidityData.allocatedAmount || 0;
    let shares = liquidityData.shares || 0;
    
    // Si no hay liquidez asignada, buscar directamente en la base de datos
    if (allocatedAmount === 0 && shares === 0) {
      try {
        console.log(`🔍 Buscando liquidez para alerta ${alertId} (${alert.symbol}) en pool ${tipo}`);
        
        // Buscar directamente en la base de datos sin fetch interno
        const liquidity = await Liquidity.findOne({ 
          createdBy: user._id, 
          pool: tipo 
        });
        
        if (liquidity && liquidity.distributions) {
          // Buscar la distribución específica para esta alerta
          const alertDistribution = liquidity.distributions.find(
            (d: any) => d.alertId.toString() === alertId.toString()
          );
          
          if (alertDistribution) {
            allocatedAmount = alertDistribution.allocatedAmount || 0;
            // ✅ USAR ACCIONES CON DECIMALES para evitar pérdidas
            shares = allocatedAmount / entryPrice; // Sin Math.floor()
            
            console.log(`📊 Liquidez encontrada para alerta ${alertId} (${alert.symbol}): $${allocatedAmount}, ${shares.toFixed(4)} acciones calculadas`);
            console.log(`🔢 Cálculo: $${allocatedAmount} ÷ $${entryPrice} = ${shares.toFixed(4)} acciones`);
          } else {
            console.log(`⚠️ No se encontró distribución de liquidez para alerta ${alertId} (${alert.symbol})`);
            console.log(`📋 Distribuciones disponibles:`, liquidity.distributions.map((d: any) => ({ alertId: d.alertId, symbol: d.symbol })));
            
            // ✅ NUEVO: Buscar el portfolioPercentage en la operación de COMPRA
            try {
              const Operation = (await import('@/models/Operation')).default;
              const buyOperation = await Operation.findOne({
                alertId: alertId,
                operationType: 'COMPRA',
                system: tipo
              }).sort({ date: -1 });
              
              if (buyOperation && buyOperation.portfolioPercentage > 0) {
                // Calcular allocatedAmount basándose en el porcentaje del pool
                const poolBalance = liquidity.currentBalance || liquidity.totalBalance || 1000;
                allocatedAmount = poolBalance * (buyOperation.portfolioPercentage / 100);
                shares = allocatedAmount / entryPrice;
                
                console.log(`📊 Usando portfolioPercentage de operación de COMPRA: ${buyOperation.portfolioPercentage}%`);
                console.log(`📊 Balance del pool: $${poolBalance}, Liquidez calculada: $${allocatedAmount.toFixed(2)}, ${shares.toFixed(4)} acciones`);
              }
            } catch (opError) {
              console.log('⚠️ Error buscando operación de compra:', opError);
            }
          }
        } else {
          console.log(`⚠️ No se encontró documento de liquidez para usuario ${user._id} en pool ${tipo}`);
          
          // ✅ NUEVO: Buscar en operaciones incluso si no hay documento de liquidez
          try {
            const Operation = (await import('@/models/Operation')).default;
            const buyOperation = await Operation.findOne({
              alertId: alertId,
              operationType: 'COMPRA',
              system: tipo
            }).sort({ date: -1 });
            
            if (buyOperation && buyOperation.portfolioPercentage > 0) {
              // Buscar el balance total del pool desde la última operación
              const lastOperation = await Operation.findOne({ system: tipo })
                .sort({ date: -1 })
                .select('balance');
              const poolBalance = lastOperation?.balance || 1000;
              
              allocatedAmount = poolBalance * (buyOperation.portfolioPercentage / 100);
              shares = allocatedAmount / entryPrice;
              
              console.log(`📊 Usando portfolioPercentage de operación de COMPRA: ${buyOperation.portfolioPercentage}%`);
              console.log(`📊 Balance del pool (última op): $${poolBalance}, Liquidez calculada: $${allocatedAmount.toFixed(2)}, ${shares.toFixed(4)} acciones`);
            }
          } catch (opError) {
            console.log('⚠️ Error buscando operación de compra:', opError);
          }
        }
      } catch (error) {
        console.log('⚠️ Error obteniendo liquidez de la base de datos:', error);
      }
      
      // Si aún no hay liquidez, usar un monto por defecto basado en el precio
      if (allocatedAmount === 0) {
        console.log(`⚠️ No se pudo determinar liquidez para ${alert.symbol} - verificar operación de compra o distribución`);
        allocatedAmount = 100; // $100 por defecto (valor bajo para evitar errores grandes)
        shares = allocatedAmount / entryPrice;
        console.log(`💡 Usando liquidez mínima por defecto: $${allocatedAmount}, ${shares.toFixed(4)} acciones`);
      }
    }
    
    console.log(`📊 Liquidez para cálculo: $${allocatedAmount}, ${shares} acciones, precio entrada: $${entryPrice}`);
    
    // Validar que tenemos datos suficientes para el cálculo
    if (shares === 0) {
      return res.status(400).json({ error: 'No hay acciones suficientes para realizar venta parcial' });
    }
    
    // ✅ NUEVO: Lógica de venta mejorada - vender posiciones completas
    let sharesToSell: number;
    let sharesRemaining: number;
    let isCompleteSale = false;
    
    if (percentage >= 100) {
      // Venta completa - vender todas las acciones
      sharesToSell = shares;
      sharesRemaining = 0;
      isCompleteSale = true;
      console.log(`💰 Venta COMPLETA (${percentage}%): Vendiendo todas las acciones`);
    } else {
      // ✅ NUEVO: Para ventas parciales, calcular basándose en la posición original
      // No en las acciones actuales (evita ventas compuestas)
      const originalShares = alert.liquidityData?.originalShares || shares;
      sharesToSell = originalShares * (percentage / 100);
      
      // Asegurar que no vendamos más de lo que tenemos
      if (sharesToSell > shares) {
        sharesToSell = shares;
        isCompleteSale = true;
        console.log(`💰 Ajustando a venta completa: solo tenemos ${shares.toFixed(4)} acciones`);
      }
      
      sharesRemaining = shares - sharesToSell;
    }
    
    // ✅ CORREGIDO: Calcular liquidez liberada basándose en la liquidez ORIGINAL, no la actual
    // Usar el monto original si existe, sino el actual
    const originalAllocatedAmount = alert.liquidityData?.originalAllocatedAmount || allocatedAmount;
    const originalShares = alert.liquidityData?.originalShares || shares;
    
    // La liquidez liberada es el porcentaje vendido del ORIGINAL
    const liquidityReleased = originalAllocatedAmount * (percentage / 100);
    
    // El valor de mercado es lo que valen las acciones vendidas al precio de venta
    const marketValue = sharesToSell * sellPrice;
    
    // La ganancia realizada es la diferencia entre el valor de mercado y la liquidez liberada
    const realizedProfit = marketValue - liquidityReleased;
    
    // ✅ NUEVO: Calcular el porcentaje que QUEDARÁ después de la venta
    const currentParticipation = alert.participationPercentage ?? 100;
    const newParticipation = isCompleteSale ? 0 : Math.max(0, currentParticipation - percentage);
    
    console.log(`💰 Venta ${isCompleteSale ? 'COMPLETA' : 'PARCIAL'} ${percentage}%:`);
    console.log(`📊 Participación actual: ${currentParticipation}%`);
    console.log(`📊 Participación después de venta: ${newParticipation}%`);
    console.log(`📊 Acciones totales actuales: ${shares.toFixed(4)}`);
    console.log(`🔄 Acciones a vender: ${sharesToSell.toFixed(4)} (${percentage}% del original)`);
    console.log(`📈 Acciones restantes: ${sharesRemaining.toFixed(4)}`);
    console.log(`💵 Liquidez original: $${originalAllocatedAmount.toFixed(2)}`);
    console.log(`💵 Liquidez liberada: $${liquidityReleased.toFixed(2)} (${percentage}% del original)`);
    console.log(`💰 Valor de mercado: $${marketValue.toFixed(2)}`);
    console.log(`📈 Ganancia realizada: $${realizedProfit.toFixed(2)}`);
    
    // ✅ NUEVO: Calcular newAllocatedAmount antes del if/else para que esté disponible en ambos casos
    const newAllocatedAmount = sharesRemaining * entryPrice;
    
    // ✅ CORREGIDO: Si hay rango de venta, SIEMPRE programar (incluyendo 100%)
    // La venta se ejecutará cuando el CRON detecte que el precio está en el rango
    const hasSellRange = notificationPriceRange && notificationPriceRange.min && notificationPriceRange.max;
    
    if (hasSellRange && notificationPriceRange) {
      // ✅ NO descontar participación todavía - se descontará cuando se ejecute la venta
      // ✅ PROGRAMAR VENTA: Guardar el rango de venta y los datos de la venta programada
      alert.sellRangeMin = notificationPriceRange.min;
      alert.sellRangeMax = notificationPriceRange.max;
      console.log(`📅 VENTA PROGRAMADA: Guardando rango de venta en alerta: $${notificationPriceRange.min} - $${notificationPriceRange.max}`);
      console.log(`⏳ La venta se ejecutará automáticamente cuando el precio llegue al rango (CRON: auto-convert-ranges)`);
      
      // ✅ NUEVO: Guardar información de venta programada (NO ejecutada)
      // NO modificar allocatedAmount ni shares todavía - se mantienen iguales
      alert.liquidityData = {
        ...liquidityData,
        allocatedAmount: allocatedAmount, // Mantener la liquidez asignada
        shares: shares, // Mantener todas las acciones
        // Guardar el monto original para referencia (importante para ventas futuras)
        originalAllocatedAmount: liquidityData.originalAllocatedAmount || allocatedAmount,
        originalShares: liquidityData.originalShares || (liquidityData.shares || shares),
        // Guardar el porcentaje de participación original
        originalParticipationPercentage: alert.originalParticipationPercentage || 100,
        partialSales: [
          ...(liquidityData.partialSales || []),
          {
            date: new Date(),
            percentage: percentage,
            sharesToSell: sharesToSell,
            sellPrice: sellPrice, // Precio estimado, se usará el precio real cuando se ejecute
            liquidityReleased: liquidityReleased, // Estimado, se calculará cuando se ejecute
            realizedProfit: realizedProfit, // Estimado, se calculará cuando se ejecute
            executedBy: session.user.email,
            priceRange: notificationPriceRange,
            emailMessage: emailMessage || null,
            emailImageUrl: emailImageUrl || null,
            isCompleteSale: isCompleteSale,
            executed: false, // ✅ NUEVO: Marcar como NO ejecutada
            scheduledAt: new Date() // ✅ NUEVO: Fecha de programación
          }
        ]
      };
      
      // ✅ NO cerrar la alerta ni modificar participación - se mantiene activa
      console.log(`✅ Venta programada: La alerta seguirá visible hasta que se ejecute la venta en el rango`);
      console.log(`💰 Liquidez NO liberada todavía - se liberará cuando se ejecute la venta en auto-convert-ranges`);
      
      // ✅ NUEVO: Enviar email inmediatamente cuando se programa la venta (no esperar al cierre)
      try {
        console.log(`📧 Enviando email de VENTA PROGRAMADA para alerta ${alert.symbol}...`);
        
        // Construir el mensaje de notificación
        const notificationMessage = emailMessage || 
          `Venta programada para ${alert.symbol}: Se venderá el ${percentage}% de la posición cuando el precio llegue al rango de $${notificationPriceRange.min} a $${notificationPriceRange.max}. ` +
          `La venta se ejecutará automáticamente cuando el precio esté en el rango.`;
        
        // Importar y usar la función de notificaciones
        const { notifyAlertSubscribers } = await import('../../../lib/notificationUtils');
        
        // Enviar notificación usando el sistema existente
        await notifyAlertSubscribers(alert, {
          message: notificationMessage,
          imageUrl: emailImageUrl || undefined,
          title: `📅 Venta Programada - ${alert.symbol}`,
          action: 'SELL', // ✅ Asegurar que sea SELL
          priceRange: notificationPriceRange,
          soldPercentage: percentage // ✅ Pasar el porcentaje vendido
        });
        
        console.log(`✅ Email de venta programada enviado exitosamente para ${alert.symbol}`);
      } catch (emailError) {
        console.log('⚠️ Error enviando email de venta programada:', emailError);
        // No fallar la operación por un error de email
      }
      
      // ✅ CRÍTICO: Guardar la alerta con los datos de la venta programada
      await alert.save();
      console.log(`💾 Venta programada guardada en base de datos para ${alert.symbol}`);
      
    } else {
      // ✅ EJECUTAR VENTA INMEDIATAMENTE: Solo cuando NO hay rango de precios
      console.log(`💰 Ejecutando venta INMEDIATA (sin rango de precios)`);
      
      // ✅ CORREGIDO: Actualizar el porcentaje de participación basándose en el ACTUAL, no el original
      if (isCompleteSale) {
        alert.participationPercentage = 0;
      } else {
        // Para ventas parciales, reducir el porcentaje basándose en la posición ACTUAL
        const currentPercentage = alert.participationPercentage ?? 100;
        const newParticipationPercentage = Math.max(0, currentPercentage - percentage);
        alert.participationPercentage = newParticipationPercentage;
      }
      console.log(`📊 Porcentaje de participación actualizado: ${alert.participationPercentage}%`);
      
      // ✅ NUEVO: Calcular ganancia porcentual simple y agregar a ventasParciales
      const entryPrice = alert.entryPrice || 0;
      let gananciaPorcentual = 0;
      if (entryPrice > 0) {
        gananciaPorcentual = ((sellPrice - entryPrice) / entryPrice) * 100;
      }
      
      // Actualizar ventasParciales en la alerta
      if (!alert.ventasParciales) {
        alert.ventasParciales = [];
      }
      alert.ventasParciales.push({
        fecha: new Date(),
        precio: sellPrice,
        porcentajeVendido: percentage,
        gananciaRealizada: gananciaPorcentual, // ✅ Ganancia porcentual simple
        sharesVendidos: sharesToSell
      });
      
      // ✅ NUEVO: Guardar información de liquidez mejorada
      alert.liquidityData = {
        ...liquidityData,
        allocatedAmount: newAllocatedAmount,
        shares: sharesRemaining,
        // Guardar el monto original para referencia (importante para ventas futuras)
        originalAllocatedAmount: liquidityData.originalAllocatedAmount || allocatedAmount,
        originalShares: liquidityData.originalShares || (liquidityData.shares || shares),
        // Guardar el porcentaje de participación original
        originalParticipationPercentage: alert.originalParticipationPercentage || 100,
        partialSales: [
          ...(liquidityData.partialSales || []),
          {
            date: new Date(),
            percentage: percentage,
            sharesToSell: sharesToSell,
            sellPrice: sellPrice,
            liquidityReleased: liquidityReleased,
            realizedProfit: realizedProfit,
            executedBy: session.user.email,
            priceRange: null,
            emailMessage: emailMessage || null,
            emailImageUrl: emailImageUrl || null,
            isCompleteSale: isCompleteSale,
            executed: true, // ✅ Ejecutada inmediatamente
            executedAt: new Date() // ✅ Fecha de ejecución
          }
        ]
      };

      // Si se vendió todo (100% o situación similar), cerrar la alerta
      if (sharesRemaining <= 0 || alert.participationPercentage <= 0) {
        alert.status = 'CLOSED';
        alert.exitPrice = sellPrice; // Usar el valor numérico, no el string
        alert.exitDate = new Date();
        alert.exitReason = 'MANUAL';
        alert.participationPercentage = 0; // Asegurar que esté en 0
        console.log(`🔒 Alerta cerrada completamente - participación: ${alert.participationPercentage}%`);
      }
    }

    await alert.save();

    // ✅ ACTUALIZAR EL SISTEMA DE LIQUIDEZ SOLO SI NO HAY RANGO (venta inmediata)
    if (!hasSellRange) {
      // ✅ ACTUALIZAR EL SISTEMA DE LIQUIDEZ DIRECTAMENTE
      try {
        console.log(`🔄 Actualizando sistema de liquidez para ${tipo}...`);
        
        // Buscar directamente en la base de datos
        const liquidity = await Liquidity.findOne({ 
          createdBy: user._id, 
          pool: tipo 
        });
        
        if (liquidity && liquidity.distributions) {
          // Encontrar y actualizar la distribución correspondiente
          const distributionIndex = liquidity.distributions.findIndex(
            (d: any) => d.alertId.toString() === alertId.toString()
          );
          
          if (distributionIndex !== -1) {
            console.log(`📝 Actualizando distribución en índice ${distributionIndex}`);
            
            // ✅ NUEVO: Actualizar la distribución usando el método sellShares del modelo
            const { realized, returnedCash, remainingShares } = liquidity.sellShares(alertId, sharesToSell, sellPrice);
            
            console.log(`📊 Venta ejecutada en sistema de liquidez:`);
            console.log(`💰 Ganancia realizada: $${realized.toFixed(2)}`);
            console.log(`💵 Efectivo devuelto: $${returnedCash.toFixed(2)}`);
            console.log(`📈 Acciones restantes: ${remainingShares.toFixed(4)}`);
            
            // Si se cerró completamente, remover la distribución
            if (remainingShares <= 0) {
              liquidity.removeDistribution(alertId);
              console.log(`🗑️ Distribución removida - posición cerrada completamente`);
            }

            // ✅ NUEVO: Registrar operación de venta automáticamente
            try {
              const OperationModule = await import('@/models/Operation');
              const Operation = OperationModule.default;
              
              // ✅ CORREGIDO: Buscar usuario admin por rol, no por email
              const adminUser = await User.findOne({ role: 'admin' });
              
              if (!adminUser) {
                console.error('⚠️ No se encontró ningún usuario con rol admin');
                throw new Error('Admin user not found');
              }
              
              // Obtener balance actual del admin para este sistema
              const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: tipo })
                .sort({ date: -1 })
                .select('balance');
              const currentBalance = currentBalanceDoc?.balance || 0;
              const newBalance = currentBalance + liquidityReleased;

              const operation = new Operation({
                ticker: alert.symbol.toUpperCase(),
                operationType: 'VENTA',
                quantity: -sharesToSell, // Negativo para ventas
                price: sellPrice,
                amount: liquidityReleased,
                date: new Date(),
                balance: newBalance,
                alertId: alert._id,
                alertSymbol: alert.symbol.toUpperCase(),
                system: tipo,
                createdBy: adminUser._id, // ✅ CORREGIDO: Usar adminUser._id en lugar de user._id
                isPartialSale: !isCompleteSale,
                partialSalePercentage: percentage,
                originalQuantity: alert.liquidityData?.originalShares || shares,
                liquidityData: {
                  allocatedAmount: newAllocatedAmount,
                  shares: sharesRemaining,
                  entryPrice: entryPrice,
                  realizedProfit: realizedProfit
                },
                executedBy: session.user.email,
                executionMethod: 'ADMIN',
                notes: `Venta ${isCompleteSale ? 'completa' : 'parcial'} (${percentage}%) - ${alert.symbol}`
              });

              await operation.save();
              console.log(`✅ Operación de venta registrada: ${alert.symbol} - ${sharesToSell.toFixed(4)} acciones por $${sellPrice}`);
            } catch (operationError) {
              console.error('⚠️ Error registrando operación de venta:', operationError);
              // No fallar la venta por un error en la operación
            }
            
            // Guardar cambios directamente en la base de datos
            await liquidity.save();
            
            console.log(`✅ Sistema de liquidez actualizado: +$${liquidityReleased.toFixed(2)} liberados`);
            console.log(`💰 Nueva liquidez total: $${liquidity.totalLiquidity.toFixed(2)}`);
          } else {
            console.log(`⚠️ No se encontró distribución para actualizar (alertId: ${alertId})`);
          }
        } else {
          console.log(`⚠️ No se encontró documento de liquidez para actualizar`);
        }
      } catch (error) {
        console.log('⚠️ Error sincronizando con sistema de liquidez:', error);
      }
    }

    // ✅ ENVIAR NOTIFICACIÓN POR EMAIL SI SE ESPECIFICÓ
    if (emailMessage || emailImageUrl) {
      try {
        console.log(`📧 Enviando notificación de venta parcial para alerta ${alert.symbol}...`);
        
        // Construir el mensaje de notificación
        const notificationMessage = emailMessage || 
          `Alerta de venta para ${alert.symbol} en el rango de $${notificationPriceRange?.min || sellPrice} a $${notificationPriceRange?.max || sellPrice}. ` +
          `Se vendió el ${percentage}% de la posición.`;
        
        // Importar y usar la función de notificaciones
        const { notifyAlertSubscribers } = await import('../../../lib/notificationUtils');
        
        // Enviar notificación usando el sistema existente
        await notifyAlertSubscribers(alert, {
          message: notificationMessage,
          imageUrl: emailImageUrl || undefined,
          title: `Venta Parcial - ${alert.symbol}`,
          action: 'SELL',
          priceRange: notificationPriceRange || undefined,
          soldPercentage: percentage // ✅ NUEVO: Pasar el porcentaje vendido
        });
        
        console.log(`✅ Notificación de venta parcial enviada exitosamente para ${alert.symbol}`);
        
      } catch (emailError) {
        console.log('⚠️ Error enviando notificación por email:', emailError);
        // No fallar la operación por un error de email
      }
    }

    console.log(`✅ Venta parcial de ${percentage}% ejecutada exitosamente`);
    console.log(`💰 Liquidez liberada: $${liquidityReleased.toFixed(2)}`);
    console.log(`📊 Acciones restantes: ${sharesRemaining}`);
    console.log(`💵 Ganancia realizada: $${realizedProfit.toFixed(2)}`);

    return res.status(200).json({
      success: true,
      message: `Venta parcial de ${percentage}% ejecutada exitosamente`,
      liquidityReleased: liquidityReleased,
      realizedProfit: realizedProfit,
      sharesRemaining: sharesRemaining,
      sharesToSell: sharesToSell,
      newAllocatedAmount: newAllocatedAmount,
      alertStatus: alert.status,
      priceRange: notificationPriceRange,
      sellPrice: sellPrice,
      // ✅ CORREGIDO: Devolver el porcentaje que QUEDARÁ después de la venta
      participationPercentage: newParticipation,
      originalParticipationPercentage: alert.originalParticipationPercentage || 100,
      previousParticipation: currentParticipation
    });

  } catch (error) {
    console.error('❌ Error ejecutando venta parcial:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
