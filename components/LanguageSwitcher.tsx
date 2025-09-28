'use client';

import React from 'react';
import { useLocalization } from '@/contexts/LocalizationContext';

interface LanguageSwitcherProps {
  onLanguageChange?: (language: 'en' | 'es') => void;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ onLanguageChange }) => {
  const { language, setLanguage } = useLocalization();

  const handleLanguageChange = (newLanguage: 'en' | 'es') => {
    setLanguage(newLanguage);
    if (onLanguageChange) {
      onLanguageChange(newLanguage);
    }
  };

  return (
    <div className="flex items-center space-x-2 p-1 bg-brand-dark/50 rounded-full">
      <button
        onClick={() => handleLanguageChange('en')}
        className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${
          language === 'en'
            ? 'bg-brand-secondary text-white'
            : 'bg-transparent text-gray-400 hover:bg-gray-700'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => handleLanguageChange('es')}
        className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${
          language === 'es'
            ? 'bg-brand-secondary text-white'
            : 'bg-transparent text-gray-400 hover:bg-gray-700'
        }`}
      >
        ES
      </button>
    </div>
  );
};

export default LanguageSwitcher;
