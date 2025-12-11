import React from 'react';
import { useTheme } from '../context/ThemeContext';

const Header = ({ channelName, onVideoCall, onVoiceCall, onInviteUser, onLeaveChannel, onKickUser, onSearch, onProfile, onLogout, userAvatar, username, isChannel, isHost }) => {
    const { isDarkMode, toggleTheme } = useTheme();

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
                    title="Search Messages"
                >
                    🔍
                </button>
                <button
                    className="action-btn theme-toggle"
                    onClick={toggleTheme}
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isDarkMode ? '☀️' : '🌙'}
                </button>
                <button className="action-btn" onClick={onVoiceCall} title="Voice Call">
                    🎤
                </button>
                <button className="action-btn" onClick={onVideoCall} title="Video Call">
                    📹
                </button>
                {isChannel && (
                    <button className="action-btn" onClick={onInviteUser} title="Invite User">
                        ➕👤
                    </button>
                )}
                {isChannel && isHost && (
                    <button
                        className="action-btn"
                        onClick={onKickUser}
                        title="Kick User"
                        style={{ color: '#ff9f43' }}
                    >
                        👢
                    </button>
                )}
                {isChannel && (
                    <button
                        className="action-btn"
                        onClick={onLeaveChannel}
                        title="Leave Channel"
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
                    title="Profile Settings"
                >
                    {!userAvatar && username?.[0]?.toUpperCase()}
                </div>
                <button
                    className="action-btn"
                    onClick={onLogout}
                    title="Logout"
                    style={{ color: '#ff6b6b' }}
                >
                    🚪
                </button>
            </div>
        </div>
    );
};

export default Header;
