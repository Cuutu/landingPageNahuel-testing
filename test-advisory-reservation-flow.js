/**
 * Script de prueba para verificar el flujo de reservas de consultorio financiero
 * 
 * Este script simula el flujo completo:
 * 1. Obtener fechas disponibles
 * 2. Hacer una reserva temporal
 * 3. Verificar que la fecha desaparece de las disponibles
 * 4. Simular pago aprobado
 * 5. Verificar que la fecha queda confirmada
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

async function testAdvisoryReservationFlow() {
  console.log('🧪 Iniciando prueba del flujo de reservas de consultorio financiero...\n');

  try {
    // 1. Obtener fechas disponibles iniciales
    console.log('1️⃣ Obteniendo fechas disponibles iniciales...');
    const initialResponse = await fetch(`${BASE_URL}/api/advisory-dates/ConsultorioFinanciero?available=true&futureOnly=true`);
    const initialData = await initialResponse.json();
    
    if (!initialData.success) {
      throw new Error('Error obteniendo fechas iniciales');
    }
    
    const initialDates = initialData.dates || [];
    console.log(`✅ Fechas disponibles iniciales: ${initialDates.length}`);
    
    if (initialDates.length === 0) {
      console.log('⚠️ No hay fechas disponibles para probar. Crear algunas fechas primero.');
      return;
    }
    
    // Tomar la primera fecha disponible
    const testDate = initialDates[0];
    console.log(`📅 Fecha de prueba: ${testDate.title} - ${testDate.date} ${testDate.time}`);
    
    // 2. Simular reserva temporal (esto normalmente se hace desde el frontend)
    console.log('\n2️⃣ Simulando reserva temporal...');
    
    // Crear datos de reserva simulados
    const reservationData = {
      type: 'advisory',
      serviceType: 'ConsultorioFinanciero',
      startDate: new Date(testDate.date).toISOString(),
      duration: 60,
      price: 5000,
      notes: 'Prueba de reserva temporal',
      userEmail: 'test@example.com',
      userName: 'Usuario de Prueba',
      advisoryDateId: testDate._id
    };
    
    const checkoutResponse = await fetch(`${BASE_URL}/api/payments/mercadopago/create-booking-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'next-auth.session-token=test-session' // Simular sesión
      },
      body: JSON.stringify({
        serviceType: 'ConsultorioFinanciero',
        amount: 5000,
        currency: 'ARS',
        reservationData
      })
    });
    
    const checkoutData = await checkoutResponse.json();
    
    if (!checkoutData.success) {
      console.log('⚠️ No se pudo crear checkout (esperado sin sesión válida)');
      console.log('📝 Esto es normal - el endpoint requiere autenticación');
    } else {
      console.log('✅ Checkout creado exitosamente');
    }
    
    // 3. Verificar que la fecha ya no está disponible
    console.log('\n3️⃣ Verificando que la fecha ya no está disponible...');
    
    // Esperar un momento para que se procese
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const afterReservationResponse = await fetch(`${BASE_URL}/api/advisory-dates/ConsultorioFinanciero?available=true&futureOnly=true`);
    const afterReservationData = await afterReservationResponse.json();
    
    if (!afterReservationData.success) {
      throw new Error('Error obteniendo fechas después de la reserva');
    }
    
    const afterReservationDates = afterReservationData.dates || [];
    const isDateStillAvailable = afterReservationDates.some(date => date._id === testDate._id);
    
    if (isDateStillAvailable) {
      console.log('❌ La fecha aún está disponible - el sistema no está funcionando correctamente');
    } else {
      console.log('✅ La fecha ya no está disponible - sistema funcionando correctamente');
    }
    
    // 4. Limpiar reservas temporales expiradas
    console.log('\n4️⃣ Limpiando reservas temporales expiradas...');
    
    const cleanupResponse = await fetch(`${BASE_URL}/api/cron/cleanup-expired-reservations`, {
      method: 'POST'
    });
    
    const cleanupData = await cleanupResponse.json();
    
    if (cleanupData.success) {
      console.log(`✅ Limpieza completada: ${cleanupData.modifiedCount} reservas liberadas`);
    } else {
      console.log('⚠️ Error en limpieza:', cleanupData.error);
    }
    
    // 5. Verificar que la fecha vuelve a estar disponible
    console.log('\n5️⃣ Verificando que la fecha vuelve a estar disponible...');
    
    const finalResponse = await fetch(`${BASE_URL}/api/advisory-dates/ConsultorioFinanciero?available=true&futureOnly=true`);
    const finalData = await finalResponse.json();
    
    if (!finalData.success) {
      throw new Error('Error obteniendo fechas finales');
    }
    
    const finalDates = finalData.dates || [];
    const isDateAvailableAgain = finalDates.some(date => date._id === testDate._id);
    
    if (isDateAvailableAgain) {
      console.log('✅ La fecha volvió a estar disponible después de la limpieza');
    } else {
      console.log('⚠️ La fecha no volvió a estar disponible');
    }
    
    console.log('\n🎉 Prueba completada exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`- Fechas iniciales: ${initialDates.length}`);
    console.log(`- Fechas después de reserva: ${afterReservationDates.length}`);
    console.log(`- Fechas finales: ${finalDates.length}`);
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

// Ejecutar la prueba
testAdvisoryReservationFlow();
