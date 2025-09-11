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
  forceReplicate?: boolean
): Promise<{ data: string; mimeType: string }> => {
  const response = await fetch('/api/edit-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64ImageData,
      mimeType,
      prompt,
      forceReplicate,
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

export const generateVideo = async (
  prompt: string,
  onProgress: (message: string) => void,
  imageData: ImageData,
  progressMessages: string[]
): Promise<string> => {
  let messageIndex = 0;
  const interval = setInterval(() => {
    onProgress(progressMessages[messageIndex % progressMessages.length]);
    messageIndex++;
  }, 4000);

  onProgress(progressMessages[0]);

  try {
    const response = await fetch('/api/generate-video', {
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
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate video');
    }

    const result = await response.json();
    
    // Convert base64 to blob URL
    const videoBlob = await fetch(`data:video/mp4;base64,${result.videoBase64}`).then(r => r.blob());
    return URL.createObjectURL(videoBlob);
  } finally {
    clearInterval(interval);
  }
};
