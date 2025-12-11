import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
    const { locale, changeLanguage, availableLanguages, t } = useI18n();
    const [showMenu, setShowMenu] = useState(false);

    const handleLanguageChange = (langCode) => {
        changeLanguage(langCode);
        setShowMenu(false);
    };

    const currentLang = availableLanguages.find(lang => lang.code === locale);

    return (
        <div className="language-switcher">
            <button
                className="action-btn language-btn"
                onClick={() => setShowMenu(!showMenu)}
                title={t('language.title')}
            >
                🌐
            </button>

            {showMenu && (
                <>
                    <div className="lang-overlay" onClick={() => setShowMenu(false)}></div>
                    <div className="lang-menu">
                        <div className="lang-menu-header">
                            {t('language.title')}
                        </div>
                        {availableLanguages.map(lang => (
                            <button
                                key={lang.code}
                                className={`lang-menu-item ${locale === lang.code ? 'active' : ''}`}
                                onClick={() => handleLanguageChange(lang.code)}
                            >
                                <span className="lang-checkmark">
                                    {locale === lang.code ? '✓' : ''}
                                </span>
                                {lang.name}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default LanguageSwitcher;
