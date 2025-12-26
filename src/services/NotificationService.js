class NotificationService {
  constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = 'default';
    this.swRegistration = null;
  }

  async initialize() {
    if (!this.isSupported) {
      console.warn('Notifications are not supported in this browser');
      return false;
    }

    // Get current permission
    this.permission = Notification.permission;

    // Register service worker for push notifications
    if ('serviceWorker' in navigator) {
      try {
        this.swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered for notifications');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    return true;
  }

  async requestPermission() {
    if (!this.isSupported) {
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  async showNotification(title, options = {}) {
    if (!this.isSupported || this.permission !== 'granted') {
      return false;
    }

    const defaultOptions = {
      icon: '/vite.svg',
      badge: '/vite.svg',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);

      // Auto-close after 5 seconds unless requireInteraction is true
      if (!defaultOptions.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      // Handle click events
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Custom click handler if provided
        if (options.onClick) {
          options.onClick();
        }
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }

  async showMessageNotification(sender, message, channelId, isMentioned = false) {
    const title = isMentioned 
      ? `${sender} mentioned you in chat`
      : `New message from ${sender}`;

    const options = {
      body: this.truncateMessage(message.text, 100),
      tag: `message-${channelId}`,
      renotify: true,
      icon: sender.avatar || '/vite.svg',
      onClick: () => {
        // Focus the window and navigate to the channel
        window.focus();
        // This would trigger a navigation to the specific channel
        window.dispatchEvent(new CustomEvent('navigateToChannel', { 
          detail: { channelId } 
        }));
      }
    };

    return this.showNotification(title, options);
  }

  async showChannelNotification(channelName, sender, message, isMentioned = false) {
    const title = isMentioned
      ? `Mentioned in #${channelName}`
      : `New message in #${channelName}`;

    const options = {
      body: `${sender}: ${this.truncateMessage(message.text, 100)}`,
      tag: `channel-${channelName}`,
      renotify: true,
      onClick: () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('navigateToChannel', { 
          detail: { channelName } 
        }));
      }
    };

    return this.showNotification(title, options);
  }

  async showCallNotification(caller, isVideo = true) {
    const title = `Incoming ${isVideo ? 'video' : 'voice'} call`;
    const options = {
      body: `${caller} is calling you`,
      tag: 'call-incoming',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      actions: [
        {
          action: 'accept',
          title: 'Accept'
        },
        {
          action: 'decline',
          title: 'Decline'
        }
      ],
      onClick: () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('acceptCall', { 
          detail: { caller, isVideo } 
        }));
      }
    };

    return this.showNotification(title, options);
  }

  async showSystemNotification(message) {
    return this.showNotification('System Notification', {
      body: message,
      tag: 'system',
      icon: '/vite.svg'
    });
  }

  truncateMessage(text, maxLength) {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  getPermissionStatus() {
    return this.permission;
  }

  isPermissionGranted() {
    return this.permission === 'granted';
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;