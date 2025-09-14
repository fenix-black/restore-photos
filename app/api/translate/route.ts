import { NextRequest, NextResponse } from 'next/server';
import { translateText as translateTextWithGemini } from '@/lib/gemini-server';
import { translateText as translateTextWithGroq, withGroqFallback } from '@/lib/groq-server';
import { TranslateTextRequest } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: TranslateTextRequest = await request.json();
    const { text, targetLanguage } = body;
    
    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Try Groq first, fall back to Gemini if it fails
    const translatedText = await withGroqFallback(
      () => translateTextWithGroq(text, targetLanguage),
      () => translateTextWithGemini(text, targetLanguage),
      'translation'
    );
    
    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translate text error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to translate text' },
      { status: 500 }
    );
  }
}
