import { NextRequest, NextResponse } from 'next/server';
import { convertPromptToVeoJson } from '@/lib/gemini-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      videoPrompt, 
      imageAnalysis, 
      restoredImageData 
    } = body;
    
    if (!videoPrompt) {
      return NextResponse.json(
        { error: 'Missing video prompt' },
        { status: 400 }
      );
    }

    console.log('Generating VEO3 JSON prompt...');
    
    // Generate the VEO3 JSON prompt using the restored image data if available
    const veoJsonPrompt = await convertPromptToVeoJson(
      videoPrompt,
      imageAnalysis,
      restoredImageData || null
    );
    
    console.log('VEO3 JSON prompt generated successfully');
    
    return NextResponse.json({ veoJsonPrompt });
  } catch (error) {
    console.error('Generate VEO prompt error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate VEO prompt' },
      { status: 500 }
    );
  }
}
