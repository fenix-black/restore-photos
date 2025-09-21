export type AppStep = 
  | 'idle' 
  | 'analyzing' 
  | 'correcting' 
  | 'restoring' 
  | 'translating'
  | 'readyForVideo' 
  | 'generatingVideo' 
  | 'done';

export interface ImageAnalysis {
  containsChildren: boolean;
  needsPerspectiveCorrection: boolean;
  hasManyPeople: boolean; // True if image has 7+ people
  isBlackAndWhite: boolean; // True if B&W or minimal colors
  isVeryOld: boolean; // True if pre-1960s or very aged
  personCount: number; // Exact count: 0, 1, or 2+ (where 2+ means many)
  hasEyeColorPotential: boolean; // True if single person + B&W/sepia/lacks color
  lightingInfo: {
    primaryDirection: string; // e.g., "left", "right", "top", "front", "back-left"
    quality: string; // e.g., "soft", "harsh", "diffused", "direct"
    type: string; // e.g., "natural", "window", "studio", "flash"
    shadowStrength: string; // e.g., "strong", "moderate", "subtle", "minimal"
    description: string; // Natural language description of lighting
  };
  videoPrompt: string;
  restorationPrompt: string;
  suggestedFilename: string;
}

export interface ImageData {
  base64: string;
  mimeType: string;
}

export interface AnalyzeImageRequest {
  base64ImageData: string;
  mimeType: string;
  language: 'en' | 'es';
}

export interface EditImageRequest {
  base64ImageData: string;
  mimeType: string;
  prompt: string;
}

export interface EditImageResponse {
  data: string;              // Optimized version for display/download
  mimeType: string;          // MIME type of optimized version
  videoData?: string;        // High-quality version for video generation
  videoMimeType?: string;    // MIME type of video version
}

export interface GenerateVideoRequest {
  prompt: string;
  imageData: ImageData;
  language: 'en' | 'es';
}

export interface TranslateTextRequest {
  text: string;
  targetLanguage: 'es';
}
