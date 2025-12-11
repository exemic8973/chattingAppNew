import React, { useState } from 'react';
import './ChannelMembers.css';

const ChannelMembers = ({ members, currentUser, isHost, isHostAssist, onKickUser, onMakeHost, onMakeHostAssist }) => {
    const [selectedUser, setSelectedUser] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

    const handleUserClick = (user, event) => {
        // If clicking on self, open profile modal (handled by parent)
        if (user.username === currentUser) {
            // Could emit an event here or pass a callback
            return;
        }

        // Only host or host-assist can manage other users
        if (!isHost && !isHostAssist) {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        setMenuPosition({
            x: rect.left,
            y: rect.bottom + 5
        });
        setSelectedUser(user);
        setShowMenu(true);
    };

    const handleAction = (action) => {
        if (!selectedUser) return;

        switch (action) {
            case 'kick':
                if (onKickUser) {
                    onKickUser(selectedUser.username);
                }
                break;
            case 'makeHost':
                if (onMakeHost) {
                    onMakeHost(selectedUser.username);
                }
                break;
            case 'makeHostAssist':
                if (onMakeHostAssist) {
                    onMakeHostAssist(selectedUser.username);
                }
                break;
            default:
                break;
        }
        setShowMenu(false);
        setSelectedUser(null);
    };

    const handleClickOutside = () => {
        setShowMenu(false);
        setSelectedUser(null);
    };

    return (
        <>
            <div className="channel-members">
                <div className="members-header">
                    <h4>Members ({members.length})</h4>
                </div>
                <div className="members-list">
                    {members.map((member) => (
                        <div
                            key={member.username}
                            className={`member-item ${(isHost || isHostAssist) && member.username !== currentUser ? 'clickable' : ''}`}
                            onClick={(e) => handleUserClick(member, e)}
                            title={(isHost || isHostAssist) && member.username !== currentUser ? 'Click to manage user' : member.username}
                        >
                            <div className={`member-avatar-wrapper ${member.isTyping ? 'typing' : ''}`}>
                                <div
                                    className="member-avatar"
                                    style={{
                                        background: member.avatar
                                            ? `url(${member.avatar}) center/cover`
                                            : 'var(--accent-color)'
                                    }}
                                >
                                    {!member.avatar && member.username[0]?.toUpperCase()}
                                </div>
                            </div>
                            <div className="member-info">
                                <span className="member-name">
                                    {member.username}
                                    {member.isHost && <span className="host-badge">👑 Host</span>}
                                    {member.isHostAssist && <span className="host-assist-badge">⭐ Host-Assist</span>}
                                    {member.username === currentUser && <span className="you-badge">(You)</span>}
                                </span>
                                <span className="member-status">
                                    {member.isTyping ? 'typing...' : 'online'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showMenu && selectedUser && (
                <>
                    <div className="menu-overlay" onClick={handleClickOutside}></div>
                    <div
                        className="user-action-menu"
                        style={{
                            position: 'fixed',
                            left: `${menuPosition.x}px`,
                            top: `${menuPosition.y}px`
                        }}
                    >
                        <div className="menu-header">
                            Manage {selectedUser.username}
                        </div>
                        <button
                            className="menu-item kick"
                            onClick={() => handleAction('kick')}
                        >
                            👢 Kick User
                        </button>
                        {isHost && (
                            <>
                                <button
                                    className="menu-item make-host"
                                    onClick={() => handleAction('makeHost')}
                                >
                                    👑 Make Host
                                </button>
                                {!selectedUser.isHostAssist && (
                                    <button
                                        className="menu-item make-host-assist"
                                        onClick={() => handleAction('makeHostAssist')}
                                    >
                                        ⭐ Make Host-Assist
                                    </button>
                                )}
                            </>
                        )}
                        <button
                            className="menu-item cancel"
                            onClick={handleClickOutside}
                        >
                            ❌ Cancel
                        </button>
                    </div>
                </>
            )}
        </>
    );
};

export default ChannelMembers;
