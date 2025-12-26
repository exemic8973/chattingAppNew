import React, { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';

// Type definitions
interface Peer {
    peerId: string;
    stream: MediaStream | null;
}

interface PeerConnection {
    peerId: string;
    peer: RTCPeerConnection;
}

interface VideoCallProps {
    socket: Socket;
    channelId: string;
    username: string;
    onClose: () => void;
    isVoiceOnly: boolean;
}

interface VideoProps {
    peer: Peer;
    isVoiceOnly: boolean;
}

// Socket event payload types
interface AllUsersPayload {
    users: string[];
}

interface CallReceivedPayload {
    signal: RTCSessionDescriptionInit;
    from: string;
}

interface CallAnsweredPayload {
    signal: RTCSessionDescriptionInit;
    from: string;
}

interface IceCandidateReceivedPayload {
    candidate: RTCIceCandidateInit;
    from: string;
}

const VideoCall: React.FC<VideoCallProps> = ({ socket, channelId, username, onClose, isVoiceOnly }) => {
    const [peers, setPeers] = useState<Peer[]>([]);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string>("");

    const myVideo = useRef<HTMLVideoElement>(null);
    const peersRef = useRef<PeerConnection[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError("Media devices not supported. If you are on a network IP, try using 'localhost' or enable HTTPS.");
            return;
        }

        navigator.mediaDevices.getUserMedia({ video: !isVoiceOnly, audio: true })
            .then((currentStream: MediaStream) => {
                streamRef.current = currentStream;
                setStream(currentStream);
                if (myVideo.current && !isVoiceOnly) {
                    myVideo.current.srcObject = currentStream;
                }

                // Join the video room
                socket.emit("join_video", channelId);

                // Receive list of existing users
                socket.on("all_users", (users: string[]) => {
                    const newPeers: Peer[] = [];
                    users.forEach((userID: string) => {
                        const peer = createPeer(userID, socket.id, currentStream);
                        peersRef.current.push({
                            peerId: userID,
                            peer,
                        });
                        newPeers.push({
                            peerId: userID,
                            stream: null
                        });
                    });
                    setPeers(newPeers);
                });

                // Handle incoming call (someone joined after us)
                socket.on("call_received", (payload: CallReceivedPayload) => {
                    const peer = addPeer(payload.signal, payload.from, currentStream);
                    peersRef.current.push({
                        peerId: payload.from,
                        peer,
                    });
                    setPeers((users: Peer[]) => [...users, { peerId: payload.from, stream: null }]);
                });

                socket.on("call_answered", (payload: CallAnsweredPayload) => {
                    const item = peersRef.current.find(p => p.peerId === payload.from);
                    if (item) {
                        item.peer.signal(payload.signal);
                    }
                });

                socket.on("ice_candidate_received", (payload: IceCandidateReceivedPayload) => {
                    const item = peersRef.current.find(p => p.peerId === payload.from);
                    if (item) {
                        item.peer.addIceCandidate(payload.candidate).catch(e => console.error("Error adding ice candidate", e));
                    }
                });
            })
            .catch((err: Error) => {
                console.error("Error accessing media devices:", err);
                setError("Could not access media devices. Please check permissions.");
            });

        return () => {
            socket.off("all_users");
            socket.off("call_received");
            socket.off("call_answered");
            socket.off("ice_candidate_received");

            // Stop all tracks using ref (not stale closure)
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    track.stop();
                    console.log('Stopped track:', track.kind);
                });
                streamRef.current = null;
            }

            // Close all peers
            peersRef.current.forEach(p => {
                if (p.peer) {
                    p.peer.close();
                }
            });
            peersRef.current = [];
        };
    }, [channelId, isVoiceOnly, socket]);

    function createPeer(userToCall: string, callerID: string, stream: MediaStream): RTCPeerConnection {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        peer.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate) {
                socket.emit("ice_candidate", {
                    to: userToCall,
                    candidate: event.candidate,
                    from: callerID
                });
            }
        };

        peer.ontrack = (event: RTCTrackEvent) => {
            setPeers((users: Peer[]) => users.map((user: Peer) => {
                if (user.peerId === userToCall) {
                    return { ...user, stream: event.streams[0] };
                }
                return user;
            }));
        };

        stream.getTracks().forEach(track => peer.addTrack(track, stream));

        peer.createOffer().then(offer => {
            peer.setLocalDescription(offer);
            socket.emit("call_user", {
                userToCall: userToCall,
                signal: offer,
                from: callerID
            });
        });

        return peer;
    }

    function addPeer(incomingSignal: RTCSessionDescriptionInit, callerID: string, stream: MediaStream): RTCPeerConnection {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        peer.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
            if (event.candidate) {
                socket.emit("ice_candidate", {
                    to: callerID,
                    candidate: event.candidate,
                    from: socket.id
                });
            }
        };

        peer.ontrack = (event: RTCTrackEvent) => {
            setPeers((users: Peer[]) => users.map((user: Peer) => {
                if (user.peerId === callerID) {
                    return { ...user, stream: event.streams[0] };
                }
                return user;
            }));
        };

        peer.signal = (signal: RTCSessionDescriptionInit) => {
            peer.setRemoteDescription(new RTCSessionDescription(signal));
        };

        peer.addIceCandidate = (candidate: RTCIceCandidateInit): Promise<void> => {
            return peer.addIceCandidate(candidate);
        }

        stream.getTracks().forEach(track => peer.addTrack(track, stream));

        peer.setRemoteDescription(new RTCSessionDescription(incomingSignal)).then(() => {
            return peer.createAnswer();
        }).then((answer: RTCSessionDescriptionInit) => {
            peer.setLocalDescription(answer);
            socket.emit("answer_call", {
                signal: answer,
                to: callerID,
                from: socket.id
            });
        });

        return peer;
    }

    return (
        <div className="video-call-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            {error && (
                <div style={{ color: '#ff6b6b', marginBottom: '20px', padding: '10px', backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: '5px' }}>
                    {error}
                </div>
            )}

            <div className="video-grid" style={{
                display: 'grid',
                gridTemplateColumns: peers.length > 0 ? 'repeat(auto-fit, minmax(300px, 1fr))' : '1fr',
                gap: '20px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto'
            }}>
                {/* My Video */}
                <div className="video-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {isVoiceOnly ? (
                        <div style={{ width: '150px', height: '150px', borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'white', border: '2px solid var(--accent-color)' }}>
                            🎤
                        </div>
                    ) : (
                        <video playsInline muted ref={myVideo} autoPlay style={{ width: '100%', maxWidth: '400px', borderRadius: '10px', border: '2px solid var(--accent-color)' }} />
                    )}
                    <p style={{ textAlign: 'center', color: 'white', marginTop: '10px' }}>You</p>
                </div>

                {/* Peers Video */}
                {peers.map((peer, index) => (
                    <Video key={peer.peerId} peer={peer} isVoiceOnly={isVoiceOnly} />
                ))}
            </div>

            <div className="controls" style={{ marginTop: '20px' }}>
                <button onClick={onClose} style={{
                    padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1.1rem'
                }}>
                    Leave Call
                </button>
            </div>
        </div>
    );
};

const Video: React.FC<VideoProps> = ({ peer, isVoiceOnly }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (peer.stream) {
            if (isVoiceOnly) {
                // Voice only: use audio element
                if (audioRef.current) {
                    audioRef.current.srcObject = peer.stream;
                }
            } else {
                // Video call: use video element
                if (videoRef.current) {
                    videoRef.current.srcObject = peer.stream;
                }
            }
        }
    }, [peer.stream, isVoiceOnly]);

    return (
        <div className="video-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {isVoiceOnly ? (
                <>
                    <div style={{ width: '150px', height: '150px', borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'white', border: '2px solid #fff' }}>
                        👤
                    </div>
                    {/* Separate audio element for voice-only mode */}
                    <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
                </>
            ) : (
                <video playsInline ref={videoRef} autoPlay style={{ width: '100%', maxWidth: '400px', borderRadius: '10px', border: '2px solid #fff' }} />
            )}

            <p style={{ textAlign: 'center', color: 'white', marginTop: '10px' }}>User {peer.peerId.substr(0, 5)}</p>
        </div>
    );
};

export default VideoCall;