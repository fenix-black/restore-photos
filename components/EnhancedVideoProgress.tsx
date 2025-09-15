'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocalization } from '@/contexts/LocalizationContext';
import CameraMascot from './CameraMascot';

interface EnhancedVideoProgressProps {
  videoPrompt: string;
  isGenerating: boolean;
  onDirectorCommentaryGenerated?: (comments: string[]) => void;
}

const EnhancedVideoProgress: React.FC<EnhancedVideoProgressProps> = ({ 
  videoPrompt, 
  isGenerating,
  onDirectorCommentaryGenerated 
}) => {
  const { t, language } = useLocalization();
  const [timeRemaining, setTimeRemaining] = useState(240); // 4 minutes in seconds
  const [currentCommentary, setCurrentCommentary] = useState<string>('');
  const [directorComments, setDirectorComments] = useState<string[]>([]);
  const [commentIndex, setCommentIndex] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const commentIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate director's commentary when video generation starts
  useEffect(() => {
    if (isGenerating && videoPrompt && directorComments.length === 0) {
      generateDirectorCommentary();
    }
  }, [isGenerating, videoPrompt]);

  // Countdown timer
  useEffect(() => {
    if (!isGenerating) {
      setTimeRemaining(240);
      startTimeRef.current = null;
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
      const remaining = Math.max(0, 240 - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  // Rotate director comments
  useEffect(() => {
    if (directorComments.length === 0) return;

    setCurrentCommentary(directorComments[0]);
    
    commentIntervalRef.current = setInterval(() => {
      setCommentIndex((prev) => {
        const nextIndex = (prev + 1) % directorComments.length;
        setCurrentCommentary(directorComments[nextIndex]);
        return nextIndex;
      });
    }, 15000); // Change every 15 seconds

    return () => {
      if (commentIntervalRef.current) {
        clearInterval(commentIntervalRef.current);
      }
    };
  }, [directorComments]);

  const generateDirectorCommentary = async () => {
    try {
      const response = await fetch('/api/generate-director-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoPrompt, 
          language 
        }),
      });

      if (response.ok) {
        const { comments } = await response.json();
        setDirectorComments(comments);
        if (onDirectorCommentaryGenerated) {
          onDirectorCommentaryGenerated(comments);
        }
      } else {
        // Fallback comments if API fails
        setDirectorComments(getDefaultComments());
      }
    } catch (error) {
      console.error('Failed to generate director commentary:', error);
      setDirectorComments(getDefaultComments());
    }
  };

  const getDefaultComments = () => {
    if (language === 'es') {
      return [
        "🎬 Preparando la escena perfecta...",
        "📸 ¡Excelente! Mantén esa expresión...",
        "✨ La iluminación está quedando perfecta...",
        "🎥 Capturando la magia del momento...",
        "🌟 ¡Hermoso! Este será un recuerdo inolvidable...",
        "🎞️ Ajustando los últimos detalles...",
      ];
    }
    return [
      "🎬 Setting up the perfect scene...",
      "📸 Excellent! Hold that expression...",
      "✨ The lighting is coming together beautifully...",
      "🎥 Capturing the magic of the moment...",
      "🌟 Beautiful! This will be an unforgettable memory...",
      "🎞️ Adjusting the final details...",
    ];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = ((240 - timeRemaining) / 240) * 100;

  if (!isGenerating) return null;

  return (
    <div className="relative w-full max-w-2xl mx-auto p-8 space-y-6">
      {/* Countdown Timer with Progress Ring */}
      <div className="flex flex-col items-center space-y-4">
        <div className="relative w-32 h-32">
          {/* Progress Ring */}
          <svg className="w-32 h-32 transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-700"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 56}`}
              strokeDashoffset={`${2 * Math.PI * 56 * (1 - progressPercentage / 100)}`}
              className="text-brand-secondary transition-all duration-1000 ease-linear"
              strokeLinecap="round"
            />
          </svg>
          {/* Timer Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-blue-300">{formatTime(timeRemaining)}</span>
            <span className="text-xs text-gray-400">
              {timeRemaining > 0 ? t('remaining') || 'remaining' : t('almostDone') || 'Almost done...'}
            </span>
          </div>
        </div>
        
        {/* Estimated Time Text */}
        <p className="text-sm text-gray-400">
          {timeRemaining > 0 
            ? `${t('estimatedTime') || 'Estimated time'}: ${formatTime(timeRemaining)}`
            : t('finalizingVideo') || 'Finalizing your video...'}
        </p>
      </div>

      {/* Director's Commentary */}
      {currentCommentary && (
        <div className="relative bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg p-4 border border-purple-500/30">
          <div className="absolute -top-3 left-4 bg-brand-background px-2">
            <span className="text-xs text-purple-400 font-semibold">
              {t('directorNotes') || "Director's Notes"}
            </span>
          </div>
          <p className="text-gray-300 italic text-center animate-fade-in">
            "{currentCommentary}"
          </p>
        </div>
      )}

      {/* Cute Camera Mascot */}
      <div className="relative h-32">
        <CameraMascot isActive={isGenerating} progress={progressPercentage} />
      </div>

      {/* Fun Loading Message */}
      <p className="text-center text-sm text-gray-500 animate-pulse">
        {t('creatingMagic') || '✨ Creating something magical from your memories...'}
      </p>
    </div>
  );
};

export default EnhancedVideoProgress;
