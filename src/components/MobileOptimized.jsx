import React, { useEffect, useState } from 'react';
import mobileUtils from '../utils/mobile.js';

const MobileOptimized = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // Handle mobile-specific events
    const handleSwipeLeft = () => {
      if (mobileUtils.isMobile) {
        // Open sidebar or navigation
        setIsMobileMenuOpen(true);
      }
    };

    const handleSwipeRight = () => {
      if (mobileUtils.isMobile) {
        // Close sidebar or navigation
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyboardOpen = () => {
      setIsKeyboardOpen(true);
    };

    const handleKeyboardClose = () => {
      setIsKeyboardOpen(false);
    };

    const handleLongPress = (e) => {
      const target = e.detail.target;
      
      // Add context menu or additional actions
      if (target.classList.contains('message-bubble')) {
        mobileUtils.triggerHaptic('medium');
        // Show message context menu
        target.classList.add('context-menu-active');
      }
    };

    // Add event listeners
    window.addEventListener('mobile-swipe-left', handleSwipeLeft);
    window.addEventListener('mobile-swipe-right', handleSwipeRight);
    window.addEventListener('mobile-keyboard-open', handleKeyboardOpen);
    window.addEventListener('mobile-keyboard-close', handleKeyboardClose);
    document.addEventListener('mobile-long-press', handleLongPress);

    // Initialize mobile optimizations
    mobileUtils.optimizeImages();
    mobileUtils.hideAddressBar();

    return () => {
      window.removeEventListener('mobile-swipe-left', handleSwipeLeft);
      window.removeEventListener('mobile-swipe-right', handleSwipeRight);
      window.removeEventListener('mobile-keyboard-open', handleKeyboardOpen);
      window.removeEventListener('mobile-keyboard-close', handleKeyboardClose);
      document.removeEventListener('mobile-long-press', handleLongPress);
    };
  }, []);

  // Mobile-specific CSS classes
  const mobileClasses = [
    mobileUtils.isMobile && 'mobile-optimized',
    mobileUtils.isTablet && 'tablet-optimized',
    mobileUtils.isTouch && 'touch-optimized',
    isKeyboardOpen && 'keyboard-open',
    isMobileMenuOpen && 'mobile-menu-open'
  ].filter(Boolean).join(' ');

  return (
    <div className={`mobile-wrapper ${mobileClasses}`}>
      {/* Mobile-specific UI elements */}
      {mobileUtils.isMobile && (
        <>
          {/* Mobile navigation overlay */}
          {isMobileMenuOpen && (
            <div 
              className="mobile-nav-overlay"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Mobile action buttons */}
          <div className="mobile-action-buttons">
            <button
              className="mobile-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>

          {/* Mobile floating action button */}
          <div className="mobile-fab">
            <button
              className="fab-button"
              onClick={() => {
                mobileUtils.triggerHaptic('light');
                // Quick action (new message, etc.)
              }}
            >
              ✏️
            </button>
          </div>
        </>
      )}

      {/* Main content with mobile optimizations */}
      <div className="mobile-content">
        {React.Children.map(children, child => {
          // Add mobile-specific props to children
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              isMobile: mobileUtils.isMobile,
              isTablet: mobileUtils.isTablet,
              isTouch: mobileUtils.isTouch,
              triggerHaptic: mobileUtils.triggerHaptic.bind(mobileUtils),
              shareContent: mobileUtils.shareContent.bind(mobileUtils),
              copyToClipboard: mobileUtils.copyToClipboard.bind(mobileUtils)
            });
          }
          return child;
        })}
      </div>

      <style jsx>{`
        .mobile-wrapper {
          position: relative;
          height: 100vh;
          overflow: hidden;
        }

        .mobile-wrapper.mobile-optimized {
          /* Mobile-specific optimizations */
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }

        .mobile-wrapper.touch-optimized {
          /* Touch-specific optimizations */
          touch-action: manipulation;
          -webkit-overflow-scrolling: touch;
        }

        .mobile-nav-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          opacity: 0;
          animation: fadeIn 0.3s forwards;
        }

        .mobile-action-buttons {
          position: fixed;
          top: 1rem;
          left: 1rem;
          z-index: 1001;
        }

        .mobile-menu-toggle {
          background: var(--glass-bg);
          border: var(--glass-border);
          border-radius: 8px;
          padding: 0.5rem;
          font-size: 1.2rem;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mobile-menu-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .mobile-fab {
          position: fixed;
          bottom: 2rem;
          right: 1rem;
          z-index: 1001;
        }

        .fab-button {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--accent-color);
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          transition: all 0.3s ease;
        }

        .fab-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
        }

        .fab-button:active {
          transform: scale(0.95);
        }

        .mobile-content {
          height: 100%;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        }

        .mobile-wrapper.keyboard-open {
          /* Adjust layout when keyboard is open */
        }

        .mobile-wrapper.keyboard-open .mobile-content {
          height: calc(100vh - var(--keyboard-height, 300px));
        }

        .mobile-wrapper.mobile-menu-open .sidebar {
          transform: translateX(0);
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }

        /* Mobile-specific responsive styles */
        @media (max-width: 768px) {
          .mobile-wrapper {
            font-size: 16px; /* Prevent zoom on iOS */
          }
          
          .mobile-action-buttons {
            top: 0.5rem;
            left: 0.5rem;
          }
          
          .mobile-fab {
            bottom: 1rem;
            right: 0.5rem;
          }
        }

        /* Tablet-specific styles */
        @media (min-width: 769px) and (max-width: 1024px) {
          .mobile-wrapper.tablet-optimized {
            /* Tablet-specific optimizations */
          }
        }

        /* Touch-specific styles */
        .touch-optimized button,
        .touch-optimized .clickable {
          min-height: 44px; /* Minimum touch target size */
          min-width: 44px;
        }

        /* Haptic feedback visual indicators */
        .haptic-indicator {
          position: fixed;
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 255, 255, 0.9);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.8rem;
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .haptic-indicator.show {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default MobileOptimized;