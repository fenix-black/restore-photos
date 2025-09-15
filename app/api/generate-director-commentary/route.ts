import { NextRequest, NextResponse } from 'next/server';
import { generateDirectorCommentary } from '@/lib/groq-server';

export async function POST(request: NextRequest) {
  let language = 'en';
  
  try {
    const body = await request.json();
    const { videoPrompt } = body;
    language = body.language || 'en';

    if (!videoPrompt) {
      return NextResponse.json(
        { error: 'Video prompt is required' },
        { status: 400 }
      );
    }

    // Generate director's commentary based on the video prompt
    const comments = await generateDirectorCommentary(videoPrompt, language);

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error generating director commentary:', error);
    
    // Return default comments as fallback
    const defaultComments = language === 'es' 
      ? [
          "🎬 Ajustando la iluminación para capturar ese momento perfecto...",
          "📸 ¡Excelente! Mantén esa expresión natural...",
          "✨ Un poco más de brillo en los ojos... ¡perfecto!",
          "🎥 La cámara está capturando cada detalle hermoso...",
          "🌟 ¡Qué escena tan emotiva! Esto será inolvidable...",
          "🎞️ Agregando un toque cinematográfico a tu recuerdo...",
        ]
      : [
          "🎬 Adjusting the lighting to capture that perfect moment...",
          "📸 Excellent! Keep that natural expression...",
          "✨ A bit more sparkle in the eyes... perfect!",
          "🎥 The camera is capturing every beautiful detail...",
          "🌟 What an emotional scene! This will be unforgettable...",
          "🎞️ Adding a cinematic touch to your memory...",
        ];
    
    return NextResponse.json({ comments: defaultComments });
  }
}
