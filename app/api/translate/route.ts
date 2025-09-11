import { NextRequest, NextResponse } from 'next/server';
import { translateText } from '@/lib/gemini-server';
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

    const translatedText = await translateText(text, targetLanguage);
    
    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translate text error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to translate text' },
      { status: 500 }
    );
  }
}
