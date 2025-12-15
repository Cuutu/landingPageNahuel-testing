// ============================================
// SCRIPT DE REVERSIÓN: Venta de HMY
// Este script revierte la venta parcial de HMY que se ejecutó incorrectamente
// ============================================

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

async function revertHmySale() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const Alert = mongoose.model('Alert', new mongoose.Schema({}, { strict: false }));
    const Operation = mongoose.model('Operation', new mongoose.Schema({}, { strict: false }));
    const Liquidity = mongoose.model('Liquidity', new mongoose.Schema({}, { strict: false }));

    const alertId = new mongoose.Types.ObjectId('692e2ef7a16956ec58c153fd');
    const operationId = new mongoose.Types.ObjectId('693c32122a471eb824f83a22');

    console.log('\n📊 PASO 1: Verificar estado actual...');
    
    // Verificar alerta
    const alert = await Alert.findById(alertId);
    if (!alert) {
      console.error('❌ No se encontró la alerta');
      return;
    }
    console.log(`✅ Alerta encontrada: ${alert.symbol}`);
    console.log(`   Status: ${alert.status}`);
    console.log(`   Participation: ${alert.participationPercentage}%`);
    console.log(`   Current Price: $${alert.currentPrice}`);
    console.log(`   Entry Price: $${alert.entryPrice}`);
    console.log(`   LiquidityData shares: ${alert.liquidityData?.shares || 'N/A'}`);
    console.log(`   LiquidityData originalShares: ${alert.liquidityData?.originalShares || 'N/A'}`);

    // Verificar operación de VENTA
    const operation = await Operation.findById(operationId);
    if (!operation) {
      console.error('❌ No se encontró la operación de venta');
      return;
    }
    console.log(`✅ Operación de VENTA encontrada: ${operation.ticker}`);
    console.log(`   Price: $${operation.price}`);
    console.log(`   Quantity: ${operation.quantity}`);
    console.log(`   Amount: $${operation.amount}`);
    console.log(`   isPriceConfirmed: ${operation.isPriceConfirmed}`);
    console.log(`   PriceRange: $${operation.priceRange?.min || 'N/A'} - $${operation.priceRange?.max || 'N/A'}`);
    
    // Verificar operación de COMPRA
    const buyOperation = await Operation.findOne({
      alertId: alertId,
      operationType: 'COMPRA',
      system: operation.system
    }).sort({ date: -1 });
    
    if (buyOperation) {
      console.log(`✅ Operación de COMPRA encontrada:`);
      console.log(`   Quantity: ${buyOperation.quantity}`);
      console.log(`   Price: $${buyOperation.price}`);
      console.log(`   Amount: $${buyOperation.amount}`);
      console.log(`   LiquidityData shares: ${buyOperation.liquidityData?.shares || 'N/A'}`);
    } else {
      console.log(`⚠️ No se encontró operación de COMPRA para esta alerta`);
    }

    // Verificar liquidez - mostrar TODA la información
    const liquidity = await Liquidity.findOne({
      pool: alert.tipo,
      'distributions.alertId': alertId.toString()
    });
    
    if (liquidity) {
      console.log(`\n💰 LIQUIDEZ: ${liquidity.pool}`);
      console.log(`   Total Liquidity: $${(liquidity.totalLiquidity || 0).toFixed(2)}`);
      console.log(`   Available: $${(liquidity.availableLiquidity || 0).toFixed(2)}`);
      console.log(`   Distributed: $${(liquidity.distributedLiquidity || 0).toFixed(2)}`);
      console.log(`   Initial: $${(liquidity.initialLiquidity || 0).toFixed(2)}`);
      
      if (liquidity.distributions && liquidity.distributions.length > 0) {
        console.log(`\n   Distribuciones (${liquidity.distributions.length}):`);
        liquidity.distributions.forEach((d, i) => {
          const isHmy = d.alertId && d.alertId.toString() === alertId.toString();
          const marker = isHmy ? '👉' : '  ';
          console.log(`${marker} [${i}] AlertId: ${d.alertId}`);
          console.log(`      Ticker: ${d.ticker || 'N/A'}`);
          console.log(`      Shares: ${d.shares || 0}`);
          console.log(`      Allocated: $${(d.allocatedAmount || 0).toFixed(2)}`);
          console.log(`      Entry Price: $${(d.entryPrice || 0).toFixed(2)}`);
        });
      }
      
      const distribution = liquidity.distributions.find(
        d => d.alertId && d.alertId.toString() === alertId.toString()
      );
      if (distribution) {
        console.log(`\n✅ Distribución de HMY encontrada en liquidez`);
      }
    } else {
      console.log(`\n⚠️ No se encontró liquidez para el pool ${alert.tipo}`);
    }

    console.log('\n🔄 PASO 2: Verificando y revirtiendo cambios en el balance...');
    
    // Obtener el balance que tenía ANTES de esta venta
    // Buscar la operación anterior a esta venta
    const previousOperation = await Operation.findOne({
      system: operation.system,
      createdBy: operation.createdBy,
      date: { $lt: operation.date }
    }).sort({ date: -1 });
    
    const balanceBeforeSale = previousOperation ? previousOperation.balance : 0;
    const balanceAfterSale = operation.balance;
    const amountToRevert = Math.abs(operation.amount); // 28.40442951480049
    
    console.log(`   Balance antes de la venta: $${balanceBeforeSale.toFixed(2)}`);
    console.log(`   Balance después de la venta: $${balanceAfterSale.toFixed(2)}`);
    console.log(`   Monto a revertir: $${amountToRevert.toFixed(2)}`);
    
    // Revertir el balance de todas las operaciones posteriores a esta venta
    const operationsAfter = await Operation.find({
      system: operation.system,
      createdBy: operation.createdBy,
      date: { $gt: operation.date }
    }).sort({ date: 1 });
    
    if (operationsAfter.length > 0) {
      console.log(`   ⚠️ Hay ${operationsAfter.length} operación(es) posteriores que necesitan ajuste de balance`);
      
      for (const op of operationsAfter) {
        const oldBalance = op.balance;
        const newBalance = op.balance + amountToRevert;
        
        await Operation.updateOne(
          { _id: op._id },
          { $set: { balance: newBalance } }
        );
        
        console.log(`   ✅ Balance de ${op.ticker} ajustado: $${oldBalance.toFixed(2)} → $${newBalance.toFixed(2)}`);
      }
    }

    console.log('\n🔄 PASO 3: Eliminando operación de venta...');
    const deleteResult = await Operation.deleteOne({ _id: operationId });
    console.log(`✅ Operación eliminada: ${deleteResult.deletedCount} documento(s)`);

    console.log('\n🔄 PASO 4: Limpiando venta parcial de la alerta...');
    
    // Limpiar el partialSale que está marcado como executed: false
    const partialSales = alert.liquidityData?.partialSales || [];
    const updatedPartialSales = partialSales.filter(
      sale => sale._id.toString() !== '693c316b2a471eb824f8326a'
    );

    await Alert.updateOne(
      { _id: alertId },
      {
        $set: {
          'liquidityData.partialSales': updatedPartialSales
        }
      }
    );
    console.log(`✅ Venta parcial eliminada de la alerta`);
    console.log(`   Ventas parciales restantes: ${updatedPartialSales.length}`);

    console.log('\n🔄 PASO 5: Verificando liquidez...');
    
    // Verificar si la liquidez se afectó (aunque probablemente no, porque executed: false)
    if (liquidity) {
      const distribution = liquidity.distributions.find(
        d => d.alertId && d.alertId.toString() === alertId.toString()
      );
      
      if (distribution) {
        console.log(`   📊 Estado actual de la distribución:`);
        console.log(`      Shares: ${distribution.shares}`);
        console.log(`      Allocated: $${distribution.allocatedAmount}`);
        console.log(`      Entry Price: $${distribution.entryPrice || 'N/A'}`);
        
        // Determinar shares esperadas: usar originalShares de la alerta, o shares de la alerta, o shares de la compra
        let expectedShares = alert.liquidityData?.originalShares;
        if (!expectedShares) {
          expectedShares = alert.liquidityData?.shares;
        }
        if (!expectedShares && buyOperation) {
          // Si no hay en la alerta, usar las shares de la operación de compra
          expectedShares = buyOperation.liquidityData?.shares || buyOperation.quantity;
        }
        
        const entryPrice = alert.entryPrice || distribution.entryPrice || 18.83;
        const expectedAllocated = expectedShares * entryPrice;
        
        console.log(`   📊 Valores esperados:`);
        console.log(`      Shares: ${expectedShares}`);
        console.log(`      Allocated: $${expectedAllocated.toFixed(2)}`);
        console.log(`      Entry Price: $${entryPrice}`);
        
        if (distribution.shares !== expectedShares || Math.abs(distribution.allocatedAmount - expectedAllocated) > 0.01) {
          console.log(`   ⚠️ Liquidez necesita corrección:`);
          console.log(`      Shares: ${distribution.shares} → ${expectedShares}`);
          console.log(`      Allocated: $${distribution.allocatedAmount.toFixed(2)} → $${expectedAllocated.toFixed(2)}`);
          console.log(`   ✅ Restaurando liquidez...`);
          
          distribution.shares = expectedShares;
          distribution.allocatedAmount = expectedAllocated;
          distribution.entryPrice = entryPrice;
          
          await liquidity.save();
          console.log(`   ✅ Liquidez restaurada correctamente`);
        } else {
          console.log(`   ✅ Liquidez correcta (no necesita cambios)`);
        }
      } else {
        console.log(`   ℹ️ No se encontró distribución para esta alerta en la liquidez`);
      }
    } else {
      console.log(`   ℹ️ No se encontró documento de liquidez (puede ser normal si no se usó liquidez)`);
    }

    console.log('\n🔄 PASO 6: Verificando que la alerta esté correcta...');
    
    // Verificar que participationPercentage sea 100% (no debería haber cambiado)
    if (alert.participationPercentage !== 100) {
      console.log(`   ⚠️ ParticipationPercentage es ${alert.participationPercentage}%, debería ser 100%`);
      await Alert.updateOne(
        { _id: alertId },
        {
          $set: {
            participationPercentage: 100
          }
        }
      );
      console.log(`   ✅ ParticipationPercentage restaurado a 100%`);
    } else {
      console.log(`   ✅ ParticipationPercentage correcto: 100%`);
    }

    console.log('\n✅ REVERSIÓN COMPLETADA');
    console.log('===========================================');
    console.log('Resumen:');
    console.log(`- ✅ Operación de venta eliminada`);
    console.log(`- ✅ Venta parcial limpiada de la alerta`);
    console.log(`- ✅ Balances de operaciones posteriores ajustados`);
    console.log(`- ✅ Liquidez verificada y restaurada si fue necesario`);
    console.log(`- ✅ Alerta restaurada a estado correcto (participationPercentage: 100%)`);
    console.log('===========================================');
    console.log('\n📋 Verificaciones recomendadas:');
    console.log('1. Verificar que la alerta de HMY tenga participationPercentage: 100%');
    console.log('2. Verificar que no haya operaciones de venta de HMY');
    console.log('3. Verificar que los balances de operaciones posteriores sean correctos');
    console.log('4. Verificar que la liquidez no se haya afectado');

  } catch (error) {
    console.error('❌ Error durante la reversión:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

// Ejecutar
revertHmySale();

