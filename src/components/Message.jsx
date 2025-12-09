import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const Message = ({ text, isOwn, sender, time, messageId, reactions = [], onAddReaction, onRemoveReaction, onDelete, onEdit, currentUser }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(text);

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, r) => {
        if (!acc[r.emoji]) {
            acc[r.emoji] = { count: 0, users: [], hasOwn: false };
        }
        acc[r.emoji].count++;
        acc[r.emoji].users.push(r.username);
        if (r.username === currentUser) {
            acc[r.emoji].hasOwn = true;
        }
        return acc;
    }, {});

    const handleReactionClick = (emoji) => {
        const reaction = groupedReactions[emoji];
        if (reaction?.hasOwn) {
            onRemoveReaction?.(messageId, emoji);
        } else {
            onAddReaction?.(messageId, emoji);
        }
        setShowPicker(false);
    };

    const handleDelete = () => {
        if (confirm('Delete this message?')) {
            onDelete?.(messageId);
        }
        setShowMenu(false);
    };

    const handleEdit = () => {
        setIsEditing(true);
        setShowMenu(false);
    };

    const submitEdit = () => {
        if (editText.trim() && editText !== text) {
            onEdit?.(messageId, editText);
        }
        setIsEditing(false);
    };

    return (
        <div
            className={`message ${isOwn ? 'own' : ''}`}
            onMouseEnter={() => isOwn && setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
            style={{ position: 'relative' }}
        >
            {/* Message actions menu for own messages */}
            {isOwn && showMenu && !isEditing && (
                <div style={{
                    position: 'absolute',
                    top: '0',
                    right: '10px',
                    display: 'flex',
                    gap: '4px',
                    background: 'var(--glass-bg)',
                    borderRadius: '8px',
                    padding: '4px',
                    zIndex: 10
                }}>
                    <button
                        onClick={handleEdit}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                        title="Edit"
                    >✏️</button>
                    <button
                        onClick={handleDelete}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                        title="Delete"
                    >🗑️</button>
                </div>
            )}

            <div className="message-content">
                <div className="message-header">
                    <span className="sender">{sender}</span>
                    <span className="time">{time}</span>
                </div>
                <div className="message-bubble">
                    {isEditing ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && submitEdit()}
                                autoFocus
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    color: 'inherit'
                                }}
                            />
                            <button onClick={submitEdit} style={{ padding: '4px 8px' }}>✓</button>
                            <button onClick={() => setIsEditing(false)} style={{ padding: '4px 8px' }}>✕</button>
                        </div>
                    ) : (
                        <ReactMarkdown
                            components={{
                                img: ({ node, ...props }) => (
                                    <img
                                        style={{ maxWidth: '100%', borderRadius: '8px', marginTop: '5px' }}
                                        {...props}
                                    />
                                ),
                                p: ({ node, ...props }) => <span {...props} />,
                            }}
                        >
                            {text}
                        </ReactMarkdown>
                    )}
                </div>

                {/* Reactions display */}
                <div className="reactions-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {Object.entries(groupedReactions).map(([emoji, data]) => (
                        <button
                            key={emoji}
                            onClick={() => handleReactionClick(emoji)}
                            style={{
                                background: data.hasOwn ? 'rgba(108, 99, 255, 0.3)' : 'rgba(255,255,255,0.1)',
                                border: data.hasOwn ? '1px solid #6c63ff' : '1px solid transparent',
                                borderRadius: '12px',
                                padding: '2px 8px',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            title={data.users.join(', ')}
                        >
                            <span>{emoji}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{data.count}</span>
                        </button>
                    ))}

                    {/* Add reaction button */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowPicker(!showPicker)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                opacity: 0.5,
                                padding: '2px 6px'
                            }}
                            title="Add reaction"
                        >
                            😀
                        </button>
                        {showPicker && (
                            <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 0,
                                background: 'var(--glass-bg)',
                                border: 'var(--glass-border)',
                                borderRadius: '8px',
                                padding: '8px',
                                display: 'flex',
                                gap: '4px',
                                zIndex: 100,
                                backdropFilter: 'blur(10px)'
                            }}>
                                {QUICK_EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleReactionClick(emoji)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            fontSize: '1.2rem',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            borderRadius: '4px'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Message;
