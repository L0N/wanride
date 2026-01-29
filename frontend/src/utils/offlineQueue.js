// Offline Queue Management for WanRide PWA
// Handles ride requests and other critical operations when offline

class OfflineQueue {
  constructor() {
    this.dbName = 'WanRideOffline';
    this.dbVersion = 1;
    this.storeName = 'requests';
    this.db = null;
    this.isOnline = navigator.onLine;
    
    // Initialize database
    this.initDB();
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  // Initialize IndexedDB
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('[OfflineQueue] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[OfflineQueue] Database initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create requests store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });
          
          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
          
          console.log('[OfflineQueue] Database schema created');
        }
      };
    });
  }

  // Add request to offline queue
  async addRequest(requestData) {
    if (!this.db) {
      await this.initDB();
    }

    const request = {
      ...requestData,
      id: undefined, // Let IndexedDB auto-generate
      timestamp: Date.now(),
      status: 'queued',
      retryCount: 0,
      maxRetries: 3
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const addRequest = store.add(request);

      addRequest.onsuccess = () => {
        const requestId = addRequest.result;
        console.log('[OfflineQueue] Request queued:', requestId, request.type);
        resolve(requestId);
      };

      addRequest.onerror = () => {
        console.error('[OfflineQueue] Failed to queue request:', addRequest.error);
        reject(addRequest.error);
      };
    });
  }

  // Get all queued requests
  async getQueuedRequests() {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const requests = getAllRequest.result.filter(req => req.status === 'queued');
        resolve(requests);
      };

      getAllRequest.onerror = () => {
        console.error('[OfflineQueue] Failed to get queued requests:', getAllRequest.error);
        reject(getAllRequest.error);
      };
    });
  }

  // Remove request from queue
  async removeRequest(requestId) {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const deleteRequest = store.delete(requestId);

      deleteRequest.onsuccess = () => {
        console.log('[OfflineQueue] Request removed:', requestId);
        resolve();
      };

      deleteRequest.onerror = () => {
        console.error('[OfflineQueue] Failed to remove request:', deleteRequest.error);
        reject(deleteRequest.error);
      };
    });
  }

  // Update request status
  async updateRequestStatus(requestId, status, error = null) {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getRequest = store.get(requestId);

      getRequest.onsuccess = () => {
        const request = getRequest.result;
        if (request) {
          request.status = status;
          request.lastAttempt = Date.now();
          if (error) {
            request.error = error;
            request.retryCount = (request.retryCount || 0) + 1;
          }

          const updateRequest = store.put(request);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Request not found'));
        }
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  // Process queued requests when online
  async processQueue() {
    if (!this.isOnline) {
      console.log('[OfflineQueue] Still offline, skipping queue processing');
      return;
    }

    console.log('[OfflineQueue] Processing queued requests...');
    
    try {
      const queuedRequests = await this.getQueuedRequests();
      console.log(`[OfflineQueue] Found ${queuedRequests.length} queued requests`);

      for (const request of queuedRequests) {
        try {
          await this.processRequest(request);
        } catch (error) {
          console.error('[OfflineQueue] Failed to process request:', request.id, error);
          
          // Update retry count
          if (request.retryCount < request.maxRetries) {
            await this.updateRequestStatus(request.id, 'queued', error.message);
          } else {
            await this.updateRequestStatus(request.id, 'failed', error.message);
          }
        }
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to process queue:', error);
    }
  }

  // Process individual request
  async processRequest(request) {
    console.log('[OfflineQueue] Processing request:', request.id, request.type);

    const { url, method, headers, body, type } = request;

    // Make the actual HTTP request
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Mark as completed and remove from queue
    await this.removeRequest(request.id);
    
    // Emit custom event for UI updates
    window.dispatchEvent(new CustomEvent('offlineRequestCompleted', {
      detail: {
        requestId: request.id,
        type: request.type,
        result: result
      }
    }));

    console.log('[OfflineQueue] Request completed:', request.id);
    return result;
  }

  // Handle online event
  handleOnline() {
    console.log('[OfflineQueue] Connection restored, processing queue...');
    this.isOnline = true;
    
    // Process queue after a short delay to ensure connection is stable
    setTimeout(() => {
      this.processQueue();
    }, 2000);
  }

  // Handle offline event
  handleOffline() {
    console.log('[OfflineQueue] Connection lost, entering offline mode');
    this.isOnline = false;
  }

  // Queue ride request
  async queueRideRequest(rideData, userId) {
    const requestData = {
      type: 'ride_request',
      url: '/api/rides/request',
      method: 'POST',
      body: rideData,
      userId: userId,
      priority: 'high',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('wanride_token')}`
      }
    };

    return this.addRequest(requestData);
  }

  // Queue driver location update
  async queueLocationUpdate(locationData, userId) {
    const requestData = {
      type: 'location_update',
      url: '/api/drivers/location',
      method: 'POST',
      body: locationData,
      userId: userId,
      priority: 'medium',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('wanride_token')}`
      }
    };

    return this.addRequest(requestData);
  }

  // Queue ride completion
  async queueRideCompletion(rideId, completionData, userId) {
    const requestData = {
      type: 'ride_completion',
      url: `/api/rides/${rideId}/complete`,
      method: 'POST',
      body: completionData,
      userId: userId,
      priority: 'high',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('wanride_token')}`
      }
    };

    return this.addRequest(requestData);
  }

  // Queue driver rating
  async queueDriverRating(rideId, ratingData, userId) {
    const requestData = {
      type: 'driver_rating',
      url: `/api/rides/${rideId}/rate`,
      method: 'POST',
      body: ratingData,
      userId: userId,
      priority: 'low',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('wanride_token')}`
      }
    };

    return this.addRequest(requestData);
  }

  // Get queue statistics
  async getQueueStats() {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const requests = getAllRequest.result;
        const stats = {
          total: requests.length,
          queued: requests.filter(r => r.status === 'queued').length,
          failed: requests.filter(r => r.status === 'failed').length,
          byType: {}
        };

        // Count by type
        requests.forEach(request => {
          stats.byType[request.type] = (stats.byType[request.type] || 0) + 1;
        });

        resolve(stats);
      };

      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    });
  }

  // Clear failed requests
  async clearFailedRequests() {
    if (!this.db) {
      await this.initDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const requests = getAllRequest.result;
        const failedRequests = requests.filter(r => r.status === 'failed');
        
        let deletedCount = 0;
        failedRequests.forEach(request => {
          const deleteRequest = store.delete(request.id);
          deleteRequest.onsuccess = () => {
            deletedCount++;
            if (deletedCount === failedRequests.length) {
              console.log(`[OfflineQueue] Cleared ${deletedCount} failed requests`);
              resolve(deletedCount);
            }
          };
        });

        if (failedRequests.length === 0) {
          resolve(0);
        }
      };

      getAllRequest.onerror = () => {
        reject(getAllRequest.error);
      };
    });
  }
}

// Create singleton instance
const offlineQueue = new OfflineQueue();

export default offlineQueue;
