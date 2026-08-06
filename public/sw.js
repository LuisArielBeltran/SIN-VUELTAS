const CACHE_NAME = 'sin-vueltas-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json'
];

// Instalar el Service Worker y guardar en caché
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 Caché PWA guardado con éxito');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Interceptar peticiones para servir desde el caché si no hay red
self.addEventListener('fetch', (event) => {
    // Solo interceptamos peticiones GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Si está en caché, lo devuelve. Si no, va a internet.
            return cachedResponse || fetch(event.request);
        }).catch(() => {
            // Si no hay internet y no está en caché, mostramos el index por defecto
            if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/index.html');
            }
        })
    );
});

// Limpiar cachés antiguos si actualizas la versión
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});
