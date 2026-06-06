/**
 * 3D Print Flow — Service Worker
 * Estratégia: Cache-First para assets estáticos, Network-First para API calls.
 */

const CACHE_NAME = '3dprintflow-v1.0.0';

// Assets estáticos que ficam em cache
const STATIC_ASSETS = [
  '/dashboard.html',
  '/shared.css',
  '/i18n.js',
  '/sidebar.js',
  '/utils.js',
  '/supabase.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/logo.jpg',
  '/offline.html'
];

// Padrões de URLs que NÃO devem ser cacheadas (APIs, Supabase, Stripe)
const NO_CACHE_PATTERNS = [
  /supabase\.co/,
  /stripe\.com/,
  /googleapis\.com/,
  /phosphor-icons/,
  /cdn\.jsdelivr/,
  /unpkg\.com/,
  /fonts\.gstatic/
];

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache assets críticos — falhas silenciosas para não bloquear install
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => console.warn('[SW] Could not cache:', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests não-HTTP (ex: chrome-extension://)
  if (!request.url.startsWith('http')) return;

  // Ignora APIs externas — sempre vai à rede
  if (NO_CACHE_PATTERNS.some(pattern => pattern.test(request.url))) return;

  // Ignora POST/PUT/DELETE — nunca cacheamos mutations
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Cache hit — serve imediatamente, actualiza em background (stale-while-revalidate)
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {}); // Silencia erros de network quando em cache

        return cachedResponse;
      }

      // Sem cache — vai à rede e guarda para próxima vez
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback para navegação
          if (request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
    })
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: '3D Print Flow', body: event.data.text() };
  }

  const title = data.title || '3D Print Flow';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'default',
    data: { url: data.url || '/dashboard.html' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Ver agora' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  };

  event.waitUntil(
    Promise.all([
      // 1. Show the notification banner
      self.registration.showNotification(title, options),
      // 2. Update the App Icon Badge with the count from the payload
      data.badge && 'setAppBadge' in self.navigator
        ? self.navigator.setAppBadge(data.badge).catch(() => {})
        : Promise.resolve()
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  const targetUrl = event.notification.data?.url || '/dashboard.html';
  event.notification.close();

  if (action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app already open, focus and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

