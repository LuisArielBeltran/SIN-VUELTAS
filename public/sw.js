const CACHE_NAME = 'sin-vueltas-v1';
const assetsToCache = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Instalación del Service Worker y almacenamiento en caché inicial
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(assetsToCache);
        })
    );
    self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Interceptar peticiones para servir contenido desde la caché (excluyendo API y WebSockets)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // No cachear llamadas a la API REST ni a Socket.io
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        })
    );
});
