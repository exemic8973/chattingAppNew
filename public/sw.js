const CACHE_NAME = 'chat-app-pwa-v1';
const STATIC_CACHE_NAME = 'chat-app-static-v1';
const DYNAMIC_CACHE_NAME = 'chat-app-dynamic-v1';
const API_CACHE_NAME = 'chat-app-api-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/channels',
  '/api/users'
];

// Cache sizes
const MAX_CACHE_SIZE = 50;
const MAX_API_CACHE_SIZE = 100;

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('PWA Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('PWA Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME && 
              cacheName !== API_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network strategies
const strategies = {
  // Cache first for static assets
  cacheFirst: async (request) => {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      console.error('Cache first failed:', error);
      throw error;
    }
  },

  // Network first for API calls
  networkFirst: async (request) => {
    const cache = await caches.open(API_CACHE_NAME);
    
    try {
      const response = await fetch(request);
      
      if (response.ok) {
        // Cache the response
        cache.put(request, response.clone());
        
        // Clean up old cache entries
        await cleanupCache(cache, API_CACHE_NAME);
      }
      
      return response;
    } catch (error) {
      console.log('Network failed, trying cache:', request.url);
      const cached = await cache.match(request);
      
      if (cached) {
        return cached;
      }
      
      // Return offline page for HTML requests
      if (request.headers.get('accept')?.includes('text/html')) {
        return caches.match('/offline.html');
      }
      
      throw error;
    }
  },

  // Stale while revalidate for dynamic content
  staleWhileRevalidate: async (request) => {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cached = await cache.match(request);
    
    const fetchPromise = fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        cleanupCache(cache, DYNAMIC_CACHE_NAME);
      }
      return response;
    });
    
    return cached || fetchPromise;
  }
};

// Helper function to clean up cache
async function cleanupCache(cache, cacheName) {
  const requests = await cache.keys();
  
  if (requests.length > MAX_CACHE_SIZE) {
    const requestsToDelete = requests.slice(0, requests.length - MAX_CACHE_SIZE);
    await Promise.all(requestsToDelete.map(request => cache.delete(request)));
  }
}

// Fetch event handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Route requests to appropriate strategy
  if (STATIC_ASSETS.some(asset => request.url.includes(asset))) {
    event.respondWith(strategies.cacheFirst(request));
  } else if (API_ENDPOINTS.some(endpoint => request.url.includes(endpoint))) {
    event.respondWith(strategies.networkFirst(request));
  } else if (request.url.includes('/uploads/')) {
    event.respondWith(strategies.staleWhileRevalidate(request));
  } else {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          return response || fetch(request);
        })
    );
  }
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-messages') {
    event.waitUntil(syncOfflineMessages());
  } else if (event.tag === 'background-sync-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

// Sync offline messages
async function syncOfflineMessages() {
  try {
    const offlineMessages = await getOfflineData('offlineMessages');
    
    for (const message of offlineMessages) {
      try {
        const response = await fetch('/api/send-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message)
        });
        
        if (response.ok) {
          await removeOfflineData('offlineMessages', message.id);
        }
      } catch (error) {
        console.error('Failed to sync message:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Sync offline actions (reactions, edits, etc.)
async function syncOfflineActions() {
  try {
    const offlineActions = await getOfflineData('offlineActions');
    
    for (const action of offlineActions) {
      try {
        const response = await fetch(action.endpoint, {
          method: action.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(action.data)
        });
        
        if (response.ok) {
          await removeOfflineData('offlineActions', action.id);
        }
      } catch (error) {
        console.error('Failed to sync action:', error);
      }
    }
  } catch (error) {
    console.error('Background sync actions failed:', error);
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  const options = {
    body: 'You have a new message',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open Chat',
        icon: '/icons/open-96x96.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/close-96x96.png'
      }
    ]
  };

  if (event.data) {
    const data = event.data.json();
    options.body = data.body || options.body;
    options.title = data.title || 'Chat App';
    options.data = { ...options.data, ...data };
  }

  event.waitUntil(
    self.registration.showNotification(options.title || 'Chat App', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);
  
  event.notification.close();

  if (event.action === 'explore' || !event.action) {
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Notification close handler
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// IndexedDB helpers for offline storage
async function getOfflineData(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatAppOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getRequest = store.getAll();
      
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => resolve(getRequest.result || []);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
  });
}

async function removeOfflineData(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatAppOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const deleteRequest = store.delete(id);
      
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onsuccess = () => resolve();
    };
  });
}