'use client';

import { GrowthKitAccountWidget } from '@fenixblack/growthkit';
import { useState, useRef, useEffect } from 'react';
import type { GrowthKitAccountWidgetRef } from '@fenixblack/growthkit';
import PhotoRestoreApp from '@/components/PhotoRestoreApp';
import { useLocalization } from '@/contexts/LocalizationContext';

function HomeContent() {
  const { language } = useLocalization();
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'es'>(language);
  
  // Sync with localization context changes
  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);
  
  const config = {
    apiKey: process.env.NEXT_PUBLIC_GROWTHKIT_API_KEY || '',
    apiUrl: `${process.env.NEXT_PUBLIC_GROWTHKIT_SERVER_URL || 'https://growth.fenixblack.ai'}/api`,
    debug: process.env.NODE_ENV === 'development',
    language: currentLanguage,
  };

  const accountWidgetRef = useRef<GrowthKitAccountWidgetRef>(null);
  
  // Function to handle language switching from LanguageSwitcher
  const handleLanguageToggle = (newLanguage: 'en' | 'es') => {
    setCurrentLanguage(newLanguage);
    
    // Also update the widget's language programmatically
    setTimeout(() => {
      accountWidgetRef.current?.setLanguage(newLanguage);
    }, 100);
  };

  return (
    <GrowthKitAccountWidget 
      config={config}
      ref={accountWidgetRef}
      position="top-right"
      theme="auto"
      onCreditsChange={(credits: number) => {
        console.log('Credits updated:', credits);
      }}
      onProfileChange={(profile: { name?: string; email?: string; verified?: boolean }) => {
        console.log('Profile updated:', profile);
      }}
    >
      <PhotoRestoreApp 
        accountWidgetRef={accountWidgetRef}
        currentLanguage={currentLanguage}
        onLanguageToggle={handleLanguageToggle}
      />
    </GrowthKitAccountWidget>
  );
}

export default function Home() {
  return <HomeContent />;
}