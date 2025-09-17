import { NextRequest, NextResponse } from 'next/server';
import { editImage, analyzeImage } from '@/lib/gemini-server';
import { restoreImageWithReplicate } from '@/lib/replicate-server';
import { EditImageRequest } from '@/types';
import { optimizeImage, optimizeRestoredImage } from '@/lib/image-optimizer';
import { checkRateLimit, incrementUsage } from '@/lib/rate-limiter';

// Configuration for fallback behavior
const USE_REPLICATE_FALLBACK = process.env.USE_REPLICATE_FALLBACK !== 'false'; // Default to true

// Helper function to enhance restoration prompt with eye color guidance
function enhancePromptWithEyeColor(originalPrompt: string, eyeColor?: string, hasEyeColorPotential?: boolean): string {
  // Only apply eye color guidance if both conditions are met:
  // 1. Eye color is specified
  // 2. Image has eye color potential (single person + B&W/sepia)
  if (!eyeColor || !hasEyeColorPotential) {
    return originalPrompt;
  }

  // Add eye color guidance to the prompt while preserving lighting
  const eyeColorGuidance = ` Pay special attention to the eyes - ensure they have a natural ${eyeColor} color that looks realistic and beautiful, with appropriate reflections matching the lighting direction.`;
  
  // Insert the eye color guidance before the final period or at the end
  if (originalPrompt.endsWith('.')) {
    return originalPrompt.slice(0, -1) + eyeColorGuidance + '.';
  } else {
    return originalPrompt + eyeColorGuidance;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: EditImageRequest & { useDoublePass?: boolean; browserFingerprint?: string; eyeColor?: string; hasEyeColorPotential?: boolean } = await request.json();
    const { base64ImageData, mimeType, prompt, useDoublePass, browserFingerprint, eyeColor, hasEyeColorPotential } = body;
    
    if (!base64ImageData || !mimeType || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check rate limit if fingerprint is provided
    if (browserFingerprint) {
      const rateLimitResult = await checkRateLimit(browserFingerprint, request);
      
      if (!rateLimitResult.allowed) {
        return NextResponse.json({
          error: 'Rate limit exceeded',
          rateLimitInfo: {
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
            country: rateLimitResult.country
          }
        }, { status: 429 });
      }
    }

    // Optimize image before processing to reduce token usage
    const optimized = await optimizeImage(base64ImageData, mimeType, {
      maxWidth: 1200,
      maxHeight: 1200,
      maxSizeKB: 400,
      quality: 85,
    });
    
    if (optimized.wasOptimized) {
      console.log(`Image optimized for restoration: ${optimized.originalSize} -> ${optimized.optimizedSize} bytes`);
    }

    let result;
    
    try {
      // Use double-pass for: many people, B&W photos, or very old photos
      if (useDoublePass && process.env.REPLICATE_API_TOKEN) {
        console.log('Using Flux Restore + Gemini double-pass restoration (crowd/B&W/old photo detected)...');
        
        let firstPassResult;
        
        try {
          // First pass: Use Flux Restore Image for initial restoration (it doesn't use prompts)
          console.log('Crowd restoration - Pass 1 of 2 (Flux Restore Image)...');
          
          firstPassResult = await restoreImageWithReplicate(optimized.base64, optimized.mimeType, "");
          console.log('Flux Restore first pass complete - initial restoration done');
        } catch (replicateError) {
          console.error('Flux Restore first pass failed, falling back to Gemini-only:', replicateError);
          // Fallback to Gemini for first pass if Flux Restore fails
          const enhancedPrompt = enhancePromptWithEyeColor(prompt, eyeColor, hasEyeColorPotential);
          firstPassResult = await editImage(optimized.base64, optimized.mimeType, enhancedPrompt);
        }
        
        // Second pass: Use Gemini for intelligent refinement
        console.log('Crowd restoration - Pass 2 of 2 (Gemini refinement)...');
        
        // Create a refinement prompt for Gemini to perfect the Flux Restore output
        const refinedPrompt = enhancePromptWithEyeColor(prompt, eyeColor, hasEyeColorPotential); //`CRITICAL: Preserve all facial features, structures, and identities exactly as they appear - do not alter or modify any faces. Enhance this restored photograph: boost color vibrancy by 20%, increase contrast, ensure all skin tones are warm and natural, sharpen details, improve lighting balance, add subtle film grain for photographic texture. Make it look like a high-quality modern photograph taken with professional equipment. Keep all faces and composition exactly as they are.`;
        
        console.log('Gemini refinement prompt:', refinedPrompt);
        
        try {
          result = await editImage(firstPassResult.data, firstPassResult.mimeType, refinedPrompt);
          console.log('Gemini second pass complete - refinement applied');
        } catch (error) {
          console.error('Gemini refinement pass failed, using Flux Restore result:', error);
          result = firstPassResult; // Fallback to first pass if Gemini fails
        }
        
        console.log('Hybrid Flux Restore + Gemini restoration complete');
      } else {
        // Single pass for regular images
        const enhancedPrompt = enhancePromptWithEyeColor(prompt, eyeColor, hasEyeColorPotential);
        result = await editImage(optimized.base64, optimized.mimeType, enhancedPrompt);
        console.log('Google Gemini restoration successful');
      }
      
      // Optimize the restored image for download (convert to JPEG with compression)
      const optimizedResult = await optimizeRestoredImage(result.data);
      
      // Increment usage counter after successful processing
      if (browserFingerprint) {
        incrementUsage(browserFingerprint);
      }
      
      return NextResponse.json({
        data: optimizedResult.base64,
        mimeType: optimizedResult.mimeType,
      });
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
        console.log('Attempting image restoration with Replicate Flux Restore as fallback...');
        result = await restoreImageWithReplicate(optimized.base64, optimized.mimeType, prompt);
        console.log('Replicate Flux Restore fallback restoration successful');
        
        // Optimize the restored image for download (convert to JPEG with compression)
        const optimizedResult = await optimizeRestoredImage(result.data);
        
        // Increment usage counter after successful fallback processing
        if (browserFingerprint) {
          incrementUsage(browserFingerprint);
        }
        
        return NextResponse.json({
          data: optimizedResult.base64,
          mimeType: optimizedResult.mimeType,
        });
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
