import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

const Sidebar = ({ teams, selectedTeamId, selectedChannelId, onSelectChannel, onCreateChannel, users, selectedUserId, onSelectUser, currentUsername }) => {
    const { t } = useI18n();
    const selectedTeam = teams.find(t => t.id === selectedTeamId);

    // Filter out the current user from DM list
    const otherUsers = users ? users.filter(u => u.name !== currentUsername) : [];

    return (
        <div className="sidebar">
            <div className="teams-list">
                {teams.map(team => (
                    <div
                        key={team.id}
                        className={`team-icon ${team.id === selectedTeamId ? 'active' : ''}`}
                        onClick={() => onSelectChannel(team.id, team.channels[0].id)}
                        title={team.name}
                    >
                        {team.name.charAt(0)}
                    </div>
                ))}
            </div>
            <div className="channels-list">
                <div className="sidebar-header">
                    <h2>{selectedTeam?.name}</h2>
                </div>

                <div className="sidebar-section">
                    <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {t('sidebar.channels')}
                        <button
                            onClick={() => {
                                const name = prompt(t('sidebar.enterChannelName'));
                                if (name) {
                                    const passcode = prompt(t('sidebar.enterPasscode'));
                                    onCreateChannel(selectedTeamId, name, passcode);
                                }
                            }}
                            style={{
                                background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px'
                            }}
                            title={t('sidebar.createChannel')}
                        >
                            +
                        </button>
                    </div>
                    <ul>
                        {selectedTeam?.channels.map(channel => (
                            <li
                                key={channel.id}
                                className={`sidebar-item ${channel.id === selectedChannelId ? 'active' : ''}`}
                                onClick={() => onSelectChannel(selectedTeamId, channel.id)}
                            >
                                <span className="hash">#</span> {channel.name} {channel.hasPasscode && '🔒'}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="sidebar-section">
                    <div className="section-title">{t('sidebar.directMessages')}</div>
                    <ul>
                        {otherUsers.length > 0 ? otherUsers.map(user => (
                            <li
                                key={user.id}
                                className={`sidebar-item user-item ${user.id === selectedUserId ? 'active' : ''}`}
                                onClick={() => onSelectUser(user.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: user.avatar ? `url(${user.avatar}) center/cover` : 'var(--accent-color)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.7rem',
                                    flexShrink: 0
                                }}>
                                    {!user.avatar && user.name?.[0]?.toUpperCase()}
                                </div>
                                <span className={`status-dot ${user.status}`}></span>
                                {user.name}
                            </li>
                        )) : (
                            <li className="sidebar-item empty-state">{t('sidebar.noOtherUsers')}</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;

