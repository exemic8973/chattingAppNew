import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import LanguageSwitcher from './LanguageSwitcher';

const Header = ({ channelName, onVideoCall, onVoiceCall, onJoinVoice, showVoiceChannel, onInviteUser, onLeaveChannel, onKickUser, onDeleteChannel, onSearch, onProfile, onLogout, onNotificationSettings, userAvatar, username, isChannel, isHost, onSoulVoiceRoom, onSoulManager, onSoulRecommendations, onAdmin, isAdmin }) => {
    const { isDarkMode, toggleTheme } = useTheme();
    const { t } = useI18n();

    return (
        <div className="chat-header">
            <div className="channel-info">
                <span className="channel-hash">{isChannel ? '#' : '@'}</span>
                <h3 className="channel-name">{channelName}</h3>
            </div>
            <div className="header-actions">
                <button
                    className="action-btn"
                    onClick={onSearch}
                    title={t('header.search')}
                >
                    🔍
                </button>
                <LanguageSwitcher />
                <button
                    className="action-btn theme-toggle"
                    onClick={toggleTheme}
                    title={isDarkMode ? t('header.switchToLight') : t('header.switchToDark')}
                >
                    {isDarkMode ? '☀️' : '🌙'}
                </button>
                {isChannel ? (
                    <button
                        className="action-btn"
                        onClick={onJoinVoice}
                        title={showVoiceChannel ? t('header.leaveVoice') : t('header.joinVoice')}
                        style={{
                            background: showVoiceChannel ? 'var(--accent-color)' : 'transparent',
                            color: showVoiceChannel ? 'white' : 'inherit'
                        }}
                    >
                        {showVoiceChannel ? '🎤✓' : '🎤'}
                    </button>
                ) : (
                    <>
                        <button className="action-btn" onClick={onVoiceCall} title={t('header.voiceCall')}>
                            🎤
                        </button>
                        <button className="action-btn" onClick={onVideoCall} title={t('header.videoCall')}>
                            📹
                        </button>
                    </>
                )}
                {isChannel && (
                    <button className="action-btn" onClick={onInviteUser} title={t('header.inviteUser')}>
                        ➕👤
                    </button>
                )}
                {isChannel && isHost && (
                    <>
                        <button
                            className="action-btn"
                            onClick={onKickUser}
                            title={t('header.kickUser')}
                            style={{ color: '#ff9f43' }}
                        >
                            👢
                        </button>
                        <button
                            className="action-btn"
                            onClick={onDeleteChannel}
                            title={t('header.deleteChannel')}
                            style={{ color: '#ff4757' }}
                        >
                            🗑️
                        </button>
                    </>
                )}
                {isChannel && (
                    <button
                        className="action-btn"
                        onClick={onLeaveChannel}
                        title={t('header.leaveChannel')}
                        style={{ color: '#ff6b6b' }}
                    >
                        🚪
                    </button>
                )}
                <div
                    className="user-avatar"
                    onClick={onProfile}
                    style={{
                        cursor: 'pointer',
                        background: userAvatar ? `url(${userAvatar}) center/cover` : 'var(--accent-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title={t('header.profile')}
                >
                    {!userAvatar && username?.[0]?.toUpperCase()}
                </div>
                {isAdmin && (
                    <button
                        className="action-btn"
                        onClick={onAdmin}
                        title={t('header.adminPanel')}
                        style={{ color: '#9b59b6' }}
                    >
                        🔧
                    </button>
                )}
                <button
                    className="action-btn"
                    onClick={onNotificationSettings}
                    title={t('notifications.title', 'Notification Settings')}
                >
                    🔔
                </button>
                {onSoulVoiceRoom && (
                    <button className="header-btn soul-btn" onClick={onSoulVoiceRoom} title="Soul Voice Rooms">
                      🎭
                    </button>
                  )}
                  {onSoulRecommendations && (
                    <button className="header-btn soul-btn" onClick={onSoulRecommendations} title="Discover Rooms">
                      🌟
                    </button>
                  )}
                  {onSoulManager && (
                    <button className="header-btn soul-btn" onClick={onSoulManager} title="My Soul Rooms">
                      🏠
                    </button>
                  )}
                <button
                    className="action-btn"
                    onClick={onSoulVoiceRoom}
                    title="Soul Voice Room"
                >
                    🎵
                </button>
                <button
                    className="action-btn"
                    onClick={onSoulManager}
                    title="Soul Manager"
                >
                    👥
                </button>
                <button
                    className="action-btn"
                    onClick={onSoulRecommendations}
                    title="Soul Recommendations"
                >
                    💡
                </button>
                <button
                    className="action-btn"
                    onClick={onLogout}
                    title={t('header.logout')}
                    style={{ color: '#ff6b6b' }}
                >
                    🚪
                </button>
            </div>
        </div>
    );
};

export default Header;
