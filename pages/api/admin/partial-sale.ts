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
    // ✅ CORREGIDO: Asegurar que los valores no sean negativos
    let allocatedAmount = Math.max(0, liquidityData.allocatedAmount || 0);
    let shares = Math.max(0, liquidityData.shares || 0);
    
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
                // ✅ CORREGIDO: Usar totalLiquidity del documento de Liquidity (fuente confiable)
                // totalLiquidity = initialLiquidity + totalProfitLoss
                const poolBalance = liquidity.totalLiquidity > 0 ? liquidity.totalLiquidity : (liquidity.initialLiquidity || 1000);
                allocatedAmount = poolBalance * (buyOperation.portfolioPercentage / 100);
                shares = allocatedAmount / entryPrice;
                
                // ✅ CORREGIDO: Asegurar que los valores no sean negativos
                if (allocatedAmount < 0) {
                  allocatedAmount = 100; // Valor mínimo por defecto
                  shares = allocatedAmount / entryPrice;
                  console.log(`⚠️ Valores negativos detectados, usando valor mínimo por defecto`);
                }
                
                console.log(`📊 Usando portfolioPercentage de operación de COMPRA: ${buyOperation.portfolioPercentage}%`);
                console.log(`📊 Liquidez total del pool: $${poolBalance.toFixed(2)}, Liquidez calculada: $${allocatedAmount.toFixed(2)}, ${shares.toFixed(4)} acciones`);
              }
            } catch (opError) {
              console.log('⚠️ Error buscando operación de compra:', opError);
            }
          }
        } else {
          console.log(`⚠️ No se encontró documento de liquidez para usuario ${user._id} en pool ${tipo}`);
          
          // ✅ CORREGIDO: Buscar documento de Liquidity del pool completo (no solo del usuario)
          // Esto es más confiable que usar el balance de Operation
          try {
            const poolLiquidity = await Liquidity.findOne({ pool: tipo })
              .sort({ updatedAt: -1, createdAt: -1 }); // El más reciente
            
            if (poolLiquidity && poolLiquidity.totalLiquidity > 0) {
              console.log(`📊 Documento de liquidez del pool encontrado: totalLiquidity = $${poolLiquidity.totalLiquidity.toFixed(2)}`);
              
              const Operation = (await import('@/models/Operation')).default;
              const buyOperation = await Operation.findOne({
                alertId: alertId,
                operationType: 'COMPRA',
                system: tipo
              }).sort({ date: -1 });
              
              if (buyOperation && buyOperation.portfolioPercentage > 0) {
                // ✅ CORREGIDO: Usar totalLiquidity del documento de Liquidity (fuente confiable)
                const poolBalance = poolLiquidity.totalLiquidity;
                
                allocatedAmount = poolBalance * (buyOperation.portfolioPercentage / 100);
                shares = allocatedAmount / entryPrice;
                
                console.log(`📊 Usando portfolioPercentage de operación de COMPRA: ${buyOperation.portfolioPercentage}%`);
                console.log(`📊 Liquidez total del pool: $${poolBalance.toFixed(2)}, Liquidez calculada: $${allocatedAmount.toFixed(2)}, ${shares.toFixed(4)} acciones`);
              }
            } else {
              // ✅ ÚLTIMO RECURSO: Solo si no hay documento de Liquidity, usar balance de Operation
              console.log(`⚠️ No se encontró documento de liquidez del pool, usando balance de operaciones como fallback`);
              
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
                
                // ✅ CORREGIDO: Validar que el balance no sea negativo, usar liquidez inicial si está disponible
                let validPoolBalance = poolBalance > 0 ? poolBalance : 1000;
                
                // Si el balance es negativo, intentar obtener la liquidez inicial del pool
                if (poolBalance <= 0 && poolLiquidity) {
                  validPoolBalance = poolLiquidity.initialLiquidity || 1000;
                  console.log(`⚠️ Balance negativo detectado (${poolBalance}), usando liquidez inicial: $${validPoolBalance}`);
                }
                
                allocatedAmount = validPoolBalance * (buyOperation.portfolioPercentage / 100);
                shares = allocatedAmount / entryPrice;
                
                // ✅ CORREGIDO: Asegurar que los valores no sean negativos
                if (allocatedAmount < 0) {
                  allocatedAmount = 100; // Valor mínimo por defecto
                  shares = allocatedAmount / entryPrice;
                  console.log(`⚠️ Valores negativos detectados, usando valor mínimo por defecto`);
                }
                
                console.log(`📊 Usando portfolioPercentage de operación de COMPRA: ${buyOperation.portfolioPercentage}%`);
                console.log(`📊 Balance del pool (última op): $${poolBalance}, Balance válido: $${validPoolBalance}, Liquidez calculada: $${allocatedAmount.toFixed(2)}, ${shares.toFixed(4)} acciones`);
              }
            }
          } catch (opError) {
            console.log('⚠️ Error buscando liquidez del pool o operación de compra:', opError);
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
    
    // ✅ CORREGIDO: Validar que tenemos datos suficientes y que no sean negativos
    if (shares <= 0 || allocatedAmount <= 0) {
      console.log(`⚠️ Valores inválidos detectados: shares=${shares}, allocatedAmount=${allocatedAmount}`);
      // Si los valores son negativos o cero, usar valores por defecto mínimos
      if (allocatedAmount <= 0) {
        allocatedAmount = 100; // $100 por defecto
        shares = allocatedAmount / entryPrice;
        console.log(`💡 Usando valores por defecto: $${allocatedAmount}, ${shares.toFixed(4)} acciones`);
      } else {
        return res.status(400).json({ error: 'No hay acciones suficientes para realizar venta parcial' });
      }
    }
    
    // ✅ CRÍTICO CORREGIDO: Obtener acciones ORIGINALES para calcular el porcentaje correcto
    // El porcentaje se refiere a la posición ORIGINAL, no a la posición actual
    // Ejemplo: Si originalmente había 100 acciones (100%) y queremos vender 50%, debemos vender 50 acciones
    // NO 50% de las acciones actuales (que podrían ser menos si ya hubo ventas previas)
    const originalParticipation = alert.originalParticipationPercentage || alert.participationPercentage || 100;
    const currentParticipation = alert.participationPercentage ?? originalParticipation;
    
    // Obtener acciones originales: si existen en liquidityData, usarlas; sino, calcularlas desde la participación
    let originalShares: number;
    let originalAllocatedAmount: number;
    
    if (liquidityData.originalShares && liquidityData.originalShares > 0) {
      // Si ya tenemos las acciones originales guardadas, usarlas
      originalShares = liquidityData.originalShares;
      originalAllocatedAmount = liquidityData.originalAllocatedAmount || (originalShares * entryPrice);
      console.log(`✅ Usando acciones originales guardadas: ${originalShares.toFixed(4)} acciones`);
    } else {
      // Si no tenemos acciones originales guardadas, calcularlas desde la participación actual
      // Si la participación actual es 100%, entonces las acciones actuales SON las originales
      // Si la participación actual es menor, calcular las originales
      if (currentParticipation >= 99.9) {
        // Participación completa = acciones actuales son las originales
        originalShares = shares;
        originalAllocatedAmount = allocatedAmount;
        console.log(`✅ Participación completa (${currentParticipation}%) - acciones actuales son las originales`);
      } else {
        // Calcular acciones originales desde la participación actual
        // Si tengo 50 acciones y tengo 50% de participación, entonces originalmente tenía 100 acciones
        originalShares = shares / (currentParticipation / 100);
        originalAllocatedAmount = allocatedAmount / (currentParticipation / 100);
        console.log(`✅ Calculando acciones originales: ${shares.toFixed(4)} acciones actuales ÷ ${currentParticipation}% = ${originalShares.toFixed(4)} acciones originales`);
      }
    }
    
    console.log(`🔍 [DEBUG] Participación original: ${originalParticipation}%, Participación actual: ${currentParticipation}%`);
    console.log(`🔍 [DEBUG] Acciones originales: ${originalShares.toFixed(4)}, Acciones actuales: ${shares.toFixed(4)}`);
    
    // ✅ NUEVO: Lógica de venta mejorada - usar acciones ORIGINALES para calcular porcentaje
    let sharesToSell: number;
    let sharesRemaining: number;
    let isCompleteSale = false;
    
    if (percentage >= 100) {
      // Venta completa - vender todas las acciones ACTUALES (las que quedan)
      sharesToSell = shares;
      sharesRemaining = 0;
      isCompleteSale = true;
      console.log(`💰 Venta COMPLETA (${percentage}%): Vendiendo todas las acciones restantes (${shares.toFixed(4)})`);
    } else {
      // ✅ CRÍTICO CORREGIDO: Calcular basándose en las acciones ORIGINALES y el porcentaje solicitado
      // El porcentaje se refiere al porcentaje de la posición ORIGINAL, no de la posición actual
      // Ejemplo: Si originalmente había 100 acciones y queremos vender 50%, vendemos 50 acciones (no 50% de las que quedan)
      const sharesToSellFromOriginal = originalShares * (percentage / 100);
      
      // Pero no podemos vender más acciones de las que tenemos actualmente
      sharesToSell = Math.min(sharesToSellFromOriginal, shares);
      sharesRemaining = shares - sharesToSell;
      
      console.log(`💰 Cálculo de venta parcial:`);
      console.log(`   - Acciones originales: ${originalShares.toFixed(4)}`);
      console.log(`   - Porcentaje solicitado: ${percentage}%`);
      console.log(`   - Acciones a vender (basado en originales): ${sharesToSellFromOriginal.toFixed(4)}`);
      console.log(`   - Acciones disponibles actualmente: ${shares.toFixed(4)}`);
      console.log(`   - Acciones a vender (limitado a disponibles): ${sharesToSell.toFixed(4)}`);
      console.log(`   - Acciones restantes: ${sharesRemaining.toFixed(4)}`);
      
      // Si vendemos todo lo que queda, es venta completa
      if (sharesRemaining <= 0.0001) {
        sharesToSell = shares;
        sharesRemaining = 0;
        isCompleteSale = true;
        console.log(`💰 Ajustando a venta completa: vendiendo todas las acciones restantes`);
      }
      
      // ✅ NUEVO: Validar que el porcentaje calculado sea razonable
      // Si el porcentaje solicitado es mayor que las acciones disponibles, advertir
      if (sharesToSellFromOriginal > shares) {
        const actualPercentageSold = (sharesToSell / originalShares) * 100;
        console.log(`⚠️ ADVERTENCIA: Se solicitó vender ${percentage}% pero solo hay ${((shares / originalShares) * 100).toFixed(2)}% disponible`);
        console.log(`⚠️ Se venderá ${actualPercentageSold.toFixed(2)}% de la posición original (todas las acciones disponibles)`);
      }
    }
    
    // ✅ CORREGIDO: Calcular liquidez liberada basándose en el % de participación actual y precio actual
    // La liquidez liberada = (participationPercentage / 100) * currentPrice * sharesToSell
    // Calcular el valor actual de la posición basado en participationPercentage y precio actual
    // Si participationPercentage es 50%, significa que tenemos el 50% de la posición original
    // La liquidez liberada debe ser proporcional al valor actual de esa porción vendida
    const liquidityReleased = (currentParticipation / 100) * sellPrice * sharesToSell;
    
    // El valor de mercado es lo que valen las acciones vendidas al precio de venta
    const marketValue = sharesToSell * sellPrice;
    
    // La ganancia realizada es la diferencia entre el valor de mercado y la liquidez liberada
    // Nota: En este caso, como usamos el precio actual, la ganancia puede ser diferente
    const realizedProfit = marketValue - liquidityReleased;
    
    // ✅ CRÍTICO CORREGIDO: Calcular el porcentaje que QUEDARÁ después de la venta
    // El porcentaje debe calcularse basándose en las acciones ORIGINALES, no en la participación actual
    // Ejemplo: Si originalmente había 100% (100 acciones) y vendemos 50 acciones, quedan 50% (no 100% - 50% = 50%)
    const actualPercentageSold = originalShares > 0 ? (sharesToSell / originalShares) * 100 : 0;
    let newParticipation = isCompleteSale ? 0 : Math.max(0, originalParticipation - actualPercentageSold);
    
    console.log(`📊 Cálculo de participación:`);
    console.log(`   - Participación original: ${originalParticipation}%`);
    console.log(`   - Acciones vendidas: ${sharesToSell.toFixed(4)} de ${originalShares.toFixed(4)} originales`);
    console.log(`   - Porcentaje realmente vendido: ${actualPercentageSold.toFixed(2)}%`);
    console.log(`   - Nueva participación: ${newParticipation.toFixed(2)}%`);
    
    // ✅ NUEVO: Si la participación restante es muy baja (< 5%), considerar como venta completa
    // Esto evita dejar posiciones residuales muy pequeñas que no tienen sentido práctico
    const MIN_PARTICIPATION_THRESHOLD = 5; // Umbral mínimo de participación (5%)
    if (!isCompleteSale && newParticipation > 0 && newParticipation < MIN_PARTICIPATION_THRESHOLD) {
      console.log(`⚠️ Participación restante muy baja (${newParticipation.toFixed(2)}% < ${MIN_PARTICIPATION_THRESHOLD}%) - Marcando como venta completa`);
      isCompleteSale = true;
      newParticipation = 0;
      // Ajustar sharesToSell y sharesRemaining para reflejar venta completa
      sharesToSell = shares;
      sharesRemaining = 0;
    }
    
    console.log(`💰 Venta ${isCompleteSale ? 'COMPLETA' : 'PARCIAL'} ${percentage}%:`);
    console.log(`📊 Participación actual: ${currentParticipation}%`);
    console.log(`📊 Participación después de venta: ${newParticipation}%`);
    console.log(`📊 Acciones totales: ${shares.toFixed(4)}`);
    console.log(`🔄 Acciones a vender: ${sharesToSell.toFixed(4)}`);
    console.log(`📈 Acciones restantes: ${sharesRemaining.toFixed(4)}`);
    console.log(`💵 Liquidez asignada: $${allocatedAmount.toFixed(2)}`);
    console.log(`💵 Liquidez a liberar: $${liquidityReleased.toFixed(2)}`);
    console.log(`💰 Valor de mercado: $${marketValue.toFixed(2)}`);
    console.log(`📈 Ganancia realizada: $${realizedProfit.toFixed(2)}`);
    
    // ✅ NUEVO: Calcular newAllocatedAmount antes del if/else para que esté disponible en ambos casos
    // ✅ CORREGIDO: Asegurar que no sea negativo
    const newAllocatedAmount = Math.max(0, sharesRemaining * entryPrice);
    const validSharesRemaining = Math.max(0, sharesRemaining);
    
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
      // ✅ CRÍTICO CORREGIDO: Usar los valores calculados arriba de originalShares y originalAllocatedAmount
      const finalOriginalShares = Math.max(0, liquidityData.originalShares || originalShares);
      const finalOriginalAllocated = Math.max(0, liquidityData.originalAllocatedAmount || originalAllocatedAmount);
      
      alert.liquidityData = {
        ...liquidityData,
        allocatedAmount: Math.max(0, allocatedAmount), // ✅ CORREGIDO: Asegurar que no sea negativo
        shares: Math.max(0, shares), // ✅ CORREGIDO: Asegurar que no sea negativo
        // ✅ CRÍTICO CORREGIDO: Usar valores calculados arriba, no valores incorrectos viejos
        originalAllocatedAmount: finalOriginalAllocated,
        originalShares: finalOriginalShares,
        // Guardar el porcentaje de participación original
        originalParticipationPercentage: alert.originalParticipationPercentage || originalParticipation,
        partialSales: [
          ...(liquidityData.partialSales || []),
          {
            date: new Date(),
            percentage: actualPercentageSold, // ✅ CORREGIDO: Guardar porcentaje realmente vendido
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
        
        // ✅ NUEVO: Calcular P&L aproximado para venta programada basado en el precio actual
        let profitPercentageAprox: number | undefined = undefined;
        if (entryPrice > 0 && sellPrice > 0) {
          profitPercentageAprox = ((sellPrice - entryPrice) / entryPrice) * 100;
        }
        
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
          soldPercentage: percentage, // ✅ Pasar el porcentaje vendido
          profitPercentage: profitPercentageAprox, // ✅ NUEVO: P&L aproximado basado en precio actual
          isExecutedSale: false, // ✅ NUEVO: Es venta PROGRAMADA (no ejecutada todavía)
          isCompleteSale: isCompleteSale // ✅ NUEVO: Indicar si es venta total o parcial
        });
        
        console.log(`✅ Email de venta programada enviado exitosamente para ${alert.symbol}`);
      } catch (emailError) {
        console.log('⚠️ Error enviando email de venta programada:', emailError);
        // No fallar la operación por un error de email
      }
      
      // ✅ CRÍTICO: Guardar la alerta con los datos de la venta programada
      await alert.save();
      console.log(`💾 Venta programada guardada en base de datos para ${alert.symbol}`);
      
      // ✅ NUEVO: Crear operación de VENTA con isPriceConfirmed: false para que aparezca en la tabla de operaciones
      try {
        console.log(`📝 Creando operación de venta programada (A confirmar) para ${alert.symbol}...`);
        
        const OperationModule = await import('@/models/Operation');
        const Operation = OperationModule.default;
        
        // Buscar usuario admin
        const adminUser = await User.findOne({ role: 'admin' });
        
        if (adminUser) {
          // ✅ NUEVO: Verificar si ya existe una operación de VENTA pendiente para evitar duplicados
          const existingPendingOp = await Operation.findOne({
            alertId: alert._id,
            operationType: 'VENTA',
            system: tipo,
            isPriceConfirmed: false,
            priceRange: { $exists: true }
          });
          
          if (existingPendingOp) {
            console.log(`⚠️ Ya existe una operación de venta pendiente para ${alert.symbol}, actualizando...`);
            
            // Actualizar la operación existente en lugar de crear una nueva
            existingPendingOp.quantity = -sharesToSell;
            existingPendingOp.price = sellPrice;
            existingPendingOp.amount = liquidityReleased;
            existingPendingOp.date = new Date();
            existingPendingOp.isPartialSale = !isCompleteSale;
            existingPendingOp.partialSalePercentage = percentage;
            existingPendingOp.priceRange = {
              min: notificationPriceRange.min,
              max: notificationPriceRange.max
            };
            existingPendingOp.liquidityData = {
              allocatedAmount: allocatedAmount,
              shares: shares,
              entryPrice: entryPrice,
              realizedProfit: realizedProfit
            };
            existingPendingOp.notes = `Venta programada actualizada (${percentage}%) - ${alert.symbol} - Rango: $${notificationPriceRange.min} - $${notificationPriceRange.max}`;
            
            await existingPendingOp.save();
            console.log(`✅ Operación de venta pendiente ACTUALIZADA: ${alert.symbol}`);
          } else {
            // Obtener balance actual del admin para este sistema
            const currentBalanceDoc = await Operation.findOne({ createdBy: adminUser._id, system: tipo })
              .sort({ date: -1 })
              .select('balance');
            const currentBalance = currentBalanceDoc?.balance || 0;
            
            // NO modificar el balance aún - se hará cuando se ejecute la venta
            const operation = new Operation({
              ticker: alert.symbol.toUpperCase(),
              operationType: 'VENTA',
              quantity: -sharesToSell,
              price: sellPrice,
              amount: liquidityReleased,
              date: new Date(),
              balance: currentBalance,
              alertId: alert._id,
              alertSymbol: alert.symbol.toUpperCase(),
              system: tipo,
              createdBy: adminUser._id,
              isPartialSale: !isCompleteSale,
              partialSalePercentage: percentage,
              originalQuantity: alert.liquidityData?.originalShares || shares,
              priceRange: {
                min: notificationPriceRange.min,
                max: notificationPriceRange.max
              },
              isPriceConfirmed: false,
              portfolioPercentage: (alert.liquidityData?.allocatedAmount || allocatedAmount) / 1000 * 100,
              liquidityData: {
                allocatedAmount: allocatedAmount,
                shares: shares,
                entryPrice: entryPrice,
                realizedProfit: realizedProfit
              },
              executedBy: session.user.email,
              executionMethod: 'ADMIN',
              notes: `Venta programada (${percentage}%) - ${alert.symbol} - Rango: $${notificationPriceRange.min} - $${notificationPriceRange.max}`
            });

            await operation.save();
            console.log(`✅ Operación de venta programada creada: ${alert.symbol} - ${sharesToSell.toFixed(4)} acciones (A confirmar)`);
          }
        } else {
          console.log(`⚠️ No se encontró usuario admin para crear operación`);
        }
      } catch (operationError) {
        console.error('⚠️ Error creando operación de venta programada:', operationError);
        // No fallar la venta por un error en la operación
      }
      
    } else {
      // ✅ EJECUTAR VENTA INMEDIATAMENTE: Solo cuando NO hay rango de precios
      console.log(`💰 Ejecutando venta INMEDIATA (sin rango de precios)`);
      
      // ✅ CORREGIDO: Actualizar el porcentaje de participación usando newParticipation (ya incluye validación de umbral mínimo)
      // newParticipation ya fue calculado antes y ya incluye la validación de umbral mínimo
      alert.participationPercentage = newParticipation;
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
      // ✅ CORREGIDO: Usar el porcentaje realmente vendido, no el solicitado
      alert.ventasParciales.push({
        fecha: new Date(),
        precio: sellPrice,
        porcentajeVendido: actualPercentageSold, // ✅ Usar porcentaje realmente vendido
        gananciaRealizada: gananciaPorcentual, // ✅ Ganancia porcentual simple
        sharesVendidos: sharesToSell
      });
      
      // ✅ NUEVO: Guardar información de liquidez mejorada
      // ✅ CRÍTICO: Asegurar que originalShares se guarde correctamente (usar el valor calculado arriba)
      const finalOriginalShares = Math.max(0, liquidityData.originalShares || originalShares);
      const finalOriginalAllocated = Math.max(0, liquidityData.originalAllocatedAmount || originalAllocatedAmount);
      
      alert.liquidityData = {
        ...liquidityData,
        allocatedAmount: Math.max(0, newAllocatedAmount), // ✅ CORREGIDO: Asegurar que no sea negativo
        shares: Math.max(0, validSharesRemaining), // ✅ CORREGIDO: Asegurar que no sea negativo
        // ✅ CRÍTICO CORREGIDO: Guardar el monto original usando los valores calculados arriba
        originalAllocatedAmount: finalOriginalAllocated,
        originalShares: finalOriginalShares,
        // Guardar el porcentaje de participación original
        originalParticipationPercentage: alert.originalParticipationPercentage || originalParticipation,
        partialSales: [
          ...(liquidityData.partialSales || []),
          {
            date: new Date(),
            percentage: actualPercentageSold, // ✅ CORREGIDO: Guardar porcentaje realmente vendido
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

      // ✅ MEJORADO: Si se vendió todo (100% o situación similar), o si la participación restante es muy baja, cerrar la alerta
      // newParticipation ya fue calculado antes y ya incluye la validación de umbral mínimo (si es < 5%, ya está en 0)
      const shouldCloseAlert = sharesRemaining <= 0 || 
                                newParticipation <= 0 || 
                                isCompleteSale;
      
      if (shouldCloseAlert) {
        alert.status = 'CLOSED';
        alert.exitPrice = sellPrice; // Usar el valor numérico, no el string
        alert.exitDate = new Date();
        alert.exitReason = 'MANUAL';
        alert.participationPercentage = 0; // Asegurar que esté en 0
        console.log(`🔒 Alerta cerrada completamente - participación anterior: ${newParticipation.toFixed(2)}%, participación restante muy baja o cero`);
        
        // ✅ NUEVO: Verificar si realmente quedó tenencia en la distribución de liquidez
        try {
          const pool = alert.tipo === 'SmartMoney' ? 'SmartMoney' : 'TraderCall';
          const liquidity = await Liquidity.findOne({ 
            pool: pool,
            'distributions.alertId': alert._id
          });
          
          if (liquidity) {
            const distribution = liquidity.distributions.find((d: any) => d.alertId.toString() === alert._id.toString());
            if (distribution) {
              const remainingSharesInLiquidity = distribution.shares || 0;
              if (remainingSharesInLiquidity > 0.001) {
                console.log(`⚠️ [VERIFICACIÓN] Quedan ${remainingSharesInLiquidity.toFixed(4)} shares en la distribución de liquidez después de cerrar la alerta`);
                console.log(`⚠️ [VERIFICACIÓN] Esto podría indicar que hay tenencia residual en la billetera`);
              } else {
                console.log(`✅ [VERIFICACIÓN] No quedan shares en la distribución de liquidez (${remainingSharesInLiquidity.toFixed(4)})`);
              }
            }
          }
        } catch (liquidityCheckError) {
          console.error('⚠️ Error verificando tenencia en distribución de liquidez:', liquidityCheckError);
        }
      }
      
      // ✅ NUEVO: Calcular ganancia realizada acumulada después de registrar la venta
      alert.calculateTotalProfit();
      console.log(`📊 Ganancia realizada acumulada actualizada: ${alert.gananciaRealizada.toFixed(2)}%`);
    }

    await alert.save();

    // ✅ ACTUALIZAR EL SISTEMA DE LIQUIDEZ SOLO SI NO HAY RANGO (venta inmediata)
    if (!hasSellRange) {
      // ✅ ACTUALIZAR EL SISTEMA DE LIQUIDEZ DIRECTAMENTE
      try {
        console.log(`🔄 Actualizando sistema de liquidez para ${tipo}...`);
        
        // ✅ CORREGIDO: Buscar liquidez que contenga la distribución del alertId
        // Esto permite que cualquier admin pueda vender sin importar quién creó la distribución
        const liquidity = await Liquidity.findOne({ 
          pool: tipo,
          'distributions.alertId': alertId
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
    // ✅ CORREGIDO: NO enviar si ya se envió el email de venta programada (hasSellRange === true)
    if ((emailMessage || emailImageUrl) && !hasSellRange) {
      try {
        console.log(`📧 Enviando notificación de venta parcial para alerta ${alert.symbol}...`);
        
        // Construir el mensaje de notificación
        const notificationMessage = emailMessage || 
          `Alerta de venta para ${alert.symbol} en el rango de $${notificationPriceRange?.min || sellPrice} a $${notificationPriceRange?.max || sellPrice}. ` +
          `Se vendió el ${percentage}% de la posición.`;
        
        // Importar y usar la función de notificaciones
        const { notifyAlertSubscribers } = await import('../../../lib/notificationUtils');
        
        // ✅ CORREGIDO: Calcular profitPercentage acumulado considerando todas las ventas parciales previas
        let profitPercentage: number | undefined = undefined;
        if (entryPrice > 0 && sellPrice > 0) {
          const { calculateAccumulatedProfitPercentage } = await import('../../../lib/portfolioCalculator');
          profitPercentage = calculateAccumulatedProfitPercentage(alert, percentage, sellPrice);
        }
        
        // Enviar notificación usando el sistema existente
        await notifyAlertSubscribers(alert, {
          message: notificationMessage,
          imageUrl: emailImageUrl || undefined,
          title: `Venta Parcial - ${alert.symbol}`,
          action: 'SELL',
          priceRange: notificationPriceRange || undefined,
          soldPercentage: percentage, // ✅ NUEVO: Pasar el porcentaje vendido
          profitPercentage: profitPercentage, // ✅ NUEVO: Pasar el P&L porcentual si está disponible
          isExecutedSale: true, // ✅ NUEVO: Es venta EJECUTADA inmediatamente
          isCompleteSale: isCompleteSale // ✅ NUEVO: Indicar si es venta total o parcial
        });
        
        console.log(`✅ Notificación de venta parcial enviada exitosamente para ${alert.symbol}`);
        
      } catch (emailError) {
        console.log('⚠️ Error enviando notificación por email:', emailError);
        // No fallar la operación por un error de email
      }
    } else if (hasSellRange) {
      console.log(`📧 Email de venta programada ya enviado anteriormente, omitiendo email duplicado`);
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
