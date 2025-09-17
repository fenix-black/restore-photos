'use client';

import React, { useState } from 'react';
import { EyeColor, EYE_COLORS } from '@/lib/eye-color-cache';
import { useLocalization } from '@/contexts/LocalizationContext';
import Spinner from './Spinner';

interface EyeColorSelectorProps {
  onEyeColorSelect: (eyeColor: EyeColor) => void;
  selectedColor?: EyeColor;
  isLoading?: boolean;
  cachedColors?: EyeColor[];
}

const EyeColorSelector: React.FC<EyeColorSelectorProps> = ({
  onEyeColorSelect,
  selectedColor,
  isLoading = false,
  cachedColors = [],
}) => {
  const { t } = useLocalization();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleColorSelect = (eyeColor: EyeColor) => {
    if (isLoading) return;
    onEyeColorSelect(eyeColor);
    setIsExpanded(false);
  };

  return (
    <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <svg
          className="w-5 h-5 text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <h4 className="text-sm font-semibold text-gray-300">
          {t('eyeColorSelectorTitle') || 'Choose Eye Color'}
        </h4>
        <div className="relative group">
          <svg 
            className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
            {t('eyeColorSelectorTooltip') || 'Select different eye colors to enhance the portrait. Previously selected colors load instantly from cache.'}
          </div>
        </div>
      </div>

      {/* Color Options */}
      <div className="space-y-2">
        {/* Compact view - show selected color */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              {selectedColor ? (
                <>
                  <div
                    className="w-6 h-6 rounded-full border-2 border-gray-400"
                    style={{ backgroundColor: EYE_COLORS.find(c => c.value === selectedColor)?.color }}
                  />
                  <span className="text-gray-200">
                    {EYE_COLORS.find(c => c.value === selectedColor)?.label}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-full border-2 border-gray-400 bg-gray-600" />
                  <span className="text-gray-400">
                    {t('eyeColorSelectorSelectColor') || 'Select eye color...'}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isLoading && <Spinner className="w-4 h-4" />}
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        )}

        {/* Expanded view - show all colors */}
        {isExpanded && (
          <div className="space-y-1">
            {EYE_COLORS.map((eyeColor) => {
              const isCached = cachedColors.includes(eyeColor.value);
              const isSelected = selectedColor === eyeColor.value;
              
              return (
                <button
                  key={eyeColor.value}
                  onClick={() => handleColorSelect(eyeColor.value)}
                  disabled={isLoading}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full border-2 ${
                      isSelected ? 'border-white' : 'border-gray-400'
                    }`}
                    style={{ backgroundColor: eyeColor.color }}
                  />
                  <span className="flex-1 text-left">{eyeColor.label}</span>
                  {isCached && (
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-4 h-4 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs text-green-400">
                        {t('eyeColorSelectorCached') || 'Cached'}
                      </span>
                    </div>
                  )}
                  {isLoading && isSelected && (
                    <Spinner className="w-4 h-4" />
                  )}
                </button>
              );
            })}
            
            {/* Collapse button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="w-full p-2 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              {t('eyeColorSelectorCollapse') || 'Collapse'}
            </button>
          </div>
        )}
      </div>

      {/* Status message */}
      {isLoading && (
        <div className="mt-2 text-xs text-gray-400 flex items-center gap-2">
          <Spinner className="w-3 h-3" />
          {t('eyeColorSelectorEnhancing') || 'Enhancing eye color...'}
        </div>
      )}
    </div>
  );
};

export default EyeColorSelector;
