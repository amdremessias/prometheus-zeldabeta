/* Service worker minimal para PWA instalável.
   App é 100% client-side (IndexedDB), então basta cache-first para
   o shell da aplicação com fallback de rede. */
const CACHE = 'restaurante-cache-v1';

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api')) return;

    event.respondWith(
        caches.open(CACHE).then(async (cache) => {
            const cached = await cache.match(request);

            try {
                const network = await fetch(request);
                if (network && network.status === 200) {
                    cache.put(request, network.clone());
                }
                return network;
            } catch (error) {
                if (cached) return cached;
                if (request.mode === 'navigate') {
                    return caches.match('/app') || caches.match('/');
                }
                throw error;
            }
        })
    );
});