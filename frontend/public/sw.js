// WanRide Service Worker - Offline-first PWA for PNG connectivity
const CACHE_NAME = 'wanride-v2.2.0';
const API_CACHE_NAME = 'wanride-api-v2.2.0';

// Critical resources to cache for offline functionality
const STATIC_CACHE_URLS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API endpoints to cache for offline access
const API_CACHE_URLS = [
  '/api/auth/health',
  '/api/rides/active',
  '/api/rides/history'
];

// PNG-specific offline strategies for poor connectivity
const OFFLINE_FALLBACK_PAGE = '/offline.html';
const NETWORK_TIMEOUT = 3000; // 3 seconds for PNG network conditions

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing WanRide Service Worker v2.2.0');
  
  event.waitUntil(
    Promise.all([
      // Cache static resources
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static resources');
        return cache.addAll(STATIC_CACHE_URLS);
      }),
      // Cache API responses
      caches.open(API_CACHE_NAME).then((cache) => {
        console.log('[SW] Preparing API cache');
        return Promise.resolve();
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      // Force activation for immediate control
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating WanRide Service Worker v2.2.0');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - implement offline-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle different types of requests
  if (request.method === 'GET') {
    if (url.pathname.startsWith('/api/')) {
      // API requests - network first with cache fallback
      event.respondWith(handleApiRequest(request));
    } else if (url.pathname.startsWith('/static/') || url.pathname === '/') {
      // Static resources - cache first
      event.respondWith(handleStaticRequest(request));
    } else {
      // Other requests - network first
      event.respondWith(handleNetworkFirst(request));
    }
  } else if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
    // POST requests - queue for offline sync
    event.respondWith(handlePostRequest(request));
  }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Try network first with timeout for PNG conditions
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), NETWORK_TIMEOUT)
      )
    ]);

    if (networkResponse.ok) {
      // Cache successful responses
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] Network failed for API request, trying cache:', request.url);
    
    // Fallback to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline indicator for critical API calls
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'Request queued for sync when online',
        offline: true 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static resources with cache-first strategy
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Failed to fetch static resource:', request.url);
    return new Response('Resource not available offline', { status: 404 });
  }
}

// Handle general network-first requests
async function handleNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      const offlinePage = await cache.match(OFFLINE_FALLBACK_PAGE);
      return offlinePage || new Response('Offline', { status: 503 });
    }
    
    return new Response('Network error', { status: 503 });
  }
}

// Handle POST requests - queue for background sync
async function handlePostRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Queue for background sync
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: Date.now()
    };
    
    // Store in IndexedDB for sync when online
    await storeOfflineRequest(requestData);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Request queued for sync when online',
        queued: true 
      }),
      { 
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Store offline requests for background sync
async function storeOfflineRequest(requestData) {
  try {
    // Open IndexedDB for offline queue
    const db = await openOfflineDB();
    const transaction = db.transaction(['requests'], 'readwrite');
    const store = transaction.objectStore('requests');
    await store.add(requestData);
    console.log('[SW] Request queued for offline sync:', requestData.url);
  } catch (error) {
    console.error('[SW] Failed to queue offline request:', error);
  }
}

// Open IndexedDB for offline storage
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('WanRideOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('requests')) {
        const store = db.createObjectStore('requests', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Background sync event - sync queued requests when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'wanride-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncOfflineRequests());
  }
});

// Sync offline requests when connection is restored
async function syncOfflineRequests() {
  try {
    const db = await openOfflineDB();
    const transaction = db.transaction(['requests'], 'readonly');
    const store = transaction.objectStore('requests');
    const requests = await store.getAll();
    
    console.log(`[SW] Syncing ${requests.length} offline requests`);
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          // Remove successfully synced request
          const deleteTransaction = db.transaction(['requests'], 'readwrite');
          const deleteStore = deleteTransaction.objectStore('requests');
          await deleteStore.delete(requestData.id);
          console.log('[SW] Successfully synced request:', requestData.url);
        }
      } catch (error) {
        console.log('[SW] Failed to sync request:', requestData.url, error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Push notification event for ride updates
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log('[SW] Push notification received:', data);
    
    const options = {
      body: data.message,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: data.type || 'wanride-notification',
      data: data,
      actions: data.actions || [],
      requireInteraction: data.urgent || false
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'WanRide', options)
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  // Route to appropriate interface based on notification type
  if (data.type === 'ride_assigned' && data.driverId) {
    url = '/driver';
  } else if (data.type === 'ride_update' && data.passengerId) {
    url = '/passenger';
  } else if (data.type === 'sos_alert') {
    url = '/dispatcher';
  }
  
  event.waitUntil(
    clients.openWindow(url)
  );
});

console.log('[SW] WanRide Service Worker v2.2.0 loaded - Ready for PNG offline operations');
