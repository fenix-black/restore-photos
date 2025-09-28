'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useGrowthKit } from '@fenixblack/growthkit';
import type { GrowthKitAccountWidgetRef } from '@fenixblack/growthkit';
import Dropzone from './Dropzone';
import StepIndicator from './StepIndicator';
import ImageRestorationStage from './ImageRestorationStage';
import VideoDisplay from './VideoDisplay';
import { RestartIcon } from './icons/RestartIcon';
import LanguageSwitcher from './LanguageSwitcher';
import { useLocalization } from '@/contexts/LocalizationContext';
import { AppStep, ImageAnalysis } from '@/types';
import * as apiClient from '@/services/api-client';
import { shareContent, createPhotoShareOptions, createVideoShareOptions } from '@/lib/share-utils';
import { eyeColorCache, EyeColor } from '@/lib/eye-color-cache';
import { trackRestorationCompleted, trackVideoGenerated, trackError } from '@/lib/analytics';

interface PhotoRestoreAppProps {
  accountWidgetRef: React.RefObject<GrowthKitAccountWidgetRef | null>;
  currentLanguage: 'en' | 'es';
  onLanguageToggle: (newLanguage: 'en' | 'es') => void;
}

function PhotoRestoreApp({ accountWidgetRef, currentLanguage, onLanguageToggle }: PhotoRestoreAppProps) {
  const { t, language } = useLocalization();
  const { credits, completeAction, track } = useGrowthKit();
  const [currentStep, setCurrentStep] = useState<AppStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [originalImage, setOriginalImage] = useState<{ file: File; base64: string; mimeType: string } | null>(null);
  const [restoredImage, setRestoredImage] = useState<{ base64: string; mimeType: string; videoBase64?: string; videoMimeType?: string } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [displayVideoPrompt, setDisplayVideoPrompt] = useState<string>('');
  const [enhancedRestoration, setEnhancedRestoration] = useState<boolean>(false); // Default to disabled for better face preservation
  
  // Eye color selection state
  const [selectedEyeColor, setSelectedEyeColor] = useState<EyeColor | undefined>(undefined);
  const [cachedEyeColors, setCachedEyeColors] = useState<EyeColor[]>([]);
  const [isEyeColorLoading, setIsEyeColorLoading] = useState(false);


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
    
    // Check if user has enough credits for photo restoration (1 credit)
    if (credits < 1) {
      setError(t('insufficientCreditsPhoto') || 'Not enough credits for photo restoration. Please get more credits.');
      track('action_blocked', { action: 'photo_restoration', reason: 'insufficient_credits', creditsRequired: 1 });
      return;
    }

    // Consume 1 credit for photo restoration
    const success = await completeAction('restore_photo', { creditsRequired: 1, usdValue: 0.25 });
    if (!success) {
      setError(t('creditConsumptionFailed') || 'Failed to process credit payment. Please try again.');
      track('credit_consumption_failed', { action: 'photo_restoration', creditsRequired: 1 });
      return;
    }

    // Track successful credit consumption
    track('credit_consumed', { action: 'photo_restoration', creditsUsed: 1, usdValue: 0.25 });
    
    const startTime = Date.now(); // Track restoration start time

    try {
      setError(null);
      setCurrentStep('analyzing');
      const { base64, mimeType } = await apiClient.fileToGenerativePart(file);
      setOriginalImage({ file, base64, mimeType });

      // Retry logic for image analysis
      let analysis: ImageAnalysis | undefined;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          analysis = await apiClient.analyzeImage(base64, mimeType, language, t('videoPromptExample'));
          
          // Validate that we have the essential fields
          if (analysis && typeof analysis.containsChildren !== 'undefined') {
            break; // Success, exit retry loop
          }
          throw new Error('Incomplete analysis response');
        } catch (analysisError) {
          retryCount++;
          const errorMessage = analysisError instanceof Error ? analysisError.message : String(analysisError);
          console.error(`Analysis attempt ${retryCount} failed:`, analysisError);
          
          if (retryCount >= maxRetries) {
            throw new Error(`Failed to analyze image after ${maxRetries} attempts: ${errorMessage}`);
          }
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      // Ensure analysis is defined after retry loop
      if (!analysis) {
        throw new Error('Failed to analyze image: analysis result is undefined');
      }
      
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
      
      // Use optional chaining to avoid errors if lightingInfo is undefined (but it should always be there)
      if (analysis.lightingInfo?.description) {
        console.log('Lighting analysis:', analysis.lightingInfo.description);
      }
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
          undefined,
          undefined, // no eye color for perspective correction
          false, // no eye color potential for perspective correction
          analysis.personCount, // pass person count for strict preservation
          analysis.isBlackAndWhite // pass B&W detection
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
          console.log(`Enhanced restoration enabled - Using CodeFormer first, then Gemini refinement due to: ${reasons.join(', ')}`);
        } else {
          console.log('Enhanced restoration enabled - Using single pass (modern/simple photo)');
        }
      } else {
        console.log('Enhanced restoration disabled - Using Gemini single pass only');
      }
      
      const restored = await apiClient.editImage(imageToRestore.base64, imageToRestore.mimeType, analysis.restorationPrompt, shouldUseDoublePass, undefined, undefined, analysis.hasEyeColorPotential, analysis.personCount, analysis.isBlackAndWhite);
      setRestoredImage({ 
        base64: restored.data, 
        mimeType: restored.mimeType,
        videoBase64: restored.videoData,
        videoMimeType: restored.videoMimeType
      });
      
      // Track successful restoration
      trackRestorationCompleted(
        enhancedRestoration ? 'enhanced' : 'standard',
        startTime
      );
      
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
      
      // Track error before handling - determine stage based on what was completed
      const stage = !imageAnalysis ? 'analysis' : 'restoration';
      trackError(stage, err?.message || 'unknown_error');
      
      
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setCurrentStep('idle');
    }
  }, [currentStep, language, t, enhancedRestoration, credits, completeAction, track]);

  const handleGenerateVideo = useCallback(async () => {
    if (!imageAnalysis || !restoredImage) return;

    // Check if user has enough credits for video generation (2 credits)
    if (credits < 2) {
      setError(t('insufficientCreditsVideo') || 'Not enough credits for video generation. Please get more credits.');
      track('action_blocked', { action: 'video_generation', reason: 'insufficient_credits', creditsRequired: 2 });
      return;
    }

    // Consume 2 credits for video generation
    const success = await completeAction('generate_video', { creditsRequired: 2, usdValue: 0.75 });
    if (!success) {
      setError(t('creditConsumptionFailed') || 'Failed to process credit payment. Please try again.');
      track('credit_consumption_failed', { action: 'video_generation', creditsRequired: 2 });
      return;
    }

    // Track successful credit consumption
    track('credit_consumed', { action: 'video_generation', creditsUsed: 2, usdValue: 0.75 });

    const videoStartTime = Date.now(); // Track video generation start time

    try {
      setError(null);
      setCurrentStep('generatingVideo');
      const progressMessages = JSON.parse(t('videoMessages')) as string[];
      
      let veoJsonPrompt: string | undefined;
      
      // If using Gemini (no children), generate VEO JSON prompt first
      if (imageAnalysis.containsChildren === false) {
        setLoadingMessage('Preparing video generation...');
        try {
          veoJsonPrompt = await apiClient.generateVeoPrompt(
            imageAnalysis.videoPrompt,
            imageAnalysis,
            { base64: restoredImage.videoBase64 || restoredImage.base64, mimeType: restoredImage.videoMimeType || restoredImage.mimeType }  // Use video quality version
          );
          console.log('VEO JSON prompt generated successfully');
        } catch (veoError) {
          console.error('Failed to generate VEO prompt, continuing without it:', veoError);
          // Continue without VEO JSON prompt - will use fallback
        }
      }
      
      const url = await apiClient.generateVideo(
        imageAnalysis.videoPrompt, // Always use the original English prompt for the model
        setLoadingMessage,
        { base64: restoredImage.videoBase64 || restoredImage.base64, mimeType: restoredImage.videoMimeType || restoredImage.mimeType },  // Use video quality version if available
        progressMessages,
        imageAnalysis.containsChildren, // Pass the child detection flag
        imageAnalysis, // Pass full analysis for better prompt conversion
        veoJsonPrompt // Pass pre-computed VEO prompt if available
      );
      setVideoUrl(url);
      
      // Track successful video generation
      const model = imageAnalysis.containsChildren ? 'replicate' : 'gemini';
      trackVideoGenerated(model, videoStartTime);
      
      setCurrentStep('done');
    } catch (err) {
      console.error(err);
      
      // Track video generation error
      trackError('video', err instanceof Error ? err.message : 'unknown_video_error');
      
      setError(err instanceof Error ? err.message : 'An unknown error occurred during video generation.');
      setCurrentStep('readyForVideo');
      setLoadingMessage('');
    }
  }, [imageAnalysis, restoredImage, t, credits, completeAction, track]);

  const handleEyeColorSelect = useCallback(async (eyeColor: EyeColor) => {
    if (!originalImage || !restoredImage || !imageAnalysis || isEyeColorLoading) return;

    const eyeColorStartTime = Date.now(); // Track eye color restoration start time

    try {
      setIsEyeColorLoading(true);
      setError(null);

      // Check if this eye color is already cached
      const cached = eyeColorCache.getCachedImage(restoredImage.base64, eyeColor);
      if (cached) {
        console.log(`Using cached image for eye color: ${eyeColor}`);
        setRestoredImage({ 
          base64: cached.base64, 
          mimeType: cached.mimeType,
          videoBase64: restoredImage.videoBase64,  // Preserve original video data
          videoMimeType: restoredImage.videoMimeType
        });
        setSelectedEyeColor(eyeColor);
        
        // Track cached eye color restoration (very fast)
        trackRestorationCompleted('eye_color', eyeColorStartTime);
        return;
      }

      console.log(`Applying eye color ${eyeColor} to restored image`);
      
      // Use the improved reference-based prompt style for better results
      const eyeColorPrompt = `Keep the person from [Image1] completely unchanged, but change only their eye color to natural ${eyeColor}. Preserve everything else exactly: face, expression, skin quality, lighting, clothing, background, and all details. The iris should have a realistic ${eyeColor} color with natural reflections and depth matching the original lighting. Keep the original elements unchanged. Photorealistic, seamless integration.`;
      
      // Use the RESTORED image (not original) for eye color modification
      // Single pass only since we're just changing eye color
      const restored = await apiClient.editImage(
        restoredImage.base64,  // Use restored image instead of original
        restoredImage.mimeType, 
        eyeColorPrompt,  // Improved eye color prompt
        false,  // No double-pass needed for eye color change
        undefined,
        eyeColor,
        imageAnalysis.hasEyeColorPotential,
        imageAnalysis.personCount,
        imageAnalysis.isBlackAndWhite,
        true  // isEyeColorChangeOnly flag
      );

      // Cache the result using restored image as key
      eyeColorCache.setCachedImage(restoredImage.base64, eyeColor, {
        base64: restored.data,
        mimeType: restored.mimeType
      });
      
      // Update state, preserving video data from original restoration
      setRestoredImage({ 
        base64: restored.data, 
        mimeType: restored.mimeType,
        videoBase64: restored.videoData || restoredImage.videoBase64,  // Preserve original video data if not provided
        videoMimeType: restored.videoMimeType || restoredImage.videoMimeType
      });
      setSelectedEyeColor(eyeColor);
      
      // Update cached colors list
      const updatedCachedColors = eyeColorCache.getCachedEyeColors(restoredImage.base64);
      setCachedEyeColors(updatedCachedColors);
      
      // Track successful eye color restoration
      trackRestorationCompleted('eye_color', eyeColorStartTime);
      
      console.log(`Eye color restoration complete for: ${eyeColor}`);
    } catch (err: any) {
      console.error('Eye color restoration failed:', err);
      
      // Track eye color restoration error
      trackError('restoration', err instanceof Error ? err.message : 'eye_color_error');
      
      setError(err instanceof Error ? err.message : 'Failed to apply eye color enhancement.');
    } finally {
      setIsEyeColorLoading(false);
    }
  }, [originalImage, restoredImage, imageAnalysis, isEyeColorLoading, enhancedRestoration]);

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

  const handleDownloadVideo = async () => {
    if (videoUrl) {
      try {
        // Fetch the video blob to ensure proper handling
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        
        // Create a new blob with explicit video/mp4 MIME type
        const videoBlob = new Blob([blob], { type: 'video/mp4' });
        
        // Create a new blob URL
        const blobUrl = URL.createObjectURL(videoBlob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = blobUrl;
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = imageAnalysis?.suggestedFilename 
          ? `${imageAnalysis.suggestedFilename}-animated-${timestamp}.mp4`
          : `animated-memory-${timestamp}.mp4`;
        link.download = filename;
        link.style.display = 'none';
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Failed to download video:', error);
        // Fallback to simple download
        const link = document.createElement('a');
        link.href = videoUrl;
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = imageAnalysis?.suggestedFilename 
          ? `${imageAnalysis.suggestedFilename}-animated-${timestamp}.mp4`
          : `animated-memory-${timestamp}.mp4`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const handleSharePhoto = async () => {
    const files: File[] = [];
    
    // Convert restored image to File object if available
    if (restoredImage) {
      try {
        // Convert base64 to blob
        const response = await fetch(`data:${restoredImage.mimeType};base64,${restoredImage.base64}`);
        const blob = await response.blob();
        
        // Create filename
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = imageAnalysis?.suggestedFilename 
          ? `${imageAnalysis.suggestedFilename}-restored-${timestamp}.jpg`
          : `restored-photo-${timestamp}.jpg`;
        
        // Create File object
        const file = new File([blob], filename, { type: restoredImage.mimeType });
        files.push(file);
      } catch (error) {
        console.error('Failed to prepare image for sharing:', error);
      }
    }
    
    const shareOptions = createPhotoShareOptions(
      t('sharePhotoMessage'),
      t('shareUrl'),
      t('shareTitle'),
      t('shareFailedMessage')
    );
    
    // Add files to share options
    if (files.length > 0) {
      (shareOptions as any).files = files;
    }
    
    await shareContent(shareOptions);
  };

  const handleShareVideo = async () => {
    const files: File[] = [];
    
    // Convert video to File object if available
    if (videoUrl) {
      try {
        // Fetch the video blob
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        
        // Create filename
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = imageAnalysis?.suggestedFilename 
          ? `${imageAnalysis.suggestedFilename}-animated-${timestamp}.mp4`
          : `animated-memory-${timestamp}.mp4`;
        
        // Create File object
        const file = new File([blob], filename, { type: 'video/mp4' });
        files.push(file);
      } catch (error) {
        console.error('Failed to prepare video for sharing:', error);
      }
    }
    
    // Also include the restored image if available
    if (restoredImage) {
      try {
        const response = await fetch(`data:${restoredImage.mimeType};base64,${restoredImage.base64}`);
        const blob = await response.blob();
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = imageAnalysis?.suggestedFilename 
          ? `${imageAnalysis.suggestedFilename}-restored-${timestamp}.jpg`
          : `restored-photo-${timestamp}.jpg`;
        const file = new File([blob], filename, { type: restoredImage.mimeType });
        files.push(file);
      } catch (error) {
        console.error('Failed to prepare image for sharing:', error);
      }
    }
    
    const shareOptions = createVideoShareOptions(
      t('shareVideoMessage'),
      t('shareUrl'),
      t('shareTitle'),
      t('shareFailedMessage')
    );
    
    // Add files to share options
    if (files.length > 0) {
      (shareOptions as any).files = files;
    }
    
    await shareContent(shareOptions);
  };

  return (
    <div className="bg-brand-background min-h-screen text-brand-light font-sans">
      
      <header className="p-4 sm:p-6 flex flex-col justify-center items-center text-center">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tighter bg-gradient-to-r from-brand-secondary to-brand-accent bg-clip-text text-transparent">
            {t('appTitle')}
          </h1>
        </div>
        <p className="mt-2 text-md text-gray-400 max-w-2xl">{t('appSubtitle')}</p>
        <div className="mt-4">
          <LanguageSwitcher onLanguageChange={onLanguageToggle} />
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
