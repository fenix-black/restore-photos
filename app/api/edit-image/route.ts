import { NextRequest, NextResponse } from 'next/server';
import { editImage, analyzeImage } from '@/lib/gemini-server';
import { restoreImageWithReplicate } from '@/lib/replicate-server';
import { EditImageRequest } from '@/types';
import { optimizeImage, optimizeRestoredImage } from '@/lib/image-optimizer';
import { checkRateLimit, incrementUsage } from '@/lib/rate-limiter';

// Configuration for fallback behavior
const USE_REPLICATE_FALLBACK = process.env.USE_REPLICATE_FALLBACK !== 'false'; // Default to true

// Helper function to add strict preservation rules for single-person photos
function enhancePromptWithStrictPreservation(originalPrompt: string, personCount?: number): string {
  // Only apply strict preservation for single-person photos
  console.log(`personCount received: ${personCount}, type: ${typeof personCount}`);
  
  // Convert to number if it's a string and check for single person
  const count = typeof personCount === 'string' ? parseInt(personCount as any) : personCount;
  
  if (!count || count !== 1) {
    console.log(`Strict preservation NOT applied - count: ${count}, type: ${typeof count}`);
    return originalPrompt;
  }

  console.log(`Applying strict preservation for single person (count: ${count})`);
  
  // Add strict preservation rules at the beginning of the prompt
  const strictRules = `CRITICAL PRESERVATION RULES - DO NOT ALTER: 
1. EXACT facial geometry - maintain precise eye shape, spacing, and size
2. EXACT expression - no added smile or emotions, keep original mouth position
3. EXACT head angle and tilt - do not straighten or adjust
4. EXACT eyebrow shape, thickness, position, and color intensity
5. Keep all facial asymmetries and unique features unchanged
6. PRESERVE exact clothing patterns, stripes, and designs - do not modify
REMOVE all sepia/vintage tones completely. Apply MODERN VIVID colors: bright whites (not cream), deep true blacks, vibrant skin tones without any yellow/brown vintage cast. Make it look like a photo taken TODAY with a modern camera - crystal clear with punchy, saturated colors. NO vintage aesthetic. `;

  // Combine with original prompt
  return strictRules + originalPrompt;
}

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
    const body: EditImageRequest & { useDoublePass?: boolean; browserFingerprint?: string; eyeColor?: string; hasEyeColorPotential?: boolean; personCount?: number } = await request.json();
    const { base64ImageData, mimeType, prompt, useDoublePass, browserFingerprint, eyeColor, hasEyeColorPotential, personCount } = body;
    
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
        console.log('Using CodeFormer + Gemini double-pass restoration (enhanced mode)...');
        
        let firstPassResult;
        
        try {
          // First pass: Use CodeFormer for initial restoration
          console.log('Enhanced restoration - Pass 1 of 2 (CodeFormer restoration)...');
          
          firstPassResult = await restoreImageWithReplicate(optimized.base64, optimized.mimeType, "");
          console.log('CodeFormer first pass complete - initial restoration done');
        } catch (replicateError) {
          console.error('CodeFormer first pass failed, falling back to Gemini-only:', replicateError);
          // Fallback to Gemini for first pass if CodeFormer fails
          let enhancedPrompt = enhancePromptWithStrictPreservation(prompt, personCount);
          enhancedPrompt = enhancePromptWithEyeColor(enhancedPrompt, eyeColor, hasEyeColorPotential);
          firstPassResult = await editImage(optimized.base64, optimized.mimeType, enhancedPrompt);
        }
        
        // Second pass: Use Gemini for intelligent refinement with strict preservation
        console.log('Enhanced restoration - Pass 2 of 2 (Gemini refinement)...');
        
        // Create a refinement prompt for Gemini to perfect the CodeFormer output
        let refinedPrompt = enhancePromptWithStrictPreservation(prompt, personCount);
        refinedPrompt = enhancePromptWithEyeColor(refinedPrompt, eyeColor, hasEyeColorPotential);
        
        console.log('Gemini refinement prompt:', refinedPrompt);
        
        try {
          result = await editImage(firstPassResult.data, firstPassResult.mimeType, refinedPrompt);
          console.log('Gemini second pass complete - refinement applied');
        } catch (error) {
          console.error('Gemini refinement pass failed, using CodeFormer result:', error);
          result = firstPassResult; // Fallback to first pass if Gemini fails
        }
        
        console.log('Hybrid CodeFormer + Gemini restoration complete');
      } else {
        // Single pass for regular images
        let enhancedPrompt = enhancePromptWithStrictPreservation(prompt, personCount);
        enhancedPrompt = enhancePromptWithEyeColor(enhancedPrompt, eyeColor, hasEyeColorPotential);
        console.log('Final enhanced prompt:', enhancedPrompt.substring(0, 200) + '...');
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
