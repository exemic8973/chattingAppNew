import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import pwaManager from '../utils/pwa.js';

const InstallPrompt = () => {
  const { t } = useI18n();
  const [canInstall, setCanInstall] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Check if PWA can be installed
    setCanInstall(pwaManager.canInstall());

    // Listen for installable event
    const handleInstallable = () => {
      setCanInstall(true);
      
      // Show prompt after a delay
      setTimeout(() => {
        if (!dismissed) {
          setShowPrompt(true);
        }
      }, 3000);
    };

    // Listen for installed event
    const handleInstalled = () => {
      setCanInstall(false);
      setShowPrompt(false);
    };

    // Listen for update available event
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true);
    };

    window.addEventListener('pwa-installable', handleInstallable);
    window.addEventListener('pwa-installed', handleInstalled);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    // Check if user has dismissed the prompt before
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        setDismissed(true);
      }
    }

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
      window.removeEventListener('pwa-installed', handleInstalled);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, [dismissed]);

  const handleInstall = async () => {
    setIsInstalling(true);
    
    try {
      const success = await pwaManager.install();
      
      if (success) {
        setShowPrompt(false);
        // You could show a success message here
      } else {
        // Installation was cancelled or failed
      }
    } catch (error) {
      console.error('PWA installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      await pwaManager.applyUpdate();
    } catch (error) {
      console.error('PWA update failed:', error);
      setIsUpdating(false);
    }
  };

  const handleRemindLater = () => {
    setShowPrompt(false);
    // Show again after 1 hour
    setTimeout(() => {
      if (canInstall && !dismissed) {
        setShowPrompt(true);
      }
    }, 60 * 60 * 1000);
  };

  // Don't render anything if PWA is already installed or no update available
  if (!canInstall && !updateAvailable) {
    return null;
  }

  // Update notification
  if (updateAvailable) {
    return (
      <div className="pwa-update-notification">
        <div className="pwa-update-content">
          <div className="pwa-update-icon">🔄</div>
          <div className="pwa-update-text">
            <h4>{t('pwa.updateAvailable')}</h4>
            <p>{t('pwa.updateDescription')}</p>
          </div>
          <div className="pwa-update-actions">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="pwa-update-button"
            >
              {isUpdating ? t('pwa.updating') : t('pwa.updateNow')}
            </button>
            <button
              onClick={() => setUpdateAvailable(false)}
              className="pwa-update-dismiss"
            >
              {t('common.dismiss')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Install prompt
  if (!showPrompt) {
    return null;
  }

  return (
    <div className="pwa-install-prompt">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">📱</div>
        <div className="pwa-install-text">
          <h4>{t('pwa.installTitle')}</h4>
          <p>{t('pwa.installDescription')}</p>
          <ul className="pwa-install-features">
            <li>{t('pwa.featureOffline')}</li>
            <li>{t('pwa.featureNotifications')}</li>
            <li>{t('pwa.featureFaster')}</li>
          </ul>
        </div>
        <div className="pwa-install-actions">
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="pwa-install-button"
          >
            {isInstalling ? t('pwa.installing') : t('pwa.installNow')}
          </button>
          <button
            onClick={handleRemindLater}
            className="pwa-install-remind"
          >
            {t('pwa.remindLater')}
          </button>
          <button
            onClick={handleDismiss}
            className="pwa-install-dismiss"
          >
            {t('common.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;