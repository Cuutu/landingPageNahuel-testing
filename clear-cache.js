// Script para limpiar cache y forzar recarga
console.log('🧹 Limpiando cache del navegador...');

// Limpiar localStorage
if (typeof localStorage !== 'undefined') {
  localStorage.clear();
  console.log('✅ localStorage limpiado');
}

// Limpiar sessionStorage
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.clear();
  console.log('✅ sessionStorage limpiado');
}

// Limpiar cache de service worker si existe
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('✅ Service Worker desregistrado');
    }
  });
}

// Forzar recarga sin cache
if (typeof window !== 'undefined') {
  window.location.reload(true);
  console.log('🔄 Recargando página sin cache...');
}
