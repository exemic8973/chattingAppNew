import React, { createContext, useContext, useState, useEffect } from 'react';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

const translations = {
  'en': en,
  'zh-CN': zhCN
};

const I18nContext = createContext();

// Detect browser language
const detectLanguage = () => {
  const savedLang = localStorage.getItem('chatAppLanguage');
  if (savedLang && translations[savedLang]) {
    return savedLang;
  }

  const browserLang = navigator.language || navigator.userLanguage;

  // Match exact locale (e.g., zh-CN)
  if (translations[browserLang]) {
    return browserLang;
  }

  // Match language code (e.g., zh matches zh-CN)
  const langCode = browserLang.split('-')[0];
  const matchedLocale = Object.keys(translations).find(key => key.startsWith(langCode));

  return matchedLocale || 'en'; // Default to English
};

export const I18nProvider = ({ children }) => {
  const [locale, setLocale] = useState(detectLanguage());

  useEffect(() => {
    localStorage.setItem('chatAppLanguage', locale);
  }, [locale]);

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[locale];

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    // If translation not found, try English fallback
    if (value === undefined) {
      value = translations['en'];
      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k];
        } else {
          value = key; // Return key if not found
          break;
        }
      }
    }

    // Replace parameters in the translation
    if (typeof value === 'string' && params) {
      Object.keys(params).forEach(param => {
        value = value.replace(`{${param}}`, params[param]);
      });
    }

    return value || key;
  };

  const changeLanguage = (newLocale) => {
    if (translations[newLocale]) {
      setLocale(newLocale);
    }
  };

  const availableLanguages = Object.keys(translations).map(key => ({
    code: key,
    name: translations[key].language[key === 'en' ? 'english' : 'chinese']
  }));

  return (
    <I18nContext.Provider value={{ locale, t, changeLanguage, availableLanguages }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};
