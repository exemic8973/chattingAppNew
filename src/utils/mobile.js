// Mobile utilities and enhancements

class MobileUtils {
  constructor() {
    this.isMobile = this.detectMobile();
    this.isTablet = this.detectTablet();
    this.isTouch = this.detectTouch();
    this.orientation = this.getOrientation();
    
    this.init();
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  }

  detectTablet() {
    return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent) ||
           (window.innerWidth > 768 && window.innerWidth <= 1024);
  }

  detectTouch() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  getOrientation() {
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  }

  init() {
    // Listen for orientation changes
    window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Add mobile-specific classes to body
    this.updateBodyClasses();
    
    // Initialize touch gestures
    if (this.isTouch) {
      this.initTouchGestures();
    }
    
    // Initialize haptic feedback
    this.initHapticFeedback();
    
    // Initialize viewport optimizations
    this.initViewportOptimizations();
  }

  handleOrientationChange() {
    this.orientation = this.getOrientation();
    this.updateBodyClasses();
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('mobile-orientation-change', {
      detail: { orientation: this.orientation }
    }));
  }

  handleResize() {
    const wasMobile = this.isMobile;
    const wasTablet = this.isTablet;
    
    this.isMobile = this.detectMobile();
    this.isTablet = this.detectTablet();
    
    if (wasMobile !== this.isMobile || wasTablet !== this.isTablet) {
      this.updateBodyClasses();
    }
  }

  updateBodyClasses() {
    const body = document.body;
    
    // Remove existing classes
    body.classList.remove('mobile', 'tablet', 'desktop', 'touch', 'no-touch', 'portrait', 'landscape');
    
    // Add current classes
    if (this.isMobile) {
      body.classList.add('mobile');
    } else if (this.isTablet) {
      body.classList.add('tablet');
    } else {
      body.classList.add('desktop');
    }
    
    if (this.isTouch) {
      body.classList.add('touch');
    } else {
      body.classList.add('no-touch');
    }
    
    body.classList.add(this.orientation);
  }

  initTouchGestures() {
    // Add swipe gestures support
    this.addSwipeGestures();
    
    // Add long press support
    this.addLongPressSupport();
    
    // Add pinch to zoom support (where appropriate)
    this.addPinchToZoom();
  }

  addSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, false);

    document.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      this.handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
    }, false);
  }

  handleSwipe(startX, startY, endX, endY) {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const minSwipeDistance = 50;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          window.dispatchEvent(new CustomEvent('mobile-swipe-right'));
        } else {
          window.dispatchEvent(new CustomEvent('mobile-swipe-left'));
        }
      }
    } else {
      if (Math.abs(deltaY) > minSwipeDistance) {
        if (deltaY > 0) {
          window.dispatchEvent(new CustomEvent('mobile-swipe-down'));
        } else {
          window.dispatchEvent(new CustomEvent('mobile-swipe-up'));
        }
      }
    }
  }

  addLongPressSupport() {
    let pressTimer;
    let longPressTriggered = false;

    document.addEventListener('touchstart', (e) => {
      const target = e.target.closest('[data-long-press]');
      if (!target) return;

      longPressTriggered = false;
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        target.dispatchEvent(new CustomEvent('mobile-long-press', {
          bubbles: true,
          detail: { target }
        }));
      }, 500);
    });

    document.addEventListener('touchend', () => {
      clearTimeout(pressTimer);
    });

    document.addEventListener('touchmove', () => {
      clearTimeout(pressTimer);
    });
  }

  addPinchToZoom() {
    let initialDistance = 0;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialDistance = this.getDistance(e.touches[0], e.touches[1]);
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialDistance;
        
        window.dispatchEvent(new CustomEvent('mobile-pinch', {
          detail: { scale, initialDistance, currentDistance }
        }));
      }
    });
  }

  getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  initHapticFeedback() {
    // Check if haptic feedback is supported
    this.hapticSupported = 'vibrate' in navigator;
  }

  triggerHaptic(type = 'light') {
    if (!this.hapticSupported) return;

    const patterns = {
      light: [10],
      medium: [50],
      heavy: [100],
      success: [50, 50, 50],
      error: [100, 50, 100],
      warning: [50],
      notification: [25, 25, 25]
    };

    if (patterns[type]) {
      navigator.vibrate(patterns[type]);
    }
  }

  initViewportOptimizations() {
    // Set proper viewport height for mobile browsers
    this.setViewportHeight();
    
    // Handle virtual keyboard
    this.handleVirtualKeyboard();
    
    // Optimize scrolling performance
    this.optimizeScrolling();
  }

  setViewportHeight() {
    const setHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setHeight();
    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);
  }

  handleVirtualKeyboard() {
    let initialViewportHeight = window.innerHeight;

    window.addEventListener('resize', () => {
      const currentViewportHeight = window.innerHeight;
      const heightDifference = initialViewportHeight - currentViewportHeight;
      
      if (heightDifference > 150) {
        // Virtual keyboard is likely open
        document.body.classList.add('virtual-keyboard-open');
        window.dispatchEvent(new CustomEvent('mobile-keyboard-open'));
      } else {
        // Virtual keyboard is likely closed
        document.body.classList.remove('virtual-keyboard-open');
        window.dispatchEvent(new CustomEvent('mobile-keyboard-close'));
      }
    });
  }

  optimizeScrolling() {
    if (this.isTouch) {
      // Enable smooth scrolling with momentum
      document.body.style.webkitOverflowScrolling = 'touch';
      
      // Prevent overscroll bounce on iOS
      document.body.addEventListener('touchmove', (e) => {
        if (e.target === document.body) {
          e.preventDefault();
        }
      }, { passive: false });
    }
  }

  // Mobile-specific utilities
  shareContent(data) {
    if (navigator.share && this.isMobile) {
      return navigator.share(data);
    }
    return Promise.reject(new Error('Web Share API not supported'));
  }

  copyToClipboard(text) {
    if (navigator.clipboard) {
      return navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }

  // Mobile performance optimizations
  optimizeImages() {
    if (!this.isMobile) return;

    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });

    images.forEach(img => imageObserver.observe(img));
  }

  // Mobile-specific UI helpers
  scrollToTop(smooth = true) {
    if (smooth && this.isMobile) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      window.scrollTo(0, 0);
    }
  }

  hideAddressBar() {
    if (this.isMobile) {
      setTimeout(() => {
        window.scrollTo(0, 1);
      }, 0);
    }
  }

  // Mobile detection utilities
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  isAndroid() {
    return /Android/.test(navigator.userAgent);
  }

  isSafari() {
    return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  }

  isChrome() {
    return /Chrome/.test(navigator.userAgent);
  }

  getMobileOS() {
    if (this.isIOS()) return 'ios';
    if (this.isAndroid()) return 'android';
    return 'unknown';
  }

  getBrowser() {
    if (this.isSafari()) return 'safari';
    if (this.isChrome()) return 'chrome';
    return 'unknown';
  }
}

// Create singleton instance
const mobileUtils = new MobileUtils();

export default mobileUtils;