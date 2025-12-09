import React, { useState, useEffect } from 'react';

const SearchModal = ({ channelId, onClose, onSelectMessage }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&channelId=${channelId}`);
                if (response.ok) {
                    const data = await response.json();
                    setResults(data.results || []);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
            }
        }, 300); // Debounce

        return () => clearTimeout(timer);
    }, [query, channelId]);

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
            zIndex: 1000
        }}>
            <div className="modal-content" style={{
                background: 'var(--glass-bg)',
                border: 'var(--glass-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px',
                width: '500px',
                maxHeight: '60vh',
                backdropFilter: 'blur(20px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '1.2rem', marginRight: '8px' }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search messages..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                        style={{
                            flex: 1,
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            padding: '10px',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: '1rem'
                        }}
                    />
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            marginLeft: '8px'
                        }}
                    >
                        ×
                    </button>
                </div>

                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {isLoading && (
                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                            Searching...
                        </div>
                    )}
                    {!isLoading && results.length === 0 && query && (
                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                            No results found
                        </div>
                    )}
                    {results.map((msg) => (
                        <div
                            key={msg.id}
                            onClick={() => onSelectMessage?.(msg)}
                            style={{
                                padding: '12px',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                marginBottom: '4px',
                                background: 'rgba(255,255,255,0.05)'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{msg.sender}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{msg.time}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                {msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SearchModal;
