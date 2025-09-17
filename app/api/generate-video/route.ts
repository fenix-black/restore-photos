import { NextRequest, NextResponse } from 'next/server';
import { 
  generateVideoWithReplicate, 
  generateVideoUrlWithReplicate,
  startVideoGeneration,
  checkVideoGenerationStatus 
} from '@/lib/replicate-server';
// Import both sync and async Gemini functions
import { 
  generateVideo as generateVideoWithGemini,
  startGeminiVideoGeneration,
  checkGeminiVideoStatus
} from '@/lib/gemini-server';
import { GenerateVideoRequest } from '@/types';

// With async mode, we only need enough time to start/check predictions
export const maxDuration = 10; // 10 seconds is plenty for async operations

// Configuration option: choose which provider to use
const VIDEO_PROVIDER = process.env.VIDEO_PROVIDER || 'replicate'; // 'replicate' or 'gemini'
const RETURN_URL_ONLY = process.env.RETURN_VIDEO_URL === 'true'; // For more efficient Vercel deployments
const USE_ASYNC_VIDEO = process.env.USE_ASYNC_VIDEO === 'true'; // Enable async mode to avoid timeouts

export async function POST(request: NextRequest) {
  try {
    const body: GenerateVideoRequest & { 
      predictionId?: string; 
      operationName?: string; // For Gemini async operations
      containsChildren?: boolean; 
      imageAnalysis?: any 
    } = await request.json();
    const { prompt, imageData, predictionId, operationName, containsChildren, imageAnalysis } = body;
    
    // Check if this is a status check request for Replicate
    if (predictionId) {
      const result = await checkVideoGenerationStatus(predictionId);
      return NextResponse.json(result);
    }
    
    // Check if this is a status check request for Gemini
    if (operationName) {
      const result = await checkGeminiVideoStatus(operationName);
      return NextResponse.json(result);
    }
    
    // Otherwise, it's a new video generation request
    if (!prompt || !imageData || !imageData.base64 || !imageData.mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let result: string;
    
    // Override provider selection based on child detection
    // Use Gemini VEO3 for non-child content (safer to use newer model)
    const activeProvider = containsChildren === false ? 'gemini' : VIDEO_PROVIDER;
    console.log(`Using video provider: ${activeProvider} (containsChildren: ${containsChildren})`);
    
    if (activeProvider === 'replicate') {
      // Check if async mode is enabled
      if (USE_ASYNC_VIDEO) {
        // Start async generation and return prediction ID
        const id = await startVideoGeneration(prompt, {
          data: imageData.base64,
          mimeType: imageData.mimeType
        });
        return NextResponse.json({ predictionId: id });
      }
      
      // Use synchronous generation (existing behavior)
      if (RETURN_URL_ONLY) {
        // Return URL directly (more efficient for Vercel)
        const videoUrl = await generateVideoUrlWithReplicate(prompt, {
          data: imageData.base64,
          mimeType: imageData.mimeType
        });
        return NextResponse.json({ videoUrl });
      } else {
        // Return base64 (maintains backward compatibility)
        const videoBase64 = await generateVideoWithReplicate(prompt, {
          data: imageData.base64,
          mimeType: imageData.mimeType
        });
        return NextResponse.json({ videoBase64 });
      }
    } else {
      // Use Gemini with JSON format for better structured prompts
      const useJsonFormat = true; // Use JSON format for VEO3
      
      // Check if async mode is enabled for Gemini
      if (USE_ASYNC_VIDEO) {
        // Start async generation and return operation name
        const operationName = await startGeminiVideoGeneration(
          prompt, 
          {
            data: imageData.base64,
            mimeType: imageData.mimeType
          },
          useJsonFormat,
          imageAnalysis // Pass image analysis for better prompt conversion
        );
        return NextResponse.json({ operationName });
      }
      
      // Synchronous mode (not recommended for Vercel due to timeouts)
      const videoBase64 = await generateVideoWithGemini(
        prompt, 
        {
          data: imageData.base64,
          mimeType: imageData.mimeType
        },
        useJsonFormat,
        imageAnalysis
      );
      return NextResponse.json({ videoBase64 });
    }
  } catch (error) {
    console.error('Generate video error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate video' },
      { status: 500 }
    );
  }
}
