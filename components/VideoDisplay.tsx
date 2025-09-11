'use client';

import React from 'react';
import { VideoIcon } from './icons/VideoIcon';
import Spinner from './Spinner';
import { DownloadIcon } from './icons/DownloadIcon';
import { useLocalization } from '@/contexts/LocalizationContext';

interface VideoDisplayProps {
  description: string;
  videoUrl: string | null;
  isLoading: boolean;
  loadingMessage: string;
  onGenerate: () => void;
  onDownload?: () => void;
}

const VideoDisplay: React.FC<VideoDisplayProps> = ({ description, videoUrl, isLoading, loadingMessage, onGenerate, onDownload }) => {
  const { t } = useLocalization();
  return (
    <section className="w-full p-6 bg-brand-dark/50 rounded-2xl animate-slide-in-up text-center">
      <h3 className="text-xl font-bold mb-4 text-blue-300">{t('stageTitleBringToLife')}</h3>
      
      {!videoUrl && !isLoading && (
        <div className="flex flex-col items-center">
          <p className="mb-4 text-gray-300 max-w-xl">{t('videoGenerationPromptLabel')}</p>
          <p className="mb-6 p-3 bg-brand-dark rounded-md border border-gray-700 text-gray-400 italic text-sm">"{description}"</p>
          <button
            onClick={onGenerate}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-secondary hover:bg-blue-500 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105"
          >
            <VideoIcon className="w-5 h-5" />
            {t('buttonGenerateVideo')}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center min-h-[150px]">
          <Spinner />
          <p className="mt-4 text-brand-light animate-pulse">{loadingMessage}</p>
          <p className="mt-2 text-sm text-gray-400">{t('videoGenerationPatience')}</p>
        </div>
      )}

      {videoUrl && (
        <div>
           <p className="mb-4 text-gray-300">{t('videoReady')}</p>
          <video controls autoPlay loop className="w-full max-w-lg mx-auto rounded-lg border border-gray-700 shadow-xl">
            <source src={videoUrl} type="video/mp4" />
            {t('videoTagNotSupported')}
          </video>
          <button
            onClick={onDownload}
            className="mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-brand-secondary hover:bg-blue-500 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105 mx-auto"
          >
            <DownloadIcon className="w-5 h-5" />
            {t('buttonDownloadVideo')}
          </button>
        </div>
      )}
    </section>
  );
};

export default VideoDisplay;