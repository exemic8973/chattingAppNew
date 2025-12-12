import React, { useEffect, useRef } from 'react';

const IncomingCallModal = ({ callerName, isVideoCall, onAccept, onDecline }) => {
    const audioRef = useRef();

    useEffect(() => {
        // Play ringing sound (simple beep pattern)
        // In a real app, you would use an actual ringtone file
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.log('Audio play failed:', e));
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, []);

    return (
        <div className="incoming-call-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.3s'
        }}>
            {/* Simple audio beep for ringing (you can replace with actual ringtone) */}
            <audio ref={audioRef} loop>
                {/* Data URI for a simple beep sound - you can replace with a real ringtone file */}
                <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGJ0fHJdikFKnzE7+GVQQ0XZLXp7KdbFApAmdz0xXEnBi6D0O/Nfz8IFmS56+mtWxcKPJXb88p7LAUpfcTv45ZOCRNfuOnqqVkVDEGZ3PLEcCgGLYPQ8c6APAkWZLjp66xaGAo8lNz0zH0tBih+w+/glUgMF2O36+yvXBgKOZPb9cxRChFjtOrrr1wYCjiT3PXMejcNLnzE7+OUThgSY7Pp66tcGAo6kdv1y3owDSl8xO/jlE4YEmKz6eurXBgKO5Hb9cx5Lw0ofMTv45ROGBJis+nrq1wYCjuR2/XLejANKXzE7+OVTxkSYrPp66tcGAo7kdv1y3kxCyt7w+/llE4ZEmOz6+usXBgKOpHb9ct6MA0qfMPv5JROGBJis+nrq1wYCjyR2/XMfz8NEV+36OqsWhkKOpHc9Mt6MQwre8Pv5ZRRGRJis+rrrFsYCjuS2vTLejEMK3vD7+WUThkSY7Pp66tcGAo6kdz1zHo1DSp8xO/klE4YEmKz6eurXBgKPJHb9cx/PRFQY7Pp66tcGAo9kdv1y3oxDCt7w+/llE4YEmKz6eurXBgKO5Hb9cp6MQ0qfMTv5JROGBJis+nrq1wYCjuR2/XMe0ANLHzC7+SUThgSYrPp66tcGAo7kdv1zHoxDSp9w+/klE4YEmKz6eurXBgKO5Hb9ct6Lw0pfMPv45ROGBJis+nrq1sYCjuR2/XLejEMK3vD7+SUThgSYrPp66tcGAo7kdv1y3owDSp8w+/klE4YEmKz6eurXBgKO5Hb9ct6MQ0qfMPv5JROGRJ=" type="audio/wav" />
            </audio>

            <div className="incoming-call-card" style={{
                background: 'var(--sidebar-bg)',
                borderRadius: '20px',
                padding: '40px',
                textAlign: 'center',
                maxWidth: '400px',
                animation: 'slideUp 0.3s',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}>
                <div className="caller-icon" style={{
                    fontSize: '5rem',
                    marginBottom: '20px',
                    animation: 'pulse 1.5s infinite'
                }}>
                    {isVideoCall ? '📹' : '🎤'}
                </div>

                <h2 style={{ color: 'white', marginBottom: '10px', fontSize: '1.8rem' }}>
                    {callerName}
                </h2>

                <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '30px', fontSize: '1.1rem' }}>
                    Incoming {isVideoCall ? 'video' : 'voice'} call...
                </p>

                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                    <button
                        onClick={onDecline}
                        style={{
                            padding: '15px 30px',
                            borderRadius: '50px',
                            border: 'none',
                            background: '#ff4757',
                            color: 'white',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            boxShadow: '0 4px 15px rgba(255,71,87,0.4)'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,71,87,0.6)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(255,71,87,0.4)';
                        }}
                    >
                        ❌ Decline
                    </button>

                    <button
                        onClick={onAccept}
                        style={{
                            padding: '15px 30px',
                            borderRadius: '50px',
                            border: 'none',
                            background: '#2ecc71',
                            color: 'white',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            boxShadow: '0 4px 15px rgba(46,204,113,0.4)'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(46,204,113,0.6)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(46,204,113,0.4)';
                        }}
                    >
                        ✅ Accept
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from {
                        transform: translateY(50px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }
            `}</style>
        </div>
    );
};

export default IncomingCallModal;
