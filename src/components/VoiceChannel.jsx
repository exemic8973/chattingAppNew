import React, { useState, useEffect, useRef } from 'react';
import './VoiceChannel.css';

const VoiceChannel = ({
    socket,
    channelId,
    username,
    isHost,
    isHostAssist,
    onClose
}) => {
    const [voiceUsers, setVoiceUsers] = useState([]);
    const [isMuted, setIsMuted] = useState(true);
    const [canUnmute, setCanUnmute] = useState(isHost || isHostAssist);
    const [stream, setStream] = useState(null);
    const [peers, setPeers] = useState([]);
    const [showPermissionRequests, setShowPermissionRequests] = useState(false);
    const [permissionRequests, setPermissionRequests] = useState([]);

    const streamRef = useRef(null);
    const peersRef = useRef([]);

    useEffect(() => {
        // Initialize media
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then((currentStream) => {
                streamRef.current = currentStream;
                setStream(currentStream);

                // Start muted
                currentStream.getAudioTracks().forEach(track => {
                    track.enabled = false;
                });

                // Join voice
                socket.emit("join_voice", { channelId, username });

                // Listen for voice events
                socket.on("voice_user_joined", (data) => {
                    if (data.channelId === channelId) {
                        setVoiceUsers(data.users);
                    }
                });

                socket.on("voice_user_left", (data) => {
                    if (data.channelId === channelId) {
                        setVoiceUsers(data.users || []);
                        // Remove peer connection
                        setPeers(prev => prev.filter(p => p.username !== data.username));
                    }
                });

                socket.on("voice_user_muted", (data) => {
                    if (data.channelId === channelId) {
                        setVoiceUsers(prev => prev.map(u =>
                            u.username === data.username
                                ? { ...u, is_muted: data.isMuted ? 1 : 0 }
                                : u
                        ));
                        if (data.username === username && data.forcedBy) {
                            // We were force muted
                            setIsMuted(true);
                            if (streamRef.current) {
                                streamRef.current.getAudioTracks().forEach(track => {
                                    track.enabled = false;
                                });
                            }
                        }
                    }
                });

                socket.on("voice_permission_updated", (data) => {
                    if (data.channelId === channelId) {
                        if (data.username === username) {
                            setCanUnmute(data.canUnmute);
                            if (data.isMuted !== undefined) {
                                setIsMuted(data.isMuted);
                                if (data.isMuted && streamRef.current) {
                                    streamRef.current.getAudioTracks().forEach(track => {
                                        track.enabled = false;
                                    });
                                }
                            }
                        }
                    }
                });

                socket.on("unmute_permission_granted", (data) => {
                    if (data.channelId === channelId) {
                        setCanUnmute(true);
                        alert(`You can now unmute in this channel (granted by ${data.grantedBy})`);
                    }
                });

                socket.on("unmute_permission_revoked", (data) => {
                    if (data.channelId === channelId) {
                        setCanUnmute(false);
                        setIsMuted(true);
                        if (streamRef.current) {
                            streamRef.current.getAudioTracks().forEach(track => {
                                track.enabled = false;
                            });
                        }
                        alert(`Your unmute permission was revoked by ${data.revokedBy}`);
                    }
                });

                socket.on("force_muted", (data) => {
                    if (data.channelId === channelId) {
                        setIsMuted(true);
                        if (streamRef.current) {
                            streamRef.current.getAudioTracks().forEach(track => {
                                track.enabled = false;
                            });
                        }
                        alert(`You were muted by ${data.by}`);
                    }
                });

                socket.on("unmute_permission_requested", (data) => {
                    if (data.channelId === channelId && (isHost || isHostAssist)) {
                        setPermissionRequests(prev => {
                            // Avoid duplicates
                            if (prev.some(r => r.username === data.username)) {
                                return prev;
                            }
                            return [...prev, data];
                        });
                    }
                });

                socket.on("permission_request_sent", () => {
                    alert("Permission request sent to channel admins");
                });

                socket.on("voice_error", (data) => {
                    alert(`Voice error: ${data.message}`);
                });

                // WebRTC signaling would go here (similar to VideoCall.jsx)
                // For simplicity, this basic version doesn't include full WebRTC peer-to-peer
                // In production, you'd add the same peer connection logic as VideoCall.jsx
            })
            .catch((err) => {
                console.error("Error accessing microphone:", err);
                alert("Could not access microphone. Please check permissions.");
            });

        return () => {
            // Cleanup
            socket.emit("leave_voice", { channelId, username });

            socket.off("voice_user_joined");
            socket.off("voice_user_left");
            socket.off("voice_user_muted");
            socket.off("voice_permission_updated");
            socket.off("unmute_permission_granted");
            socket.off("unmute_permission_revoked");
            socket.off("force_muted");
            socket.off("unmute_permission_requested");
            socket.off("permission_request_sent");
            socket.off("voice_error");

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            peersRef.current.forEach(p => {
                if (p.peer) p.peer.close();
            });
        };
    }, [channelId, username, isHost, isHostAssist]);

    const toggleMute = () => {
        if (!canUnmute && !isMuted) return;

        const newMuted = !isMuted;

        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !newMuted;
            });
        }

        setIsMuted(newMuted);
        socket.emit("toggle_mute", { channelId, username, isMuted: newMuted });
    };

    const requestPermission = () => {
        socket.emit("request_unmute_permission", { channelId, username });
    };

    const grantPermission = (targetUsername) => {
        socket.emit("grant_unmute_permission", {
            channelId,
            username: targetUsername,
            grantedBy: username
        });
        setPermissionRequests(prev => prev.filter(r => r.username !== targetUsername));
    };

    const revokePermission = (targetUsername) => {
        socket.emit("revoke_unmute_permission", {
            channelId,
            username: targetUsername,
            revokedBy: username
        });
    };

    const muteUser = (targetUsername) => {
        socket.emit("server_mute_user", {
            channelId,
            username: targetUsername,
            mutedBy: username
        });
    };

    return (
        <div className="voice-channel-overlay">
            <div className="voice-channel-container">
                <div className="voice-header">
                    <h3>🎤 Voice Channel</h3>
                    <button onClick={onClose} className="close-btn">❌</button>
                </div>

                <div className="voice-users-grid">
                    {voiceUsers.map(user => (
                        <div key={user.username} className="voice-user-card">
                            <div className={`voice-avatar ${user.is_muted ? 'muted' : 'speaking'}`}>
                                {user.username[0].toUpperCase()}
                            </div>
                            <span className="voice-username">{user.username}</span>
                            <span className="voice-status">
                                {user.is_muted ? '🔇 Muted' : '🎤 Unmuted'}
                            </span>
                            {(isHost || isHostAssist) && user.username !== username && (
                                <div className="admin-controls">
                                    <button
                                        onClick={() => muteUser(user.username)}
                                        className="mute-user-btn"
                                        title="Force Mute"
                                    >
                                        🔇
                                    </button>
                                    {user.can_unmute ? (
                                        <button
                                            onClick={() => revokePermission(user.username)}
                                            className="revoke-btn"
                                            title="Revoke Permission"
                                        >
                                            ❌
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => grantPermission(user.username)}
                                            className="grant-btn"
                                            title="Grant Permission"
                                        >
                                            ✅
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="voice-controls">
                    {canUnmute ? (
                        <button
                            onClick={toggleMute}
                            className={`mute-btn ${isMuted ? 'muted' : 'unmuted'}`}
                        >
                            {isMuted ? '🔇 Unmute' : '🎤 Mute'}
                        </button>
                    ) : (
                        <>
                            <button disabled className="mute-btn muted">
                                🔇 Muted (No Permission)
                            </button>
                            <button onClick={requestPermission} className="request-btn">
                                🙋 Request Permission
                            </button>
                        </>
                    )}

                    {(isHost || isHostAssist) && permissionRequests.length > 0 && (
                        <button
                            onClick={() => setShowPermissionRequests(!showPermissionRequests)}
                            className="requests-btn"
                        >
                            🔔 {permissionRequests.length} Request{permissionRequests.length > 1 ? 's' : ''}
                        </button>
                    )}
                </div>

                {showPermissionRequests && permissionRequests.length > 0 && (
                    <div className="permission-requests">
                        <h4>Unmute Requests</h4>
                        {permissionRequests.map(req => (
                            <div key={req.username} className="request-item">
                                <span>{req.username}</span>
                                <div className="request-actions">
                                    <button onClick={() => grantPermission(req.username)} className="grant-request-btn">
                                        ✅ Grant
                                    </button>
                                    <button
                                        onClick={() => setPermissionRequests(prev => prev.filter(r => r.username !== req.username))}
                                        className="deny-request-btn"
                                    >
                                        ❌ Deny
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoiceChannel;
