import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/gemini-server';
import { AnalyzeImageRequest } from '@/types';
import { optimizeImage } from '@/lib/image-optimizer';

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeImageRequest & { examplePrompt: string } = await request.json();
    const { base64ImageData, mimeType, language, examplePrompt } = body;
    
    if (!base64ImageData || !mimeType || !language) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Optimize image before processing to reduce token usage
    const optimized = await optimizeImage(base64ImageData, mimeType, {
      maxWidth: 1200,
      maxHeight: 1200,
      maxSizeKB: 400,
      quality: 85,
    });
    
    if (optimized.wasOptimized) {
      console.log(`Image optimized for analysis: ${optimized.originalSize} -> ${optimized.optimizedSize} bytes`);
    }

    const analysis = await analyzeImage(optimized.base64, optimized.mimeType, language, examplePrompt);
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analyze image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
