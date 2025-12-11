import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import UserAutocomplete from './UserAutocomplete';
import './InviteUserModal.css';

const InviteUserModal = ({ users, onClose, onInvite }) => {
    const { t } = useI18n();
    const handleSelect = (username) => {
        onInvite(username);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{t('modal.inviteUser')}</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <UserAutocomplete
                        users={users}
                        onSelect={handleSelect}
                        placeholder={t('modal.typeUsername')}
                    />
                </div>
            </div>
        </div>
    );
};

export default InviteUserModal;
