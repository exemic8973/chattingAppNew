import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import notificationService from '../services/NotificationService';

const NotificationSettings = ({ onClose, onSave }) => {
  const { t } = useI18n();
  const [settings, setSettings] = useState({
    enabled: false,
    messageNotifications: true,
    mentionNotifications: true,
    callNotifications: true,
    channelNotifications: false,
    soundEnabled: true,
    vibrationEnabled: true,
    desktopNotifications: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('default');

  useEffect(() => {
    loadSettings();
    checkPermissionStatus();
  }, []);

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  };

  const checkPermissionStatus = async () => {
    const status = notificationService.getPermissionStatus();
    setPermissionStatus(status);
  };

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    
    try {
      const granted = await notificationService.requestPermission();
      if (granted) {
        await notificationService.initialize();
        setSettings(prev => ({ ...prev, enabled: true }));
        setPermissionStatus('granted');
      } else {
        setPermissionStatus('denied');
      }
    } catch (error) {
      console.error('Failed to enable notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableNotifications = () => {
    setSettings(prev => ({ ...prev, enabled: false }));
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
    onSave?.(settings);
    onClose();
  };

  const testNotification = async () => {
    if (settings.enabled) {
      await notificationService.showSystemNotification('Test notification from Chat App!');
    }
  };

  return (
    <div className="notification-settings" style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'var(--surface-color)',
      borderRadius: '12px',
      padding: '24px',
      minWidth: '400px',
      maxWidth: '500px',
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, color: 'var(--text-color)' }}>
          {t('notifications.title', 'Notification Settings')}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1.5rem'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--glass-bg)',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ color: 'var(--text-color)' }}>
              {t('notifications.status', 'Status')}:
            </span>
            <span style={{
              color: permissionStatus === 'granted' ? '#4caf50' : 
                     permissionStatus === 'denied' ? '#f44336' : '#ff9800',
              fontWeight: 'bold'
            }}>
              {permissionStatus === 'granted' ? t('notifications.enabled', 'Enabled') :
               permissionStatus === 'denied' ? t('notifications.disabled', 'Disabled') :
               t('notifications.notRequested', 'Not Requested')}
            </span>
          </div>
          
          {permissionStatus !== 'granted' && (
            <button
              onClick={handleEnableNotifications}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {isLoading ? t('common.loading', 'Loading...') : t('notifications.enable', 'Enable Notifications')}
            </button>
          )}
        </div>

        {settings.enabled && (
          <>
            {/* Notification Types */}
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-color)', fontSize: '1rem' }}>
                {t('notifications.types', 'Notification Types')}
              </h3>
              
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={settings.messageNotifications}
                  onChange={(e) => handleSettingChange('messageNotifications', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: 'var(--text-color)' }}>
                  {t('notifications.privateMessages', 'Private Messages')}
                </span>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={settings.mentionNotifications}
                  onChange={(e) => handleSettingChange('mentionNotifications', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: 'var(--text-color)' }}>
                  {t('notifications.mentions', 'Mentions (@username)')}
                </span>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={settings.callNotifications}
                  onChange={(e) => handleSettingChange('callNotifications', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: 'var(--text-color)' }}>
                  {t('notifications.calls', 'Voice/Video Calls')}
                </span>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={settings.channelNotifications}
                  onChange={(e) => handleSettingChange('channelNotifications', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: 'var(--text-color)' }}>
                  {t('notifications.channelMessages', 'Channel Messages')}
                </span>
              </label>
            </div>

            {/* Notification Methods */}
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-color)', fontSize: '1rem' }}>
                {t('notifications.methods', 'Notification Methods')}
              </h3>
              
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={settings.desktopNotifications}
                  onChange={(e) => handleSettingChange('desktopNotifications', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: 'var(--text-color)' }}>
                  {t('notifications.desktop', 'Desktop Notifications')}
                </span>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => handleSettingChange('soundEnabled', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: 'var(--text-color)' }}>
                  {t('notifications.sound', 'Sound')}
                </span>
              </label>

              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={settings.vibrationEnabled}
                  onChange={(e) => handleSettingChange('vibrationEnabled', e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <span style={{ color: 'var(--text-color)' }}>
                  {t('notifications.vibration', 'Vibration (Mobile)')}
                </span>
              </label>
            </div>

            {/* Test Button */}
            <button
              onClick={testNotification}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'transparent',
                color: 'var(--accent-color)',
                border: '1px solid var(--accent-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                marginBottom: '16px'
              }}
            >
              {t('notifications.test', 'Test Notification')}
            </button>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--glass-border)',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--accent-color)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {t('common.save', 'Save')}
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;