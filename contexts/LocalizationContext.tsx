'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import enTranslations from '@/locales/en.json';
import esTranslations from '@/locales/es.json';

type Language = 'en' | 'es';
type Translations = Record<string, string>;

interface LocalizationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const translations: Record<Language, Translations> = {
  en: enTranslations,
  es: esTranslations,
};

const detectBrowserLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en'; // SSR fallback
  
  // Get browser languages in order of preference
  const browserLanguages = navigator.languages || [navigator.language];
  
  for (const lang of browserLanguages) {
    // Extract language code (e.g., 'en-US' -> 'en', 'es-MX' -> 'es')
    const langCode = lang.toLowerCase().split('-')[0] as Language;
    
    // Check if we support this language
    if (translations[langCode]) {
      return langCode;
    }
  }
  
  // Fallback to English
  return 'en';
};

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    // Check for saved user preference first (explicit choice takes priority)
    const savedLanguage = localStorage.getItem('preferredLanguage') as Language;
    if (savedLanguage && translations[savedLanguage]) {
      setLanguage(savedLanguage);
    } else {
      // No saved preference, use browser language detection as default
      const detectedLanguage = detectBrowserLanguage();
      setLanguage(detectedLanguage);
    }
  }, []);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LocalizationContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};
