import React, { useState, useRef } from 'react';

const ProfileModal = ({ username, currentAvatar, onClose, onAvatarUpdate }) => {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('avatar', file);
        formData.append('username', username);

        try {
            const response = await fetch('/api/avatar', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                onAvatarUpdate?.(data.url);
            }
        } catch (error) {
            console.error('Avatar upload error:', error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div className="modal-content" style={{
                background: 'var(--glass-bg)',
                border: 'var(--glass-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                width: '320px',
                backdropFilter: 'blur(20px)'
            }}>
                <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Profile Settings</h2>

                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: currentAvatar ? `url(${currentAvatar}) center/cover` : 'var(--accent-color)',
                        margin: '0 auto 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        color: 'white'
                    }}>
                        {!currentAvatar && username?.[0]?.toUpperCase()}
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarUpload}
                        accept="image/*"
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        style={{
                            background: 'var(--accent-color)',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-sm)',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        {isUploading ? 'Uploading...' : 'Change Avatar'}
                    </button>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Username</label>
                    <div style={{
                        padding: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)'
                    }}>
                        {username}
                    </div>
                </div>

                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '10px',
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                    }}
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default ProfileModal;
