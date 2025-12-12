// Service Worker para Diotronic Task Manager PWA
// Versión: 1.0

const CACHE_NAME = 'diotronic-task-manager-v1';
const DYNAMIC_CACHE = 'diotronic-dynamic-v1';

// Archivos estáticos para cachear
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/firebase-config.js',
  '/logo.png',
  '/logo_noche.png',
  '/manifest.json'
];

// URLs externas importantes (CDN)
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
];

// ==================== INSTALACIÓN ====================
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos estáticos');
        // Cachear archivos estáticos
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Cachear recursos externos
        return caches.open(CACHE_NAME).then(cache => {
          return Promise.all(
            EXTERNAL_ASSETS.map(url => {
              return fetch(url)
                .then(response => cache.put(url, response))
                .catch(err => console.log('[SW] No se pudo cachear:', url));
            })
          );
        });
      })
      .then(() => {
        console.log('[SW] ✅ Instalación completada');
        return self.skipWaiting(); // Activar inmediatamente
      })
      .catch(error => {
        console.error('[SW] ❌ Error en instalación:', error);
      })
  );
});

// ==================== ACTIVACIÓN ====================
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Eliminar caches antiguos
            if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] ✅ Activación completada');
        return self.clients.claim(); // Tomar control de todas las páginas
      })
  );
});

// ==================== FETCH (Estrategia de Cache) ====================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones que no son HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }

  // Estrategia para Firebase (siempre red primero)
  if (url.hostname.includes('firebaseapp.com') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebasestorage.app')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            JSON.stringify({ error: 'Sin conexión a Firebase' }),
            { headers: { 'Content-Type': 'application/json' }}
          );
        })
    );
    return;
  }

  // Estrategia para archivos estáticos (Cache First)
  if (STATIC_ASSETS.includes(url.pathname) || EXTERNAL_ASSETS.includes(request.url)) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Actualizar en background
            fetch(request)
              .then(response => {
                if (response && response.status === 200) {
                  caches.open(CACHE_NAME).then(cache => {
                    cache.put(request, response.clone());
                  });
                }
              })
              .catch(() => {});
            
            return cachedResponse;
          }
          
          // Si no está en cache, buscar en red
          return fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            });
        })
        .catch(() => {
          // Si falla todo, retornar página offline
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
        })
    );
    return;
  }

  // Estrategia para otros recursos (Network First)
  event.respondWith(
    fetch(request)
      .then(response => {
        // Guardar en cache dinámico
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en cache dinámico
        return caches.match(request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Última opción: retornar página principal
            if (request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// ==================== MENSAJES ====================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});

// ==================== SINCRONIZACIÓN EN BACKGROUND ====================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(
      // Aquí podrías sincronizar tareas pendientes con Firebase
      console.log('[SW] Sincronizando tareas...')
    );
  }
});

console.log('[SW] Service Worker cargado correctamente ✅');
