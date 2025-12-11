import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';

const Login = ({ socket, onJoin }) => {
    const { t } = useI18n();
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
            alert(t('auth.enterBoth'));
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
                        {isSignup ? t('auth.createAccount') : t('auth.welcomeBack')}
                    </h1>
                    <p className="login-subtitle">
                        {isSignup ? t('auth.joinCommunity') : t('auth.enterDetails')}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder={t('auth.username')}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="login-input"
                        />
                    </div>
                    <div className="input-group">
                        <input
                            type="password"
                            placeholder={t('auth.password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="login-input"
                        />
                    </div>

                    <button type="submit" className="login-button">
                        {isSignup ? t('auth.signup') : t('auth.login')}
                    </button>

                    <div className="login-footer">
                        {isSignup ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}{' '}
                        <button
                            type="button"
                            onClick={() => setIsSignup(!isSignup)}
                            className="toggle-auth-button"
                        >
                            {isSignup ? t('auth.login') : t('auth.signup')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
