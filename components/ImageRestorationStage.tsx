'use client';

import React from 'react';
import Spinner from './Spinner';
import { DownloadIcon } from './icons/DownloadIcon';
import { ShareIcon } from './icons/ShareIcon';
import { useLocalization } from '@/contexts/LocalizationContext';

interface ImageRestorationStageProps {
  title: string;
  originalImage: string | null;
  processedImage: string | null;
  isLoading: boolean;
  isDownloadable?: boolean;
  onDownload?: () => void;
  onShare?: () => void;
}

const ImageDisplay: React.FC<{ label: string; imageSrc: string | null; isLoading?: boolean; isDownloadable?: boolean; onDownload?: () => void; onShare?: () => void; }> = ({ label, imageSrc, isLoading = false, isDownloadable, onDownload, onShare }) => {
  const { t } = useLocalization();
  return (
    <div className="flex-1 flex flex-col items-center">
      <h4 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider">{label}</h4>
      <div className="relative w-full aspect-square bg-brand-dark rounded-lg overflow-hidden border border-gray-700 shadow-lg">
        {imageSrc && <img src={`data:image/png;base64,${imageSrc}`} alt={label} className="w-full h-full object-contain" />}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Spinner />
          </div>
        )}
      </div>
      {isDownloadable && imageSrc && !isLoading && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
                onClick={onDownload}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105"
            >
                <DownloadIcon className="w-5 h-5" />
                {t('buttonDownloadPhoto')}
            </button>
            {onShare && (
              <button
                  onClick={onShare}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-md transition-transform transform hover:scale-105"
              >
                  <ShareIcon className="w-5 h-5" />
                  {t('buttonShare')}
              </button>
            )}
          </div>
      )}
    </div>
  )
};

const ImageRestorationStage: React.FC<ImageRestorationStageProps> = ({ title, originalImage, processedImage, isLoading, isDownloadable, onDownload, onShare }) => {
  const { t } = useLocalization();
  return (
    <section className="w-full p-6 bg-brand-dark/50 rounded-2xl animate-slide-in-up">
      <h3 className="text-xl font-bold mb-4 text-center text-blue-300">{title}</h3>
      <div className="flex flex-col sm:flex-row gap-6">
        <ImageDisplay label={t('labelBefore')} imageSrc={originalImage} />
        <ImageDisplay label={t('labelAfter')} imageSrc={processedImage} isLoading={isLoading} isDownloadable={isDownloadable} onDownload={onDownload} onShare={onShare} />
      </div>
    </section>
  );
};

export default ImageRestorationStage;