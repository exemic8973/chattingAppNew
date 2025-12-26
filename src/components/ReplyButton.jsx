import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

const ReplyButton = ({ messageId, sender, onReply, isDisabled = false }) => {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(messageId, replyText);
      setReplyText('');
      setIsExpanded(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  };

  if (isExpanded) {
    return (
      <div className="reply-input-container" style={{
        marginTop: '8px',
        padding: '12px',
        backgroundColor: 'var(--glass-bg)',
        borderRadius: '8px',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          marginBottom: '8px'
        }}>
          {t('reply.replyingTo', 'Replying to')} {sender}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('reply.typeReply', 'Type your reply...')}
            style={{
              flex: 1,
              minHeight: '60px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '8px',
              color: 'inherit',
              resize: 'vertical',
              fontFamily: 'inherit',
              fontSize: '0.9rem'
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => {
                setIsExpanded(false);
                setReplyText('');
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--glass-border)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleReply}
              disabled={!replyText.trim()}
              style={{
                padding: '8px 12px',
                backgroundColor: replyText.trim() ? 'var(--accent-color)' : 'var(--glass-bg)',
                color: replyText.trim() ? 'white' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '6px',
                cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                fontSize: '0.8rem'
              }}
            >
              {t('common.send', 'Send')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsExpanded(true)}
      disabled={isDisabled}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontSize: '0.8rem',
        padding: '4px 8px',
        borderRadius: '4px',
        opacity: isDisabled ? 0.5 : 0.7,
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => !isDisabled && (e.target.style.opacity = '1')}
      onMouseLeave={(e) => !isDisabled && (e.target.style.opacity = '0.7')}
      title={t('reply.replyToMessage', 'Reply to this message')}
    >
      ↩️ {t('reply.reply', 'Reply')}
    </button>
  );
};

export default ReplyButton;