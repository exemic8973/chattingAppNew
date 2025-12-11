import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import LanguageSwitcher from './LanguageSwitcher';

const Header = ({ channelName, onVideoCall, onVoiceCall, onInviteUser, onLeaveChannel, onKickUser, onDeleteChannel, onSearch, onProfile, onLogout, userAvatar, username, isChannel, isHost }) => {
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
                <button className="action-btn" onClick={onVoiceCall} title={t('header.voiceCall')}>
                    🎤
                </button>
                <button className="action-btn" onClick={onVideoCall} title={t('header.videoCall')}>
                    📹
                </button>
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
