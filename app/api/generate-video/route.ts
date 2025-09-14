import { NextRequest, NextResponse } from 'next/server';
import { 
  generateVideoWithReplicate, 
  generateVideoUrlWithReplicate,
  startVideoGeneration,
  checkVideoGenerationStatus 
} from '@/lib/replicate-server';
// Fallback to Gemini if needed (you can remove this import if not using fallback)
import { generateVideo as generateVideoWithGemini } from '@/lib/gemini-server';
import { GenerateVideoRequest } from '@/types';

// With async mode, we only need enough time to start/check predictions
export const maxDuration = 10; // 10 seconds is plenty for async operations

// Configuration option: choose which provider to use
const VIDEO_PROVIDER = process.env.VIDEO_PROVIDER || 'replicate'; // 'replicate' or 'gemini'
const RETURN_URL_ONLY = process.env.RETURN_VIDEO_URL === 'true'; // For more efficient Vercel deployments
const USE_ASYNC_VIDEO = process.env.USE_ASYNC_VIDEO === 'true'; // Enable async mode to avoid timeouts

export async function POST(request: NextRequest) {
  try {
    const body: GenerateVideoRequest & { predictionId?: string } = await request.json();
    const { prompt, imageData, predictionId } = body;
    
    // Check if this is a status check request
    if (predictionId) {
      // Check video generation status
      const result = await checkVideoGenerationStatus(predictionId);
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
    
    if (VIDEO_PROVIDER === 'replicate') {
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
      // Fallback to Gemini (original implementation)
      const videoBase64 = await generateVideoWithGemini(prompt, {
        data: imageData.base64,
        mimeType: imageData.mimeType
      });
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
