// PWA (Progressive Web App) utilities

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.isInstalled = false;
    this.swRegistration = null;
    
    this.init();
  }

  async init() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.isInstallable = true;
      
      // Dispatch custom event for UI components
      window.dispatchEvent(new CustomEvent('pwa-installable'));
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.isInstalled = true;
      this.isInstallable = false;
      this.deferredPrompt = null;
      
      window.dispatchEvent(new CustomEvent('pwa-installed'));
    });

    // Check if app is running in standalone mode
    this.isInstalled = this.isStandalone();

    // Register service worker
    await this.registerServiceWorker();
  }

  isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw-pwa.js', {
          scope: '/'
        });
        
        console.log('PWA Service Worker registered:', this.swRegistration.scope);

        // Listen for service worker updates
        this.swRegistration.addEventListener('updatefound', () => {
          const newWorker = this.swRegistration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              window.dispatchEvent(new CustomEvent('pwa-update-available'));
            }
          });
        });

        // Check for existing controller
        if (navigator.serviceWorker.controller) {
          console.log('PWA Service Worker is controlling the page');
        }

      } catch (error) {
        console.error('PWA Service Worker registration failed:', error);
      }
    }
  }

  async install() {
    if (!this.deferredPrompt) {
      console.log('PWA install prompt not available');
      return false;
    }

    try {
      // Show the install prompt
      const result = await this.deferredPrompt.prompt();
      console.log('PWA install prompt result:', result);
      
      // Wait for user response
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log('PWA install user choice:', outcome);
      
      // Clear the deferred prompt
      this.deferredPrompt = null;
      this.isInstallable = false;
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('PWA install failed:', error);
      return false;
    }
  }

  canInstall() {
    return this.isInstallable && !this.isInstalled;
  }

  isPWA() {
    return this.isInstalled;
  }

  async checkForUpdates() {
    if (!this.swRegistration) {
      return false;
    }

    try {
      await this.swRegistration.update();
      return true;
    } catch (error) {
      console.error('PWA update check failed:', error);
      return false;
    }
  }

  async applyUpdate() {
    if (!this.swRegistration) {
      return false;
    }

    try {
      // Tell the new service worker to skip waiting
      const newWorker = this.swRegistration.waiting;
      if (newWorker) {
        newWorker.postMessage({ type: 'SKIP_WAITING' });
        
        // Wait for the new service worker to become active
        return new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('PWA updated, reloading page');
            window.location.reload();
            resolve(true);
          }, { once: true });
        });
      }
      
      return false;
    } catch (error) {
      console.error('PWA update application failed:', error);
      return false;
    }
  }

  async share(data) {
    if (navigator.share) {
      try {
        await navigator.share(data);
        return true;
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('PWA share failed:', error);
        }
        return false;
      }
    }
    return false;
  }

  async addToHomeScreen() {
    return this.install();
  }

  // Request notification permissions
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  // Subscribe to push notifications
  async subscribeToPushNotifications() {
    if (!this.swRegistration) {
      throw new Error('Service Worker not registered');
    }

    try {
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array('YOUR_VAPID_PUBLIC_KEY')
      });

      console.log('Push notification subscription:', subscription);
      return subscription;
    } catch (error) {
      console.error('Push notification subscription failed:', error);
      throw error;
    }
  }

  // Helper method to convert VAPID key
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Get device info for PWA analytics
  getDeviceInfo() {
    return {
      isStandalone: this.isStandalone(),
      isInstallable: this.canInstall(),
      isInstalled: this.isInstalled(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      pixelRatio: window.devicePixelRatio,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null
    };
  }

  // Monitor PWA performance
  monitorPerformance() {
    if ('performance' in window && 'memory' in performance) {
      const memoryInfo = {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576),
        total: Math.round(performance.memory.totalJSHeapSize / 1048576),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
      };

      console.log('PWA Memory Usage:', memoryInfo);
      
      // Warn if memory usage is high
      if (memoryInfo.used > memoryInfo.limit * 0.8) {
        console.warn('PWA high memory usage detected');
        window.dispatchEvent(new CustomEvent('pwa-high-memory-usage', { detail: memoryInfo }));
      }

      return memoryInfo;
    }
    return null;
  }

  // Handle share target for PWA
  async handleShareTarget() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('handle') === 'share') {
      const title = urlParams.get('title');
      const text = urlParams.get('text');
      const url = urlParams.get('url');
      
      window.dispatchEvent(new CustomEvent('pwa-share-target', {
        detail: { title, text, url }
      }));
      
      // Clear the share parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Handle file handling for PWA
  async handleFileTarget() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('handle') === 'file') {
      window.dispatchEvent(new CustomEvent('pwa-file-target'));
      
      // Clear the file parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}

// Create singleton instance
const pwaManager = new PWAManager();

export default pwaManager;