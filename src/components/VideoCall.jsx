import React, { useEffect, useState, useRef } from 'react';

const VideoCall = ({ socket, channelId, username, onClose, isVoiceOnly }) => {
    const [peers, setPeers] = useState([]); // Array of { peerId, stream }
    const [stream, setStream] = useState(null);
    const [error, setError] = useState("");

    const myVideo = useRef();
    const peersRef = useRef([]); // Array of { peerId, peer }

    useEffect(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError("Media devices not supported. If you are on a network IP, try using 'localhost' or enable HTTPS.");
            return;
        }

        navigator.mediaDevices.getUserMedia({ video: !isVoiceOnly, audio: true })
            .then((currentStream) => {
                setStream(currentStream);
                if (myVideo.current && !isVoiceOnly) {
                    myVideo.current.srcObject = currentStream;
                }

                // Join the video room
                socket.emit("join_video", channelId);

                // Receive list of existing users
                socket.on("all_users", (users) => {
                    const peers = [];
                    users.forEach(userID => {
                        const peer = createPeer(userID, socket.id, currentStream);
                        peersRef.current.push({
                            peerId: userID,
                            peer,
                        });
                        peers.push({
                            peerId: userID,
                            stream: null // Stream will be added on track event
                        });
                    });
                    setPeers(peers);
                });

                // Handle incoming call (someone joined after us)
                socket.on("call_received", (payload) => {
                    const peer = addPeer(payload.signal, payload.from, currentStream);
                    peersRef.current.push({
                        peerId: payload.from,
                        peer,
                    });
                    setPeers(users => [...users, { peerId: payload.from, stream: null }]);
                });

                socket.on("call_answered", (payload) => {
                    const item = peersRef.current.find(p => p.peerId === payload.from);
                    if (item) {
                        item.peer.signal(payload.signal);
                    }
                });

                socket.on("ice_candidate_received", (payload) => {
                    const item = peersRef.current.find(p => p.peerId === payload.from);
                    if (item) {
                        item.peer.addIceCandidate(payload.candidate).catch(e => console.error("Error adding ice candidate", e));
                    }
                });
            })
            .catch((err) => {
                console.error("Error accessing media devices:", err);
                setError("Could not access media devices. Please check permissions.");
            });

        return () => {
            socket.off("all_users");
            socket.off("call_received");
            socket.off("call_answered");
            socket.off("ice_candidate_received");

            // Stop all tracks
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            // Close all peers
            peersRef.current.forEach(p => p.peer.close());
        };
    }, [channelId, isVoiceOnly]);

    function createPeer(userToCall, callerID, stream) {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice_candidate", {
                    to: userToCall,
                    candidate: event.candidate,
                    from: callerID
                });
            }
        };

        peer.ontrack = (event) => {
            setPeers(users => users.map(user => {
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

    function addPeer(incomingSignal, callerID, stream) {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice_candidate", {
                    to: callerID,
                    candidate: event.candidate,
                    from: socket.id
                });
            }
        };

        peer.ontrack = (event) => {
            setPeers(users => users.map(user => {
                if (user.peerId === callerID) {
                    return { ...user, stream: event.streams[0] };
                }
                return user;
            }));
        };

        peer.signal = (signal) => {
            peer.setRemoteDescription(new RTCSessionDescription(signal));
        };

        peer.addIceCandidate = (candidate) => {
            return peer.addIceCandidate(candidate);
        }

        stream.getTracks().forEach(track => peer.addTrack(track, stream));

        peer.setRemoteDescription(new RTCSessionDescription(incomingSignal)).then(() => {
            return peer.createAnswer();
        }).then(answer => {
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

const Video = ({ peer, isVoiceOnly }) => {
    const ref = useRef();

    useEffect(() => {
        if (peer.stream) {
            ref.current.srcObject = peer.stream;
        }
    }, [peer.stream]);

    return (
        <div className="video-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {isVoiceOnly ? (
                <div style={{ width: '150px', height: '150px', borderRadius: '50%', backgroundColor: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'white', border: '2px solid #fff' }}>
                    👤
                </div>
            ) : (
                <video playsInline ref={ref} autoPlay style={{ width: '100%', maxWidth: '400px', borderRadius: '10px', border: '2px solid #fff' }} />
            )}
            {/* Always render video for audio playback, hide if voice only */}
            {isVoiceOnly && <video playsInline ref={ref} autoPlay style={{ width: '0px', height: '0px' }} />}

            <p style={{ textAlign: 'center', color: 'white', marginTop: '10px' }}>User {peer.peerId.substr(0, 5)}</p>
        </div>
    );
};

export default VideoCall;
