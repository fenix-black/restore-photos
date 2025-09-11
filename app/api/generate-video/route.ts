import { NextRequest, NextResponse } from 'next/server';
import { generateVideoWithReplicate, generateVideoUrlWithReplicate } from '@/lib/replicate-server';
// Fallback to Gemini if needed (you can remove this import if not using fallback)
import { generateVideo as generateVideoWithGemini } from '@/lib/gemini-server';
import { GenerateVideoRequest } from '@/types';

// Video generation can take several minutes
export const maxDuration = 300; // 5 minutes

// Configuration option: choose which provider to use
const VIDEO_PROVIDER = process.env.VIDEO_PROVIDER || 'replicate'; // 'replicate' or 'gemini'
const RETURN_URL_ONLY = process.env.RETURN_VIDEO_URL === 'true'; // For more efficient Vercel deployments

export async function POST(request: NextRequest) {
  try {
    const body: GenerateVideoRequest = await request.json();
    const { prompt, imageData } = body;
    
    if (!prompt || !imageData || !imageData.base64 || !imageData.mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let result: string;
    
    if (VIDEO_PROVIDER === 'replicate') {
      // Use Replicate for video generation
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
