import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, ForwardedRef } from 'react';
import Message from './Message';
import { useI18n } from '../i18n/I18nContext';
import type { Message as MessageType, Reaction } from '../types';

// Type definitions
interface ChatAreaProps {
    messages: MessageType[];
    onSendMessage: (message: string, msg?: MessageType, replyToId?: number) => void;
    typingUsers?: string[];
    onTyping?: () => void;
    onStopTyping?: () => void;
    onLoadMore?: () => void;
    onAddReaction?: (messageId: number, emoji: string) => void;
    onRemoveReaction?: (messageId: number, emoji: string) => void;
    onDelete?: (messageId: number) => void;
    onEdit?: (messageId: number, newText: string) => void;
    currentUser: string;
}

interface ChatAreaHandle {
    scrollToMessage: (messageId: number) => void;
}

const ChatArea = forwardRef<ChatAreaHandle, ChatAreaProps>(({
    messages,
    onSendMessage,
    typingUsers = [],
    onTyping,
    onStopTyping,
    onLoadMore,
    onAddReaction,
    onRemoveReaction,
    onDelete,
    onEdit,
    currentUser
}, ref: ForwardedRef<ChatAreaHandle>) => {
    const { t } = useI18n();
    const [inputValue, setInputValue] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesListRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const previousHeightRef = useRef<number>(0);
    const messageRefs = useRef<Record<number, HTMLElement>>({});
    const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Expose scrollToMessage method to parent
    useImperativeHandle(ref, () => ({
        scrollToMessage: (messageId: number) => {
            const messageElement = messageRefs.current[messageId];
            if (messageElement) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setHighlightedMessageId(messageId);
                // Remove highlight after 2 seconds
                setTimeout(() => setHighlightedMessageId(null), 2000);
            }
        }
    }));

    // Auto-scroll to bottom only on NEW messages at the bottom, or initial load?
    // If we loaded OLDER messages, we should NOT scroll to bottom.
    // We can check if the last message ID changed.
    const lastMessageIdRef = useRef<number | null>(null);

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
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
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
                const data = await response.json() as { url: string };
                // Format message based on file type
                let fileMessage: string;
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
                {isLoadingMore && <div style={{ textAlign: 'center', color: '#888', padding: '10px' }}>{t('chat.loadingHistory')}</div>}

                {messages.map((msg: MessageType) => (
                    <Message
                        key={msg.id}
                        ref={(el: HTMLElement | null) => { if (el) messageRefs.current[msg.id] = el; }}
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
                        highlighted={msg.id === highlightedMessageId}
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
                        {typingUsers.join(', ')} {t('chat.typing')}
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
                    title={t('chat.attachImage')}
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
                    placeholder={t('chat.typeMessage')}
                    value={inputValue}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                />
                <button onClick={handleSend}>{t('chat.send')}</button>
            </div>
        </div>
    );
});

ChatArea.displayName = 'ChatArea';

export default ChatArea;