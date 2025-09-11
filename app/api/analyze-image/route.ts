import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/gemini-server';
import { AnalyzeImageRequest } from '@/types';

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

    const analysis = await analyzeImage(base64ImageData, mimeType, language, examplePrompt);
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analyze image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
