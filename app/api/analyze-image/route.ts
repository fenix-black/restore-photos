import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/gemini-server';
import { generatePromptsWithGroq } from '@/lib/groq-server';
import { AnalyzeImageRequest, ImageAnalysis } from '@/types';
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

    // Use Gemini for image analysis (visual analysis only)
    console.log('Analyzing image with Gemini...');
    const analysis = await analyzeImage(optimized.base64, optimized.mimeType, language, examplePrompt);
    
    // Optionally enhance the text prompts with Groq for better quality
    if (process.env.USE_GROQ_FOR_PROMPTS === 'true') {
      try {
        console.log('Enhancing text prompts with Groq...');
        const groqPrompts = await generatePromptsWithGroq(analysis, language, examplePrompt);
        
        // Replace the text prompts with Groq-generated ones, keep Gemini's visual analysis
        const enhancedAnalysis: ImageAnalysis = {
          ...analysis,
          ...groqPrompts
        };
        
        return NextResponse.json(enhancedAnalysis);
      } catch (groqError) {
        console.error('Groq prompt enhancement failed, using original Gemini prompts:', groqError);
        // Fall back to original Gemini analysis
      }
    }
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analyze image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
