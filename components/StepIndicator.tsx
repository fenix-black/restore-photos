'use client';

import React from 'react';
import type { AppStep } from '@/types';
import Spinner from './Spinner';
import { useLocalization } from '@/contexts/LocalizationContext';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const steps: { id: AppStep; labelKey: string }[] = [
  { id: 'analyzing', labelKey: 'stepAnalyzing' },
  { id: 'correcting', labelKey: 'stepCorrecting' },
  { id: 'restoring', labelKey: 'stepRestoring' },
  { id: 'translating', labelKey: 'stepTranslating' },
  { id: 'readyForVideo', labelKey: 'stepReadyForVideo' },
  { id: 'generatingVideo', labelKey: 'stepGeneratingVideo' },
  { id: 'done', labelKey: 'stepDone' },
];

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const { t } = useLocalization();
  const currentIndex = steps.findIndex(step => step.id === currentStep);
  const currentLabelKey = steps[currentIndex]?.labelKey || 'stepStarting';
  
  const showSpinnerFor = ['analyzing', 'correcting', 'restoring', 'translating', 'generatingVideo'];

  return (
    <div className="w-full max-w-2xl p-4 bg-brand-dark/50 rounded-lg animate-fade-in">
        <div className="flex items-center justify-center space-x-2">
           {showSpinnerFor.includes(currentStep) && <Spinner/>}
           <p className="text-lg font-medium text-blue-300">{t(currentLabelKey)}</p>
        </div>
    </div>
  );
};

export default StepIndicator;