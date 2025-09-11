import { NextRequest, NextResponse } from 'next/server';
import { editImage } from '@/lib/gemini-server';
import { restoreImageWithReplicate } from '@/lib/replicate-server';
import { EditImageRequest } from '@/types';

// Configuration for fallback behavior
const USE_REPLICATE_FALLBACK = process.env.USE_REPLICATE_FALLBACK !== 'false'; // Default to true

export async function POST(request: NextRequest) {
  try {
    const body: EditImageRequest = await request.json();
    const { base64ImageData, mimeType, prompt } = body;
    
    if (!base64ImageData || !mimeType || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let result;
    
    try {
      // First attempt: Use Google Gemini (primary method)
      console.log('Attempting image restoration with Google Gemini...');
      result = await editImage(base64ImageData, mimeType, prompt);
      console.log('Google Gemini restoration successful');
      
      return NextResponse.json(result);
    } catch (geminiError) {
      console.error('Google Gemini image restoration failed:', geminiError);
      
      // Check if we should try the fallback
      if (!USE_REPLICATE_FALLBACK) {
        throw geminiError; // Re-throw the original error if fallback is disabled
      }
      
      // Check if Replicate token is available
      if (!process.env.REPLICATE_API_TOKEN) {
        console.error('Replicate fallback requested but REPLICATE_API_TOKEN not configured');
        throw geminiError; // Re-throw the original error if no Replicate token
      }
      
      try {
        // Second attempt: Use Replicate as fallback
        console.log('Attempting image restoration with Replicate Seedream-4 as fallback...');
        result = await restoreImageWithReplicate(base64ImageData, mimeType, prompt);
        console.log('Replicate fallback restoration successful');
        
        return NextResponse.json(result);
      } catch (replicateError) {
        console.error('Replicate fallback also failed:', replicateError);
        
        // Both methods failed - return the original Gemini error with a note about fallback
        const errorMessage = geminiError instanceof Error 
          ? `Primary restoration failed: ${geminiError.message}. Fallback also failed: ${replicateError instanceof Error ? replicateError.message : 'Unknown error'}`
          : 'Both primary and fallback image restoration methods failed';
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('Edit image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to edit image' },
      { status: 500 }
    );
  }
}

// Increase payload size limit for large images
export const maxDuration = 60; // Maximum function duration of 60 seconds
