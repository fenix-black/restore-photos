'use client';

import React, { useState, useCallback } from 'react';
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
  };

  const handleImageDrop = useCallback(async (file: File) => {
    if (currentStep !== 'idle') return;

    try {
      setError(null);
      setCurrentStep('analyzing');
      const { base64, mimeType } = await apiClient.fileToGenerativePart(file);
      setOriginalImage({ file, base64, mimeType });

      const analysis = await apiClient.analyzeImage(base64, mimeType, language, t('videoPromptExample'));
      setImageAnalysis(analysis);

      let imageToRestore = { base64, mimeType };

      if (analysis.needsPerspectiveCorrection) {
        setCurrentStep('correcting');
        const corrected = await apiClient.editImage(base64, mimeType, "Correct perspective of this photograph. Crop it to the photo's edges. Do not alter colors or content.");
        imageToRestore = { base64: corrected.data, mimeType: corrected.mimeType };
      }

      setCurrentStep('restoring');
      const restored = await apiClient.editImage(imageToRestore.base64, imageToRestore.mimeType, analysis.restorationPrompt);
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

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setCurrentStep('idle');
    }
  }, [currentStep, language, t]);

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

  const downloadImage = (base64: string, mimeType: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const getFileExtension = (mimeType: string) => {
    return mimeType.split('/')[1] || 'png';
  }

  const handleDownloadRestored = () => {
    if (restoredImage) {
        const ext = getFileExtension(restoredImage.mimeType);
        downloadImage(restoredImage.base64, restoredImage.mimeType, `${imageAnalysis?.suggestedFilename || 'restored-image'}.${ext}`);
    }
  }

  const handleDownloadVideo = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      const ext = 'mp4';
      link.download = `${imageAnalysis?.suggestedFilename || 'video'}.${ext}`;
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
        {currentStep === 'idle' && (
            <Dropzone onImageDrop={handleImageDrop} />
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
