import React, { useState, useEffect } from 'react';

const Login = ({ socket, onJoin }) => {
    const [isSignup, setIsSignup] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (!socket) return;

        socket.on('signup_success', (msg) => {
            alert(msg);
            setIsSignup(false);
        });

        socket.on('signup_error', (msg) => {
            alert(msg);
        });

        socket.on('login_success', (username) => {
            onJoin(username);
        });

        socket.on('login_error', (msg) => {
            alert(msg);
        });

        return () => {
            socket.off('signup_success');
            socket.off('signup_error');
            socket.off('login_success');
            socket.off('login_error');
        };
    }, [socket, onJoin]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            alert("Please enter both username and password");
            return;
        }

        if (isSignup) {
            socket.emit('signup', { username, password });
        } else {
            socket.emit('login', { username, password });
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon">
                        💬
                    </div>
                    <h1 className="login-title">
                        {isSignup ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <p className="login-subtitle">
                        {isSignup ? 'Join the community today' : 'Enter your details to access your account'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="login-input"
                        />
                    </div>
                    <div className="input-group">
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="login-input"
                        />
                    </div>

                    <button type="submit" className="login-button">
                        {isSignup ? 'Sign Up' : 'Sign In'}
                    </button>

                    <div className="login-footer">
                        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button
                            type="button"
                            onClick={() => setIsSignup(!isSignup)}
                            className="toggle-auth-button"
                        >
                            {isSignup ? 'Login' : 'Sign Up'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
