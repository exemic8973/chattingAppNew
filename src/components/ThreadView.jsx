import React, { useState, useEffect } from 'react';
import Message from './Message';
import ReplyButton from './ReplyButton';
import { useI18n } from '../i18n/I18nContext';
import io from 'socket.io-client';

const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const socketUrl = isDevelopment
  ? `http://${window.location.hostname}:3001`
  : window.location.origin;

const socket = io(socketUrl, {
  secure: !isDevelopment,
  rejectUnauthorized: false
});

const ThreadView = ({ 
  threadId, 
  channelId, 
  messages, 
  currentUser, 
  onSendMessage, 
  onClose,
  onAddReaction,
  onRemoveReaction,
  onDelete,
  onEdit 
}) => {
  const { t } = useI18n();
  const [threadMessages, setThreadMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (threadId && channelId) {
      loadThreadMessages();
    }
  }, [threadId, channelId]);

  const loadThreadMessages = () => {
    setIsLoading(true);
    // Emit socket event to fetch thread messages from server
    socket.emit('get_thread_messages', { channelId, threadId });
  };

  useEffect(() => {
    // Listen for thread messages response
    socket.on('thread_messages', (data) => {
      setThreadMessages(data.messages || []);
      setIsLoading(false);
    });

    // Listen for new thread messages
    socket.on('new_thread_message', (message) => {
      if (message.thread_id === threadId) {
        setThreadMessages(prev => [...prev, message]);
      }
    });

    return () => {
      socket.off('thread_messages');
      socket.off('new_thread_message');
    };
  }, [threadId]);

  const handleReply = (messageId, replyText) => {
    const replyMessage = {
      id: Date.now(),
      text: replyText,
      sender: currentUser,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
      reply_to: messageId,
      thread_id: threadId
    };

    onSendMessage(channelId, replyMessage, messageId);
  };

  const originalMessage = messages.find(msg => msg.id === threadId);

  if (!originalMessage) {
    return null;
  }

  return (
    <div className="thread-view" style={{
      position: 'fixed',
      right: '0',
      top: '0',
      width: '400px',
      height: '100vh',
      backgroundColor: 'var(--background-color)',
      borderLeft: '1px solid var(--glass-border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      boxShadow: '-2px 0 10px rgba(0,0,0,0.1)'
    }}>
      {/* Thread Header */}
      <div className="thread-header" style={{
        padding: '16px',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--surface-color)'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-color)' }}>
            {t('thread.thread', 'Thread')}
          </h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {t('thread.startedBy', 'Started by')} {originalMessage.sender}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '4px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Original Message */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          {t('thread.originalMessage', 'Original Message')}
        </div>
        <div style={{
          backgroundColor: 'var(--glass-bg)',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid var(--glass-border)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {originalMessage.sender}
          </div>
          <div style={{ fontSize: '0.9rem' }}>
            {originalMessage.text}
          </div>
        </div>
      </div>

      {/* Thread Messages */}
      <div className="thread-messages" style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px'
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            {t('thread.loading', 'Loading thread...')}
          </div>
        ) : threadMessages.length > 0 ? (
          threadMessages.map(message => (
            <div key={message.id} style={{ marginBottom: '12px' }}>
              <Message
                text={message.text}
                isOwn={message.sender === currentUser}
                sender={message.sender}
                time={message.time}
                messageId={message.id}
                reactions={message.reactions || []}
                onAddReaction={onAddReaction}
                onRemoveReaction={onRemoveReaction}
                onDelete={onDelete}
                onEdit={onEdit}
                currentUser={currentUser}
              />
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            {t('thread.noReplies', 'No replies yet. Be the first to reply!')}
          </div>
        )}
      </div>

      {/* Reply Input */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--glass-border)' }}>
        <ReplyButton
          messageId={originalMessage.id}
          sender={originalMessage.sender}
          onReply={handleReply}
        />
      </div>
    </div>
  );
};

export default ThreadView;