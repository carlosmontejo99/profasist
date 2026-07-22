const CACHE_NAME = 'profasist-v3.0.1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Install event: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Network first, fall back to cache for API/CDN calls.
// Stale-while-revalidate strategy for the app shell.
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests for simplicity in this demo environment, 
  // or handle them with specific caching strategies.
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.includes('cdn') && !event.request.url.includes('esm.sh')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request).then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the new resource
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(async () => {
        if (event.request.mode === 'navigate') {
          return (await caches.match('/index.html')) || Response.error();
        }
        return Response.error();
      });
    })
  );
});

// Push Event: Handle incoming web push notifications from the server
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'ProfAsist: Pase de Lista', body: event.data.text() };
    }
  } else {
    data = { title: 'ProfAsist: Pase de Lista', body: 'Es hora de pasar asistencia en tus materias.' };
  }

  const options = {
    body: data.body || 'Es hora de pasar asistencia en tus materias.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    requireInteraction: true,
    tag: data.tag || 'profasist-reminder',
    data: {
      url: data.url || '/',
      groupId: data.tag
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'ProfAsist: Recordatorio', options)
  );
});

// Notification Click Event: Open the app and focus it, navigating to the selected group
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickData = event.notification.data || {};
  const urlToOpen = new URL(clickData.url || '/', self.location.origin).toString();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and notify it to open the group
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen || client.url.startsWith(self.location.origin)) {
          if (clickData.groupId) {
            client.postMessage({ type: 'OPEN_GROUP', groupId: clickData.groupId });
          }
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      
      // If no window is open, open a new one with the target URL
      if (clients.openWindow) {
        let destinationUrl = urlToOpen;
        if (clickData.groupId) {
          destinationUrl = `${urlToOpen}?groupId=${clickData.groupId}`;
        }
        return clients.openWindow(destinationUrl);
      }
    })
  );
});
