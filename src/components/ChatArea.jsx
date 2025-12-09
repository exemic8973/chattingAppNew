import React, { useState, useRef, useEffect } from 'react';
import Message from './Message';

const ChatArea = ({ messages, onSendMessage, typingUsers = [], onTyping, onStopTyping, onLoadMore, onAddReaction, onRemoveReaction, onDelete, onEdit, currentUser }) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);
    const messagesListRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const previousHeightRef = useRef(0);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Auto-scroll to bottom only on NEW messages at the bottom, or initial load?
    // If we loaded OLDER messages, we should NOT scroll to bottom.
    // We can check if the last message ID changed.
    const lastMessageIdRef = useRef(null);

    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.id !== lastMessageIdRef.current) {
            // New message at bottom
            lastMessageIdRef.current = lastMsg.id;
            // Only scroll to bottom if we were already near bottom OR if it's a fresh load (messages.length small)
            // For simplicity, let's scroll to bottom if it's a new message sent/received.
            // But if we just prepended messages, the last message ID didn't change (it's still the same last message).
            // Wait, if we prepend, the last message is SAME. logic holds.
            scrollToBottom();
        } else if (messages.length > 0 && isLoadingMore) {
            // We just loaded more messages. Restore scroll position.
            if (messagesListRef.current) {
                const newHeight = messagesListRef.current.scrollHeight;
                const heightDifference = newHeight - previousHeightRef.current;
                messagesListRef.current.scrollTop = heightDifference;
                setIsLoadingMore(false);
            }
        }
    }, [messages, isLoadingMore]);

    const handleScroll = () => {
        if (messagesListRef.current && messagesListRef.current.scrollTop === 0 && onLoadMore) {
            // Scrolled to top
            setIsLoadingMore(true);
            previousHeightRef.current = messagesListRef.current.scrollHeight;
            onLoadMore();
        }
    };

    const handleSend = () => {
        if (inputValue.trim()) {
            onSendMessage(inputValue);
            setInputValue('');
            if (onStopTyping) onStopTyping();
            clearTimeout(typingTimeoutRef.current);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    const handleChange = (e) => {
        setInputValue(e.target.value);

        if (onTyping) {
            onTyping();

            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Set new timeout to stop typing after 2 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                if (onStopTyping) onStopTyping();
            }, 2000);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                // Format message based on file type
                let fileMessage;
                if (file.type.startsWith('image/')) {
                    // Use markdown image syntax for images
                    fileMessage = `![${file.name}](${data.url})`;
                } else {
                    // Use markdown link for other files
                    fileMessage = `📎 [${file.name}](${data.url})`;
                }
                onSendMessage(fileMessage);
            } else {
                console.error('Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="chat-area">
            <div
                className="messages-list"
                ref={messagesListRef}
                onScroll={handleScroll}
            >
                {isLoadingMore && <div style={{ textAlign: 'center', color: '#888', padding: '10px' }}>Loading history...</div>}
                {messages.map(msg => (
                    <Message
                        key={msg.id}
                        messageId={msg.id}
                        text={msg.text}
                        isOwn={msg.isOwn}
                        sender={msg.sender}
                        time={msg.time}
                        reactions={msg.reactions || []}
                        onAddReaction={onAddReaction}
                        onRemoveReaction={onRemoveReaction}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        currentUser={currentUser}
                    />
                ))}
                {typingUsers.length > 0 && (
                    <div className="typing-indicator" style={{
                        fontStyle: 'italic',
                        fontSize: '0.8rem',
                        color: 'rgba(255,255,255,0.5)',
                        padding: '10px 20px',
                        animation: 'fadeIn 0.3s'
                    }}>
                        {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="message-input-container">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
                <button
                    className="attach-button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    title="Attach image"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        padding: '8px',
                        opacity: isUploading ? 0.5 : 1
                    }}
                >
                    {isUploading ? '⏳' : '📎'}
                </button>
                <input
                    type="text"
                    placeholder="Type a message (Markdown supported)"
                    value={inputValue}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                />
                <button onClick={handleSend}>Send</button>
            </div>
        </div>
    );
};

export default ChatArea;

