import React, { useState, useEffect, useRef } from 'react';
import './VoiceChannel.css';

const VoiceChannel = ({
    socket,
    channelId,
    username,
    isHost,
    isHostAssist
}) => {
    const [voiceUsers, setVoiceUsers] = useState([]);
    const [isMuted, setIsMuted] = useState(true);
    const [canUnmute, setCanUnmute] = useState(isHost || isHostAssist);
    const [stream, setStream] = useState(null);
    const [showPermissionRequests, setShowPermissionRequests] = useState(false);
    const [permissionRequests, setPermissionRequests] = useState([]);
    const [isCollapsed, setIsCollapsed] = useState(false);

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
                    if (data.channelId === channelId && data.username === username) {
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
                });

                socket.on("unmute_permission_granted", (data) => {
                    if (data.channelId === channelId) {
                        setCanUnmute(true);
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
                    }
                });

                socket.on("unmute_permission_requested", (data) => {
                    if (data.channelId === channelId && (isHost || isHostAssist)) {
                        setPermissionRequests(prev => {
                            if (prev.some(r => r.username === data.username)) {
                                return prev;
                            }
                            return [...prev, data];
                        });
                    }
                });

                socket.on("permission_request_sent", () => {
                    // Silent - user will see status change
                });

                socket.on("voice_error", (data) => {
                    console.error("Voice error:", data.message);
                });
            })
            .catch((err) => {
                console.error("Error accessing microphone:", err);
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

    const muteUser = (targetUsername) => {
        socket.emit("server_mute_user", {
            channelId,
            username: targetUsername,
            mutedBy: username
        });
    };

    return (
        <div className={`voice-panel ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="voice-panel-header">
                <h4>🎤 Voice ({voiceUsers.length})</h4>
                <button
                    className="collapse-btn"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    title={isCollapsed ? "Expand" : "Collapse"}
                >
                    {isCollapsed ? '◀' : '▶'}
                </button>
            </div>

            {!isCollapsed && (
                <>
                    <div className="voice-users-list">
                        {voiceUsers.map(user => (
                            <div key={user.username} className="voice-user-item">
                                <div className={`voice-user-avatar ${!user.is_muted ? 'speaking' : ''}`}>
                                    {user.username[0].toUpperCase()}
                                </div>
                                <div className="voice-user-info">
                                    <span className="voice-user-name">{user.username}</span>
                                    <span className="voice-user-status">
                                        {user.is_muted ? '🔇' : '🎤'}
                                    </span>
                                </div>
                                {(isHost || isHostAssist) && user.username !== username && (
                                    <div className="voice-user-controls">
                                        <button
                                            onClick={() => muteUser(user.username)}
                                            className="control-btn"
                                            title="Mute"
                                        >
                                            🔇
                                        </button>
                                        {!user.can_unmute && (
                                            <button
                                                onClick={() => grantPermission(user.username)}
                                                className="control-btn grant"
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

                    {permissionRequests.length > 0 && (isHost || isHostAssist) && (
                        <div className="permission-alerts">
                            <button
                                onClick={() => setShowPermissionRequests(!showPermissionRequests)}
                                className="permission-alert-btn"
                            >
                                🔔 {permissionRequests.length} Request{permissionRequests.length > 1 ? 's' : ''}
                            </button>
                            {showPermissionRequests && (
                                <div className="permission-requests-list">
                                    {permissionRequests.map(req => (
                                        <div key={req.username} className="permission-request-item">
                                            <span>{req.username}</span>
                                            <button onClick={() => grantPermission(req.username)}>✅</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="voice-panel-controls">
                        {canUnmute ? (
                            <button
                                onClick={toggleMute}
                                className={`voice-control-btn ${isMuted ? 'muted' : 'unmuted'}`}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                {isMuted ? '🔇' : '🎤'}
                            </button>
                        ) : (
                            <button
                                onClick={requestPermission}
                                className="voice-control-btn request"
                                title="Request Permission"
                            >
                                🙋
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default VoiceChannel;
