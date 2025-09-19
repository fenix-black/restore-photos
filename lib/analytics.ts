import { track } from '@vercel/analytics';

/**
 * Track successful photo restoration completion
 */
export const trackRestorationCompleted = (
  type: 'standard' | 'enhanced' | 'eye_color',
  startTime: number
) => {
  try {
    track('restoration_completed', {
      type,
      duration_ms: Date.now() - startTime
    });
  } catch (error) {
    console.error('Failed to track restoration event:', error);
  }
};

/**
 * Track successful video generation
 */
export const trackVideoGenerated = (
  model: 'gemini' | 'replicate',
  startTime: number
) => {
  try {
    track('video_generated', {
      model,
      duration_ms: Date.now() - startTime
    });
  } catch (error) {
    console.error('Failed to track video event:', error);
  }
};

/**
 * Track errors for quality monitoring
 */
export const trackError = (
  stage: 'analysis' | 'restoration' | 'video',
  errorType: string
) => {
  try {
    // Simplify error type to avoid sending sensitive data
    const simplifiedError = errorType
      .replace(/https?:\/\/[^\s]+/g, '[URL]')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]')
      .substring(0, 50); // Limit length
    
    track('error_occurred', {
      stage,
      error_type: simplifiedError
    });
  } catch (error) {
    console.error('Failed to track error event:', error);
  }
};