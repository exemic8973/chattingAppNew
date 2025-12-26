import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

const AdminPanel = ({ onClose, socket, currentUser }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    totalMessages: 0,
    totalChannels: 0,
    serverUptime: '0h 0m'
  });
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [logs, setLogs] = useState([]);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [muteDuration, setMuteDuration] = useState('60');

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAdminData = async () => {
    try {
      // Request admin data from server
      socket.emit('admin_get_stats');
      socket.emit('admin_get_users');
      socket.emit('admin_get_channels');
      socket.emit('admin_get_logs');
      socket.emit('admin_get_banned_users');
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  };

  useEffect(() => {
    // Listen for admin data responses
    socket.on('admin_stats', setStats);
    socket.on('admin_users', setUsers);
    socket.on('admin_channels', setChannels);
    socket.on('admin_logs', setLogs);
    socket.on('admin_banned_users', setBannedUsers);

    return () => {
      socket.off('admin_stats');
      socket.off('admin_users');
      socket.off('admin_channels');
      socket.off('admin_logs');
      socket.off('admin_banned_users');
    };
  }, [socket]);

  const handleBanUser = () => {
    if (selectedUser && banReason) {
      socket.emit('admin_ban_user', {
        username: selectedUser.username,
        reason: banReason,
        duration: -1 // Permanent ban
      });
      setBanReason('');
      setSelectedUser(null);
    }
  };

  const handleMuteUser = (username, duration) => {
    socket.emit('admin_mute_user', {
      username,
      duration: parseInt(duration) * 60 // Convert minutes to seconds
    });
  };

  const handleUnbanUser = (username) => {
    socket.emit('admin_unban_user', { username });
  };

  const handleDeleteChannel = (channelId) => {
    if (confirm('Are you sure you want to delete this channel? This action cannot be undone.')) {
      socket.emit('admin_delete_channel', { channelId });
    }
  };

  const handleAnnouncement = (message) => {
    socket.emit('admin_announcement', { message });
  };

  const renderOverview = () => (
    <div className="admin-overview">
      <h3>{t('admin.overview', 'Server Overview')}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'var(--glass-bg)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{stats.totalUsers}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{t('admin.totalUsers', 'Total Users')}</div>
        </div>
        <div style={{ backgroundColor: 'var(--glass-bg)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#4caf50' }}>{stats.onlineUsers}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{t('admin.onlineUsers', 'Online Users')}</div>
        </div>
        <div style={{ backgroundColor: 'var(--glass-bg)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff9800' }}>{stats.totalMessages}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{t('admin.totalMessages', 'Total Messages')}</div>
        </div>
        <div style={{ backgroundColor: 'var(--glass-bg)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2196f3' }}>{stats.totalChannels}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{t('admin.totalChannels', 'Total Channels')}</div>
        </div>
      </div>
      
      <div style={{ backgroundColor: 'var(--glass-bg)', padding: '16px', borderRadius: '8px' }}>
        <h4>{t('admin.serverUptime', 'Server Uptime')}</h4>
        <div style={{ fontSize: '1.2rem' }}>{stats.serverUptime}</div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <h4>{t('admin.quickActions', 'Quick Actions')}</h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleAnnouncement('Server maintenance in 5 minutes')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {t('admin.scheduleMaintenance', 'Schedule Maintenance')}
          </button>
          <button
            onClick={() => socket.emit('admin_restart_warning')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {t('admin.restartWarning', 'Restart Warning')}
          </button>
        </div>
      </div>
    </div>
  );

  const renderUserManagement = () => (
    <div className="admin-users">
      <h3>{t('admin.userManagement', 'User Management')}</h3>
      
      <div style={{ marginBottom: '24px' }}>
        <h4>{t('admin.onlineUsers', 'Online Users')}</h4>
        <div style={{ maxHeight: '300px', overflow: 'auto', backgroundColor: 'var(--glass-bg)', borderRadius: '8px' }}>
          {users.filter(user => user.status === 'online').map(user => (
            <div key={user.id} style={{
              padding: '12px',
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{user.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {t('admin.lastSeen', 'Last seen')}: {user.lastSeen || 'Now'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => handleMuteUser(user.name, muteDuration)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {t('admin.mute', 'Mute')}
                </button>
                <button
                  onClick={() => setSelectedUser(user)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {t('admin.ban', 'Ban')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4>{t('admin.bannedUsers', 'Banned Users')}</h4>
        <div style={{ maxHeight: '300px', overflow: 'auto', backgroundColor: 'var(--glass-bg)', borderRadius: '8px' }}>
          {bannedUsers.map(user => (
            <div key={user.username} style={{
              padding: '12px',
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{user.username}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {t('admin.reason', 'Reason')}: {user.reason}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {t('admin.bannedOn', 'Banned on')}: {new Date(user.bannedAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => handleUnbanUser(user.username)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {t('admin.unban', 'Unban')}
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedUser && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--surface-color)',
          padding: '24px',
          borderRadius: '12px',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          <h4>{t('admin.banUser', 'Ban User')}: {selectedUser.name}</h4>
          <input
            type="text"
            placeholder={t('admin.banReason', 'Ban reason')}
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              margin: '16px 0',
              backgroundColor: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'inherit'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setSelectedUser(null)}
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
              onClick={handleBanUser}
              disabled={!banReason.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: banReason.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              {t('admin.confirmBan', 'Confirm Ban')}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderChannelManagement = () => (
    <div className="admin-channels">
      <h3>{t('admin.channelManagement', 'Channel Management')}</h3>
      <div style={{ maxHeight: '500px', overflow: 'auto', backgroundColor: 'var(--glass-bg)', borderRadius: '8px' }}>
        {channels.map(channel => (
          <div key={channel.id} style={{
            padding: '16px',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>#{channel.name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {t('admin.host', 'Host')}: {channel.host}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {t('admin.members', 'Members')}: {channel.memberCount || 0}
              </div>
              {channel.hasPasscode && (
                <div style={{ fontSize: '0.8rem', color: '#ff9800' }}>
                  🔒 {t('admin.private', 'Private')}
                </div>
              )}
            </div>
            <button
              onClick={() => handleDeleteChannel(channel.id)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {t('admin.delete', 'Delete')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="admin-logs">
      <h3>{t('admin.systemLogs', 'System Logs')}</h3>
      <div style={{ maxHeight: '500px', overflow: 'auto', backgroundColor: 'var(--glass-bg)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {logs.map((log, index) => (
          <div key={index} style={{
            padding: '8px',
            borderBottom: '1px solid var(--glass-border)',
            color: log.level === 'error' ? '#f44336' : log.level === 'warn' ? '#ff9800' : 'inherit'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              [{new Date(log.timestamp).toLocaleString()}]
            </span>
            <span style={{ margin: '0 8px', fontWeight: 'bold' }}>
              [{log.level.toUpperCase()}]
            </span>
            <span>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="admin-panel" style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'var(--surface-color)',
      borderRadius: '12px',
      padding: '24px',
      minWidth: '800px',
      maxWidth: '1200px',
      height: '80vh',
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, color: 'var(--text-color)' }}>
          {t('admin.adminPanel', 'Admin Panel')}
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

      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '20px' }}>
        {['overview', 'users', 'channels', 'logs'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              backgroundColor: activeTab === tab ? 'var(--accent-color)' : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            {t(`admin.${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && renderUserManagement()}
        {activeTab === 'channels' && renderChannelManagement()}
        {activeTab === 'logs' && renderLogs()}
      </div>
    </div>
  );
};

export default AdminPanel;