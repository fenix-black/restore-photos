import type { ImageAnalysis, ImageData } from '@/types';

// Client-side functions to call our Next.js API routes

export const fileToGenerativePart = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        return reject(new Error("Failed to read file as string"));
      }
      const base64 = reader.result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const analyzeImage = async (
  base64ImageData: string, 
  mimeType: string, 
  language: 'en' | 'es',
  examplePrompt: string
): Promise<ImageAnalysis> => {
  const response = await fetch('/api/analyze-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64ImageData,
      mimeType,
      language,
      examplePrompt
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to analyze image');
  }

  return response.json();
};

export const editImage = async (
  base64ImageData: string, 
  mimeType: string, 
  prompt: string,
  useDoublePass?: boolean,
  _unused?: string, // browserFingerprint removed but keeping parameter for backward compatibility
  eyeColor?: string,
  hasEyeColorPotential?: boolean,
  personCount?: number,
  isBlackAndWhite?: boolean,
  isEyeColorChangeOnly?: boolean
): Promise<{ data: string; mimeType: string; videoData?: string; videoMimeType?: string }> => {
  const response = await fetch('/api/edit-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64ImageData,
      mimeType,
      prompt,
      useDoublePass,
      eyeColor,
      hasEyeColorPotential,
      personCount,
      isBlackAndWhite,
      isEyeColorChangeOnly,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    
    
    throw new Error(error.error || 'Failed to edit image');
  }

  return response.json();
};

export const translateText = async (text: string, targetLanguage: 'es'): Promise<string> => {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      targetLanguage,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to translate text');
  }

  const result = await response.json();
  return result.translatedText;
};

export const generateVeoPrompt = async (
  videoPrompt: string,
  imageAnalysis: any,
  restoredImageData: { base64: string; mimeType: string }
): Promise<string> => {
  const response = await fetch('/api/generate-veo-prompt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      videoPrompt,
      imageAnalysis,
      restoredImageData,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate VEO prompt');
  }

  const result = await response.json();
  return result.veoJsonPrompt;
};

export const generateVideo = async (
  prompt: string,
  onProgress: (message: string) => void,
  imageData: ImageData,
  progressMessages: string[],
  containsChildren?: boolean,
  imageAnalysis?: any,
  veoJsonPrompt?: string
): Promise<string> => {
  let messageIndex = 0;
  const interval = setInterval(() => {
    onProgress(progressMessages[messageIndex % progressMessages.length]);
    messageIndex++;
  }, 4000);

  onProgress(progressMessages[0]);

  try {
    // Determine initial provider - prefer Gemini for non-child content
    const initialProvider = containsChildren === false ? 'gemini' : 'replicate';
    let currentProvider = initialProvider;
    let fallbackAttempted = false;
    
    // Start video generation with current provider
    const startVideo = async (provider: string) => {
      const startResponse = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageData: {
            base64: imageData.base64,
            mimeType: imageData.mimeType,
          },
          containsChildren,
          imageAnalysis,
          veoJsonPrompt: provider === 'gemini' ? veoJsonPrompt : undefined,
          forceProvider: provider, // Explicitly specify provider
        }),
      });

      if (!startResponse.ok) {
        const error = await startResponse.json();
        throw new Error(error.error || 'Failed to start video generation');
      }

      return startResponse.json();
    };
    
    // Start with initial provider
    let startResult = await startVideo(currentProvider);
    
    // Check if we got a prediction ID (Replicate) or operation name (Gemini) for async mode
    if (startResult.predictionId || startResult.operationName) {
      // Async mode: poll for completion
      const maxAttempts = 120; // 10 minutes with 5-second intervals
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        // Wait 5 seconds before checking status
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const statusResponse = await fetch('/api/generate-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            predictionId: startResult.predictionId,
            operationName: startResult.operationName,
          }),
        });
        
        if (!statusResponse.ok) {
          const error = await statusResponse.json();
          throw new Error(error.error || 'Failed to check video status');
        }
        
        const statusResult = await statusResponse.json();
        
        // Check if completed
        if (statusResult.status === 'succeeded' && statusResult.output) {
          // Video is ready - fetch and convert to blob URL
          const videoResponse = await fetch(statusResult.output);
          if (!videoResponse.ok) {
            throw new Error('Failed to download generated video');
          }
          const videoBlob = await videoResponse.blob();
          clearInterval(interval);
          return URL.createObjectURL(videoBlob);
        }
        
        // Check if failed - attempt fallback if not already tried
        if (statusResult.status === 'failed' || statusResult.status === 'canceled') {
          if (!fallbackAttempted && currentProvider === 'gemini') {
            console.log('Gemini video generation failed, falling back to Replicate...');
            onProgress('Trying alternative video generation method...');
            fallbackAttempted = true;
            currentProvider = 'replicate';
            
            // Start new generation with Replicate
            startResult = await startVideo('replicate');
            attempts = 0; // Reset attempts for fallback
            continue;
          }
          
          // Both failed or single provider failed
          throw new Error(
            fallbackAttempted 
              ? 'Video generation failed with both providers' 
              : 'Video generation failed'
          );
        }
        
        attempts++;
      }
      
      throw new Error('Video generation timed out after 10 minutes');
    } else if (startResult.videoUrl) {
      // URL mode: fetch and convert to blob URL
      const videoResponse = await fetch(startResult.videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Failed to download generated video');
      }
      const videoBlob = await videoResponse.blob();
      return URL.createObjectURL(videoBlob);
    } else if (startResult.videoBase64) {
      // Base64 mode (backward compatibility)
      const videoBlob = await fetch(`data:video/mp4;base64,${startResult.videoBase64}`).then(r => r.blob());
      return URL.createObjectURL(videoBlob);
    } else {
      throw new Error('Unexpected response format from video generation');
    }
  } finally {
    clearInterval(interval);
  }
};
