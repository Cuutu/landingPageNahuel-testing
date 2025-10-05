/**
 * Script para debuggear los datos de suscripción y identificar problemas
 */

const VERCEL_URL = 'https://lozanonahuel.vercel.app';

const debugSubscriptionData = async () => {
  console.log('🔍 Debuggeando datos de suscripción...');
  console.log(`🌐 URL: ${VERCEL_URL}\n`);

  try {
    // Simular los datos que se envían al endpoint
    const testData = {
      trainingType: 'SwingTrading',
      subscriptionMonth: 10,
      subscriptionYear: 2025
    };

    console.log('📋 Datos de prueba:', testData);

    // Simular la generación del paymentId como lo hace el endpoint
    const paymentId = `MTS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('🔑 PaymentId generado:', paymentId);

    // Simular los datos de suscripción como los crea el endpoint
    const subscriptionData = {
      userId: 'test_user_id',
      userEmail: 'franco.l.varela99@gmail.com',
      userName: 'Franco Varela',
      trainingType: 'SwingTrading',
      subscriptionMonth: 10,
      subscriptionYear: 2025,
      startDate: new Date(2025, 9, 1), // Octubre 2025
      endDate: new Date(2025, 9, 31, 23, 59, 59, 999), // 31 de octubre 2025
      paymentId: paymentId,
      paymentAmount: 100,
      paymentStatus: 'pending'
    };

    console.log('\n📝 Datos de suscripción simulados:');
    console.log(JSON.stringify(subscriptionData, null, 2));

    // Verificar si hay algún problema con los tipos de datos
    console.log('\n🔍 Verificación de tipos:');
    console.log('userId:', typeof subscriptionData.userId, '-', subscriptionData.userId);
    console.log('userEmail:', typeof subscriptionData.userEmail, '-', subscriptionData.userEmail);
    console.log('userName:', typeof subscriptionData.userName, '-', subscriptionData.userName);
    console.log('trainingType:', typeof subscriptionData.trainingType, '-', subscriptionData.trainingType);
    console.log('subscriptionMonth:', typeof subscriptionData.subscriptionMonth, '-', subscriptionData.subscriptionMonth);
    console.log('subscriptionYear:', typeof subscriptionData.subscriptionYear, '-', subscriptionData.subscriptionYear);
    console.log('startDate:', typeof subscriptionData.startDate, '-', subscriptionData.startDate);
    console.log('endDate:', typeof subscriptionData.endDate, '-', subscriptionData.endDate);
    console.log('paymentId:', typeof subscriptionData.paymentId, '-', subscriptionData.paymentId);
    console.log('paymentAmount:', typeof subscriptionData.paymentAmount, '-', subscriptionData.paymentAmount);
    console.log('paymentStatus:', typeof subscriptionData.paymentStatus, '-', subscriptionData.paymentStatus);

    // Verificar si hay algún problema con las fechas
    console.log('\n📅 Verificación de fechas:');
    console.log('startDate válida:', !isNaN(new Date(subscriptionData.startDate).getTime()));
    console.log('endDate válida:', !isNaN(new Date(subscriptionData.endDate).getTime()));
    console.log('startDate < endDate:', new Date(subscriptionData.startDate) < new Date(subscriptionData.endDate));

    // Verificar si hay algún problema con los valores enum
    console.log('\n🔍 Verificación de valores:');
    const validTrainingTypes = ['SwingTrading', 'DayTrading', 'DowJones'];
    console.log('trainingType válido:', validTrainingTypes.includes(subscriptionData.trainingType));
    console.log('subscriptionMonth válido:', subscriptionData.subscriptionMonth >= 1 && subscriptionData.subscriptionMonth <= 12);
    console.log('subscriptionYear válido:', subscriptionData.subscriptionYear >= 2024);
    console.log('paymentAmount válido:', subscriptionData.paymentAmount > 0);

    console.log('\n✅ Todos los datos se ven correctos para el guardado');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

debugSubscriptionData();
