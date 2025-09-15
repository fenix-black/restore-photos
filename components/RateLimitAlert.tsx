import React from 'react';
import { useLocalization } from '@/contexts/LocalizationContext';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  country: string;
}

interface RateLimitAlertProps {
  rateLimitInfo: RateLimitInfo;
  onClose: () => void;
}

const RateLimitAlert: React.FC<RateLimitAlertProps> = ({ rateLimitInfo, onClose }) => {
  const { t } = useLocalization();
  const isChile = rateLimitInfo.country === 'Chile';
  
  // Format reset time
  const resetTime = new Date(rateLimitInfo.resetTime);
  const resetTimeString = resetTime.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Determine which message to show
  const getMessage = () => {
    if (isChile) {
      return t('rateLimitMessageChile').replace('{limit}', rateLimitInfo.limit.toString());
    } else {
      return t('rateLimitMessageInternational').replace('{limit}', rateLimitInfo.limit.toString());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl text-gray-800">
        {/* Header with friendly icon */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            {t('rateLimitTitle')}
          </h3>
          <p className="text-gray-600 text-lg">
            {getMessage()}
          </p>
        </div>

        {/* Reset time info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <div>
              <p className="text-blue-800 font-medium">
                {t('rateLimitReset')}
              </p>
              <p className="text-blue-600 text-sm">
                {resetTimeString}
              </p>
            </div>
          </div>
        </div>

        {/* Call to action */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 mb-6">
          <p className="text-gray-700 mb-3 text-center">
            {t('rateLimitMoreInfo')}
          </p>
          <a 
            href="https://www.fenixblack.ai" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-center py-3 px-6 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg"
          >
            ✨ Visit {t('rateLimitWebsite')}
          </a>
        </div>

        {/* Close button */}
        <div className="text-center">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            {t('rateLimitTryTomorrow')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RateLimitAlert;
