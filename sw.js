const CACHE_NAME = 'controlagro-v9';
const ASSETS = [
    './',
    './index.html',
    './logo.png',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // HTML pages: network first, cache fallback (always get latest)
    if (event.request.mode === 'navigate' || url.endsWith('.html') || url.endsWith('/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Other assets: cache first, network fallback
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;

                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache => {
                            if (event.request.url.startsWith('http') && !event.request.url.includes('supabase.co')) {
                                cache.put(event.request, responseToCache);
                            }
                        });

                    return response;
                });
            })
    );
});
