/**
 * Service Worker - App Ventas (Modo Offline Real en Ruta)
 * Cachea la estructura completa de la app, librerías externas (Excel, Gráficas, Mapa, Iconos)
 * y teselas del mapa visitadas para funcionar al 100% sin cobertura móvil.
 */

const CACHE_NAME = 'app-ventas-shell-v8.1';
const RUNTIME_CACHE = 'app-ventas-runtime-v8.1';

const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './src/assets/icon.png',
    './src/assets/icon_192.png',
    './src/assets/logo.png',
    './src/assets/new_logo.png',
    './src/assets/splash_512.png',
    './src/assets/splash_logo.png',
    './src/css/theme.css',
    './src/css/main.css',
    './src/css/dash.css',
    './src/css/order_modal.css',
    './src/css/pedidos.css',
    './src/css/totales.css',
    './src/css/clientes.css',
    './src/css/alertas.css',
    './src/css/objetivos.css',
    './src/css/mapa.css',
    './src/css/factura.css',
    './src/css/ventas.css',
    './src/css/medias.css',
    './src/css/ajustes.css',
    './src/css/departamentos.css',
    './src/js/db.js',
    './src/js/data-manager.js',
    './src/js/data.js',
    './src/js/render/common.js',
    './src/js/render/dashboard.js',
    './src/js/render/pedidos.js',
    './src/js/render/clientes.js',
    './src/js/render/mapa.js',
    './src/js/render/analytics.js',
    './src/js/render/analytics-ideas.js',
    './src/js/render/departamentos.js',
    './src/js/render/system.js',
    './src/js/main.js'
];

const EXTERNAL_CDN_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            // Cachear archivos locales esenciales
            await Promise.allSettled(
                CORE_ASSETS.map(url => cache.add(url).catch(err => console.warn('[SW] No se pudo cachear recurso local:', url, err)))
            );
            // Cachear librerías CDN externas
            const runtimeCache = await caches.open(RUNTIME_CACHE);
            await Promise.allSettled(
                EXTERNAL_CDN_ASSETS.map(async (url) => {
                    try {
                        const req = new Request(url, { mode: 'cors' });
                        const res = await fetch(req);
                        if (res && (res.ok || res.type === 'opaque')) {
                            await runtimeCache.put(url, res);
                        }
                    } catch (err) {
                        console.warn('[SW] No se pudo pre-cachear CDN:', url, err);
                    }
                })
            );
            await self.skipWaiting();
        })()
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME && key !== RUNTIME_CACHE) {
                        return caches.delete(key);
                    }
                })
            );
            await self.clients.claim();
        })()
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // 1. Nunca interceptar llamadas a Google Apps Script (Drive Sync / Backups) ni Nominatim (Búsqueda GPS en vivo)
    if (
        url.hostname.includes('script.google.com') ||
        url.hostname.includes('googleusercontent.com') ||
        url.hostname.includes('nominatim.openstreetmap.org')
    ) {
        return;
    }

    // 2. Recursos estáticos externos (CDNs, Fuentes de Google, Iconos Material, Teselas del Mapa) -> Cache First con actualización en segundo plano
    const isExternalStatic =
        url.hostname.includes('unpkg.com') ||
        url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('basemaps.cartocdn.com') ||
        url.hostname.includes('tile.openstreetmap.org');

    if (isExternalStatic) {
        event.respondWith(
            (async () => {
                const cached = await caches.match(request);
                const fetchPromise = fetch(request)
                    .then(async (networkRes) => {
                        if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
                            const cache = await caches.open(RUNTIME_CACHE);
                            cache.put(request, networkRes.clone());
                        }
                        return networkRes;
                    })
                    .catch(() => null);

                return cached || (await fetchPromise) || new Response('', { status: 504, statusText: 'Offline' });
            })()
        );
        return;
    }

    // 3. Archivos propios de la aplicación (HTML, JS, CSS, imágenes locales) -> Network First con respaldo inmediato a Caché (soporta ?v=...)
    if (url.origin === self.location.origin) {
        event.respondWith(
            (async () => {
                try {
                    const networkRes = await fetch(request);
                    if (networkRes && networkRes.ok) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(request, networkRes.clone());
                    }
                    return networkRes;
                } catch (err) {
                    const exactMatch = await caches.match(request);
                    if (exactMatch) return exactMatch;

                    const ignoreQueryMatch = await caches.match(request, { ignoreSearch: true });
                    if (ignoreQueryMatch) return ignoreQueryMatch;

                    if (request.mode === 'navigate') {
                        const fallbackIndex = await caches.match('./index.html', { ignoreSearch: true });
                        if (fallbackIndex) return fallbackIndex;
                    }

                    return new Response('Sin conexión y recurso no disponible en caché local.', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                    });
                }
            })()
        );
    }
});
