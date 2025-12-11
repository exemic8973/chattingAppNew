import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/I18nContext';
import './UserAutocomplete.css';

const UserAutocomplete = ({ users, onSelect, placeholder }) => {
    const { t } = useI18n();
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef(null);
    const suggestionsRef = useRef(null);

    useEffect(() => {
        if (input.trim()) {
            const filtered = users.filter(user =>
                user.name.toLowerCase().includes(input.toLowerCase())
            );
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
        setSelectedIndex(-1);
    }, [input, users]);

    const handleSelect = (user) => {
        onSelect(user.name);
        setInput('');
        setShowSuggestions(false);
        setSelectedIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (!showSuggestions) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    handleSelect(suggestions[selectedIndex]);
                } else if (input.trim()) {
                    onSelect(input.trim());
                    setInput('');
                    setShowSuggestions(false);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedIndex(-1);
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                inputRef.current &&
                !inputRef.current.contains(event.target) &&
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="user-autocomplete">
            <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || t('dialogs.enterInviteUsername')}
                className="autocomplete-input"
            />

            {showSuggestions && suggestions.length > 0 && (
                <div ref={suggestionsRef} className="autocomplete-suggestions">
                    {suggestions.map((user, index) => (
                        <div
                            key={user.id}
                            className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                            onClick={() => handleSelect(user)}
                            onMouseEnter={() => setSelectedIndex(index)}
                        >
                            <div
                                className="suggestion-avatar"
                                style={{
                                    background: user.avatar
                                        ? `url(${user.avatar}) center/cover`
                                        : 'var(--accent-color)'
                                }}
                            >
                                {!user.avatar && user.name[0]?.toUpperCase()}
                            </div>
                            <div className="suggestion-info">
                                <div className="suggestion-name">{user.name}</div>
                                <div className="suggestion-status">
                                    {user.status === 'online' ? (
                                        <span className="status-online">● {t('members.online')}</span>
                                    ) : (
                                        <span className="status-offline">○ offline</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UserAutocomplete;
