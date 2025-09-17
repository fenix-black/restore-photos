'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Dropzone from './Dropzone';
import StepIndicator from './StepIndicator';
import ImageRestorationStage from './ImageRestorationStage';
import VideoDisplay from './VideoDisplay';
import { RestartIcon } from './icons/RestartIcon';
import LanguageSwitcher from './LanguageSwitcher';
import RateLimitAlert from './RateLimitAlert';
import { useLocalization } from '@/contexts/LocalizationContext';
import { AppStep, ImageAnalysis } from '@/types';
import * as apiClient from '@/services/api-client';
import { shareContent, createPhotoShareOptions, createVideoShareOptions } from '@/lib/share-utils';
import { getBrowserFingerprint } from '@/lib/fingerprint';
import { eyeColorCache, EyeColor } from '@/lib/eye-color-cache';

function PhotoRestoreApp() {
  const { t, language } = useLocalization();
  const [currentStep, setCurrentStep] = useState<AppStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [originalImage, setOriginalImage] = useState<{ file: File; base64: string; mimeType: string } | null>(null);
  const [restoredImage, setRestoredImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [displayVideoPrompt, setDisplayVideoPrompt] = useState<string>('');
  const [enhancedRestoration, setEnhancedRestoration] = useState<boolean>(false); // Default to disabled for better face preservation
  const [browserFingerprint, setBrowserFingerprint] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    limit: number;
    remaining: number;
    resetTime: Date;
    country: string;
  } | null>(null);
  
  // Eye color selection state
  const [selectedEyeColor, setSelectedEyeColor] = useState<EyeColor | undefined>(undefined);
  const [cachedEyeColors, setCachedEyeColors] = useState<EyeColor[]>([]);
  const [isEyeColorLoading, setIsEyeColorLoading] = useState(false);

  // Initialize browser fingerprint on component mount
  useEffect(() => {
    const initFingerprint = async () => {
      try {
        const fingerprint = await getBrowserFingerprint();
        setBrowserFingerprint(fingerprint);
      } catch (error) {
        console.warn('Failed to generate browser fingerprint:', error);
      }
    };
    
    initFingerprint();
  }, []);

  const resetState = () => {
    setCurrentStep('idle');
    setError(null);
    setLoadingMessage('');
    setOriginalImage(null);
    setRestoredImage(null);
    setImageAnalysis(null);
    setDisplayVideoPrompt('');
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    // Clear eye color state
    setSelectedEyeColor(undefined);
    setCachedEyeColors([]);
    setIsEyeColorLoading(false);
    // Clear cache for previous image
    eyeColorCache.clearAllCache();
  };

  const handleImageDrop = useCallback(async (file: File) => {
    if (currentStep !== 'idle') return;

    try {
      setError(null);
      setCurrentStep('analyzing');
      const { base64, mimeType } = await apiClient.fileToGenerativePart(file);
      setOriginalImage({ file, base64, mimeType });

      const analysis = await apiClient.analyzeImage(base64, mimeType, language, t('videoPromptExample'));
      console.log('Image analysis complete:', {
        containsChildren: analysis.containsChildren,
        needsPerspectiveCorrection: analysis.needsPerspectiveCorrection,
        hasManyPeople: analysis.hasManyPeople,
        isBlackAndWhite: analysis.isBlackAndWhite,
        isVeryOld: analysis.isVeryOld,
        personCount: analysis.personCount,
        hasEyeColorPotential: analysis.hasEyeColorPotential,
        lighting: analysis.lightingInfo,
        suggestedFilename: analysis.suggestedFilename
      });
      console.log('Lighting analysis:', analysis.lightingInfo.description);
      console.log('Restoration prompt with lighting:', analysis.restorationPrompt);
      setImageAnalysis(analysis);

      let imageToRestore = { base64, mimeType };

      // Determine if we should use double-pass restoration (only if user enabled it)
      console.log('Enhanced restoration checkbox state:', enhancedRestoration);
      const shouldUseDoublePass = enhancedRestoration && (analysis.hasManyPeople || analysis.isBlackAndWhite || analysis.isVeryOld);
      console.log('Should use double-pass:', shouldUseDoublePass, '(enhanced:', enhancedRestoration, ', B&W:', analysis.isBlackAndWhite, ', old:', analysis.isVeryOld, ', many people:', analysis.hasManyPeople, ')');
      
      if (analysis.needsPerspectiveCorrection) {
        setCurrentStep('correcting');
        console.log('Photo-within-photo detected. Extracting and correcting perspective...');
        const corrected = await apiClient.editImage(
          base64, 
          mimeType, 
          "CRITICAL: Preserve ALL facial features, structures, and identities exactly - do not alter or distort any faces. Extract and isolate ONLY the photograph itself from the image, removing any background like tables, walls, hands, or frames. Correct the perspective to make it straight and aligned. Crop precisely to the photograph's actual edges, excluding any surrounding environment. Maintain all original photo content, colors, and especially facial integrity. Apply minimal transformation to avoid distortion.", 
          false,
          browserFingerprint || undefined,
          undefined, // no eye color for perspective correction
          false, // no eye color potential for perspective correction
          analysis.personCount // pass person count for strict preservation
        );
        console.log('Photo extraction and perspective correction completed');
        imageToRestore = { base64: corrected.data, mimeType: corrected.mimeType };
      }

      setCurrentStep('restoring');
      
      // Log restoration approach
      if (analysis.needsPerspectiveCorrection) {
        console.log('Starting restoration on extracted photograph...');
      }
      
      if (enhancedRestoration) {
        if (shouldUseDoublePass) {
          const reasons = [];
          if (analysis.hasManyPeople) reasons.push('many people (7+)');
          if (analysis.isBlackAndWhite) reasons.push('black & white');
          if (analysis.isVeryOld) reasons.push('very old photo');
          console.log(`Enhanced restoration enabled - Using Gemini first, then Flux enhancement due to: ${reasons.join(', ')}`);
        } else {
          console.log('Enhanced restoration enabled - Using single pass (modern/simple photo)');
        }
      } else {
        console.log('Enhanced restoration disabled - Using Gemini single pass only');
      }
      
      const restored = await apiClient.editImage(imageToRestore.base64, imageToRestore.mimeType, analysis.restorationPrompt, shouldUseDoublePass, browserFingerprint || undefined, undefined, analysis.hasEyeColorPotential, analysis.personCount);
      setRestoredImage({ base64: restored.data, mimeType: restored.mimeType });
      
      // Commented out containsChildren check to allow video generation for all photos
      // if (analysis.containsChildren) {
      //   setCurrentStep('done');
      // } else {
        if (language === 'es') {
          setCurrentStep('translating');
          const translatedPrompt = await apiClient.translateText(analysis.videoPrompt, 'es');
          setDisplayVideoPrompt(translatedPrompt);
        } else {
          setDisplayVideoPrompt(analysis.videoPrompt);
        }
        setCurrentStep('readyForVideo');
      // }

    } catch (err: any) {
      console.error(err);
      
      // Check if this is a rate limit error
      if (err.isRateLimit && err.rateLimitInfo) {
        setRateLimitInfo({
          ...err.rateLimitInfo,
          resetTime: new Date(err.rateLimitInfo.resetTime)
        });
        setCurrentStep('idle');
        return;
      }
      
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setCurrentStep('idle');
    }
  }, [currentStep, language, t, enhancedRestoration]);

  const handleGenerateVideo = useCallback(async () => {
    if (!imageAnalysis || !restoredImage) return;

    try {
      setError(null);
      setCurrentStep('generatingVideo');
      const progressMessages = JSON.parse(t('videoMessages')) as string[];
      const url = await apiClient.generateVideo(
        imageAnalysis.videoPrompt, // Always use the original English prompt for the model
        setLoadingMessage,
        { base64: restoredImage.base64, mimeType: restoredImage.mimeType },
        progressMessages
      );
      setVideoUrl(url);
      setCurrentStep('done');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during video generation.');
      setCurrentStep('readyForVideo');
      setLoadingMessage('');
    }
  }, [imageAnalysis, restoredImage, t]);

  const handleEyeColorSelect = useCallback(async (eyeColor: EyeColor) => {
    if (!originalImage || !restoredImage || !imageAnalysis || isEyeColorLoading) return;

    try {
      setIsEyeColorLoading(true);
      setError(null);

      // Check if this eye color is already cached
      const cached = eyeColorCache.getCachedImage(restoredImage.base64, eyeColor);
      if (cached) {
        console.log(`Using cached image for eye color: ${eyeColor}`);
        setRestoredImage({ base64: cached.base64, mimeType: cached.mimeType });
        setSelectedEyeColor(eyeColor);
        return;
      }

      console.log(`Applying eye color ${eyeColor} to restored image`);
      
      // Create a simpler prompt for eye color change on already restored image
      const eyeColorPrompt = `ONLY change the eye color to natural ${eyeColor}. Keep EVERYTHING else exactly the same - face, expression, lighting, colors, clothing. Just make the irises a natural ${eyeColor} color with appropriate reflections and depth.`;
      
      // Use the RESTORED image (not original) for eye color modification
      // Single pass only since we're just changing eye color
      const restored = await apiClient.editImage(
        restoredImage.base64,  // Use restored image instead of original
        restoredImage.mimeType, 
        eyeColorPrompt,  // Simple eye color prompt
        false,  // No double-pass needed for eye color change
        browserFingerprint || undefined,
        eyeColor,
        imageAnalysis.hasEyeColorPotential,
        imageAnalysis.personCount
      );

      // Cache the result using restored image as key
      eyeColorCache.setCachedImage(restoredImage.base64, eyeColor, {
        base64: restored.data,
        mimeType: restored.mimeType
      });
      
      // Update state
      setRestoredImage({ base64: restored.data, mimeType: restored.mimeType });
      setSelectedEyeColor(eyeColor);
      
      // Update cached colors list
      const updatedCachedColors = eyeColorCache.getCachedEyeColors(restoredImage.base64);
      setCachedEyeColors(updatedCachedColors);
      
      console.log(`Eye color restoration complete for: ${eyeColor}`);
    } catch (err: any) {
      console.error('Eye color restoration failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply eye color enhancement.');
    } finally {
      setIsEyeColorLoading(false);
    }
  }, [originalImage, restoredImage, imageAnalysis, isEyeColorLoading, enhancedRestoration, browserFingerprint]);

  const downloadImage = (base64: string, mimeType: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const getFileExtension = (mimeType: string) => {
    // Extract extension from MIME type, default to jpg for restored images
    const ext = mimeType.split('/')[1];
    return ext === 'jpeg' ? 'jpg' : (ext || 'jpg');
  }

  const handleDownloadRestored = () => {
    if (restoredImage) {
        const ext = getFileExtension(restoredImage.mimeType);
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = imageAnalysis?.suggestedFilename 
          ? `${imageAnalysis.suggestedFilename}-restored-${timestamp}.${ext}`
          : `restored-photo-${timestamp}.${ext}`;
        downloadImage(restoredImage.base64, restoredImage.mimeType, filename);
    }
  }

  const handleDownloadVideo = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      const ext = 'mp4';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = imageAnalysis?.suggestedFilename 
        ? `${imageAnalysis.suggestedFilename}-animated-${timestamp}.${ext}`
        : `animated-memory-${timestamp}.${ext}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSharePhoto = async () => {
    const shareOptions = createPhotoShareOptions(
      t('sharePhotoMessage'),
      t('shareUrl'),
      t('shareTitle'),
      t('shareFailedMessage')
    );
    await shareContent(shareOptions);
  };

  const handleShareVideo = async () => {
    const shareOptions = createVideoShareOptions(
      t('shareVideoMessage'),
      t('shareUrl'),
      t('shareTitle'),
      t('shareFailedMessage')
    );
    await shareContent(shareOptions);
  };

  return (
    <div className="bg-brand-background min-h-screen text-brand-light font-sans">
      {/* Rate Limit Alert Modal */}
      {rateLimitInfo && (
        <RateLimitAlert 
          rateLimitInfo={rateLimitInfo} 
          onClose={() => setRateLimitInfo(null)} 
        />
      )}
      
      <header className="relative p-4 sm:p-6 flex flex-col justify-center items-center text-center">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-brand-secondary to-brand-accent bg-clip-text text-transparent">
            {t('appTitle')}
          </h1>
        </div>
        <p className="mt-2 text-md text-gray-400 max-w-2xl">{t('appSubtitle')}</p>
        <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2">
            <LanguageSwitcher />
        </div>
      </header>

      <main className="container mx-auto px-4 pb-12 pt-4 flex flex-col items-center gap-8">
        {/* Enhanced Restoration Toggle - Keep mounted but conditionally visible */}
        <div className={`flex items-center gap-3 ${currentStep === 'idle' ? '' : 'hidden'}`}>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={enhancedRestoration}
              onChange={(e) => setEnhancedRestoration(e.target.checked)}
              className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-2"
            />
            <span className="ml-2 text-gray-300 group-hover:text-white transition-colors">
              {t('enhancedRestoration')}
            </span>
          </label>
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
                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-10">
                  {t('enhancedRestorationTooltip')}
                </div>
              </div>
        </div>
        
        {currentStep === 'idle' && (
          <>
            {/* Dropzone for image upload */}
            <Dropzone onImageDrop={handleImageDrop} />
          </>
        )}
        
        {error && (
            <div className="w-full max-w-2xl p-4 bg-red-900/50 border border-red-700 rounded-lg text-center text-red-200">
                <p><strong>{t('errorTitle')}</strong></p>
                <p>{error}</p>
            </div>
        )}

        {currentStep !== 'idle' && (
            <div className="w-full max-w-2xl flex flex-col items-center gap-8">
                <button
                    onClick={resetState}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105"
                >
                    <RestartIcon className="w-5 h-5" />
                    {t('buttonRestoreAnother')}
                </button>

                <StepIndicator currentStep={currentStep} />

                {originalImage && (currentStep !== 'analyzing') && (
                  <ImageRestorationStage
                    title={t('stageTitleRestoration')}
                    originalImage={originalImage.base64}
                    processedImage={restoredImage?.base64 || null}
                    isLoading={['correcting', 'restoring', 'analyzing'].includes(currentStep)}
                    isDownloadable={!!restoredImage && ['readyForVideo', 'generatingVideo', 'done'].includes(currentStep)}
                    onDownload={handleDownloadRestored}
                    onShare={handleSharePhoto}
                    showEyeColorSelector={imageAnalysis?.hasEyeColorPotential && ['readyForVideo', 'generatingVideo', 'done'].includes(currentStep)}
                    selectedEyeColor={selectedEyeColor}
                    cachedEyeColors={cachedEyeColors}
                    isEyeColorLoading={isEyeColorLoading}
                    onEyeColorSelect={handleEyeColorSelect}
                  />
                )}

                {/* Commented out containsChildren check to allow video generation for all photos */}
                {restoredImage && imageAnalysis && /* !imageAnalysis.containsChildren && */ ['readyForVideo', 'generatingVideo', 'done'].includes(currentStep) && (
                    <VideoDisplay
                        description={displayVideoPrompt}
                        videoUrl={videoUrl}
                        isLoading={currentStep === 'generatingVideo'}
                        loadingMessage={loadingMessage}
                        onGenerate={handleGenerateVideo}
                        onDownload={handleDownloadVideo}
                        onShare={handleShareVideo}
                    />
                )}
            </div>
        )}
      </main>

      <footer className="text-center p-4 text-sm">
        <a
          href="https://www.fenixblack.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white hover:underline transition-colors duration-300 flex flex-col items-center justify-center gap-2"
        >
          <img
            src="/ave-solo-alpha.png"
            alt="Ave Solo Logo"
            className="object-contain"
          />
          {t('footerText')}
        </a>
      </footer>
    </div>
  );
}

export default PhotoRestoreApp;
