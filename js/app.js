if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado', reg))
      .catch(err => console.error('Error al registrar SW', err));
  });
}

window.addEventListener('online', () => document.getElementById('estadoConexion').innerText = 'Conectado - Sincronizando...');
window.addEventListener('offline', () => document.getElementById('estadoConexion').innerText = 'Modo Offline (Datos guardados localmente)');

document.addEventListener('DOMContentLoaded', () => {
    console.log("App inicializada. Lista para integrar la vista unificada.");
});
