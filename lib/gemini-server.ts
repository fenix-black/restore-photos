import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import type { ImageAnalysis } from '@/types';

// Server-side only - these functions will be called from API routes
export function getGeminiAI() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENAI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
}

const analysisModel = 'gemini-2.5-pro';
const editModel = 'gemini-2.5-flash-image-preview';
const videoModel = 'veo-3.0-fast-generate-001';

export const analyzeImage = async (
  base64ImageData: string, 
  mimeType: string, 
  language: 'en' | 'es',
  examplePrompt: string
): Promise<ImageAnalysis> => {
  const ai = getGeminiAI();
  const languageMap = {
    en: 'English',
    es: 'Spanish'
  };
  const currentLanguage = languageMap[language] || 'English';

  const response = await ai.models.generateContent({
    model: analysisModel,
    contents: {
      parts: [
        {
          inlineData: {
            data: base64ImageData,
            mimeType,
          },
        },
        { text: `Analyze this old photograph. Your response must follow the provided JSON schema. First, determine if the photo contains children. Second, determine if this is a 'photo of a photo' (physical photograph captured within another scene like on a table, wall, or in hands) that needs extraction and perspective correction. Third, count the exact number of people visible in the photograph - be precise (0, 1, 2, 3, etc). Fourth, determine if the image has eye color enhancement potential (single person + black & white/sepia/lacks color). Fifth, analyze the lighting carefully - identify the primary light direction, quality, type, and shadow patterns. Sixth, create a SHORT, CONCISE restoration prompt (under 50 words) that MUST include preserving the original lighting direction and shadow patterns, along with: preserving facial features exactly, enhancing with vibrant colors, sharp details, good contrast. IMPORTANT: Do NOT include perspective or geometry corrections in the restoration prompt as they are handled separately. Seventh, generate a detailed, cinematic video prompt in ENGLISH for the Veo model, following the guidelines in the schema. Eighth, generate a suggested filename in ${currentLanguage}.` },
      ],
    },
    config: {
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          containsChildren: {
            type: Type.BOOLEAN,
            description: "True if the photo contains any individuals that appear to be under the age of 18."
          },
          needsPerspectiveCorrection: {
            type: Type.BOOLEAN,
            description: "True if the image shows a physical photograph within another scene (e.g., photo on a table, held in hands, on a wall, in a frame) that needs to be extracted and isolated. This means the image is a 'photo of a photo' where we need to remove the surrounding environment and extract just the photograph itself."
          },
          hasManyPeople: {
            type: Type.BOOLEAN,
            description: "True if the image contains 7 or more people. Count all visible faces in the image."
          },
          isBlackAndWhite: {
            type: Type.BOOLEAN,
            description: "True if the photograph is black and white or has very minimal/faded colors (sepia, monochrome, etc)."
          },
          isVeryOld: {
            type: Type.BOOLEAN,
            description: "True if the photograph appears to be very old (pre-1960s) based on visible aging, damage, fading, or photographic style."
          },
          personCount: {
            type: Type.NUMBER,
            description: "Exact count of people visible in the photograph. Count all faces and bodies carefully. Return the precise number (0, 1, 2, 3, etc). If more than 10 people, return the exact count if possible, otherwise return 10+."
          },
          hasEyeColorPotential: {
            type: Type.BOOLEAN,
            description: "True if this image is suitable for eye color enhancement. This requires BOTH conditions: (1) exactly one person visible in the image, AND (2) the image is black & white, sepia, or lacks natural colors. Only return true if both conditions are met."
          },
          lightingInfo: {
            type: Type.OBJECT,
            description: "Detailed analysis of the lighting in the photograph",
            properties: {
              primaryDirection: {
                type: Type.STRING,
                description: "Primary light source direction. Options: 'left', 'right', 'top', 'bottom', 'front', 'back-left', 'back-right', 'above-left', 'above-right'. Be specific based on shadows and highlights visible in the image."
              },
              quality: {
                type: Type.STRING,
                description: "Quality of the light. Options: 'soft' (diffused, gentle shadows), 'harsh' (strong contrast, hard shadows), 'diffused' (very even, minimal shadows), 'direct' (clear directional light)."
              },
              type: {
                type: Type.STRING,
                description: "Type of lighting detected. Options: 'natural' (outdoor sunlight), 'window' (indoor natural light through window), 'studio' (artificial studio lighting), 'flash' (camera flash), 'mixed' (combination of sources), 'ambient' (general indoor lighting)."
              },
              shadowStrength: {
                type: Type.STRING,
                description: "Strength of shadows in the image. Options: 'strong' (very dark, defined shadows), 'moderate' (clear but not harsh shadows), 'subtle' (soft, gentle shadows), 'minimal' (barely visible shadows)."
              },
              description: {
                type: Type.STRING,
                description: "Natural language description of the lighting setup, including any special characteristics like Rembrandt lighting, rim lighting, golden hour, etc. Be specific about what you observe. Example: 'Soft window light from the left creating gentle shadows on the right side of the face with a subtle rim light on the hair.'"
              }
            }
          },
          videoPrompt: {
            type: Type.STRING,
            description: `Generate a detailed, cinematic prompt IN ENGLISH for the Veo video generation model. The prompt should describe a short, subtle animation. Follow these guidelines:
- **Consistency is Key**: Ensure the characters, clothing, and background in the animation remain as consistent as possible with the original photograph.
- **Subject & Action**: Describe plausible, subtle movements at a natural, real-time speed (avoid slow motion).
- **No Conversations**: Strictly avoid any dialogue or conversations between subjects. Focus on non-verbal actions and atmosphere. Any minimal, essential vocalization must be in ${currentLanguage}.
- **Ambient Sound**: Emphasize plausible ambient sounds that fit the scene (e.g., 'soft chirping of birds', 'a distant city hum', 'the gentle rustle of leaves'). This should be the primary audio element.
- **Style**: Suggest a creative style (e.g., 'cinematic', 'vintage film').
- **Camera & Composition**: The camera must be static or fixed. Use compositional terms like 'fixed shot', 'close-up', 'eye-level shot'.
- **Ambiance**: Describe lighting and mood.
/* Commented out to allow video generation for all subjects */
/* - **Important**: Avoid any references to or descriptions of young children. */
Example prompt: '${examplePrompt}'`
          },
          restorationPrompt: {
            type: Type.STRING,
            description: "Create a realistic colorization instruction. FORMAT: 'Add authentic colors to this [type] photo. Preserve [lighting]. Apply realistic color variation - some elements vibrant, others muted, as in genuine vintage color photography.' Focus on natural variation, not uniform treatment. Under 40 words."
          },
          suggestedFilename: {
            type: Type.STRING,
            description: `Generate a short, descriptive, URL-safe filename in ${currentLanguage} based on the image content, without any file extension. Example: 'woman-in-garden-1960s'.`
          }
        },
      }
    }
  });

  try {
    const jsonText = response.text?.trim();
    if (!jsonText) {
      throw new Error("AI analysis returned empty response.");
    }
    const analysis = JSON.parse(jsonText) as ImageAnalysis;
    return analysis;
  } catch (e) {
    console.error("Failed to parse analysis JSON:", response.text);
    throw new Error("AI analysis returned an invalid format. Please try another image.");
  }
};

export const editImage = async (
  base64ImageData: string, 
  mimeType: string, 
  prompt: string,
  skipAdditionalPrompt: boolean = false,
  originalImageData?: string,
  originalMimeType?: string
): Promise<{ data: string; mimeType: string; }> => {
  console.log("Starting image restoration with Google Gemini...");
  if (originalImageData) {
    console.log("Using original image as reference for comparison");
  }
  //manually set additional things to make it more realistic
  if (!skipAdditionalPrompt) {
    prompt += ". ADD REALISTIC COLOR: Not everything should be muted - real photos have VARIATION. Apply if they exist: 1) TRUE blacks for dark suits/piano (not gray), TRUE whites for white clothing (not cream). 2) Natural skin tones with individual variation - some pink, some tan, some pale. 3) Hair in realistic shades - some darker brown, some lighter, with natural highlights. 4) Let SOME colors be vibrant where appropriate (ties, ribbons) while others stay muted. 5) If there's a piano it should be rich dark wood, the wall neutral but not brown. Think genuine 1950s Kodachrome - it had punchy reds and blues alongside muted tones. AVOID the uniform pastel 'colorized' look.";
  }
  console.log("Restoration prompt:", skipAdditionalPrompt ? "[CLEAN PROMPT - no additions]" : "[WITH ADDITIONS]", prompt);
  
  const ai = getGeminiAI();
  
  // Build parts array with optional original image
  const parts: any[] = [];
  
  // Add original image if provided for reference
  if (originalImageData && originalMimeType) {
    parts.push({
      inlineData: {
        data: originalImageData,
        mimeType: originalMimeType,
      },
    });
  }

  // Add the restored image last
  parts.push({
    inlineData: {
      data: base64ImageData,
      mimeType,
    },
  });
  
  // Add the text prompt
  parts.push({ text: prompt });
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: editModel,
    contents: {
      parts,
    },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  if (!response.candidates || !response.candidates[0] || !response.candidates[0].content || !response.candidates[0].content.parts) {
    throw new Error("The AI did not return a valid response.");
  }

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
      return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
    }
  }

  throw new Error("The AI did not return an edited image. It might have refused the request.");
};

export const translateText = async (text: string, targetLanguage: 'es'): Promise<string> => {
  const ai = getGeminiAI();
  const response = await ai.models.generateContent({
    model: analysisModel,
    contents: `Translate the following cinematic prompt to Spanish for a user interface. Keep the tone cinematic and descriptive, and do not add any extra conversational text or quotation marks around your response. Just provide the direct translation:\n\n"${text}"`
  });
  return response.text?.trim() || '';
};

/**
 * Convert a text prompt to VEO3 JSON structure format using Gemini 2.5 Flash
 */
export const convertPromptToVeoJson = async (
  textPrompt: string, 
  imageAnalysis?: any,
  restoredImageData?: { base64: string; mimeType: string } | null,
  assumeRestored: boolean = false
): Promise<string> => {
  const ai = getGeminiAI();
  const flashModel = 'gemini-2.5-flash'; // Fast model for conversion
  
  // Include lighting info if available
  const lightingContext = imageAnalysis?.lightingInfo?.description ? 
    `Lighting in the scene: ${imageAnalysis.lightingInfo.description}` : '';
  
  // Build the content parts
  const parts: any[] = [];
  
  // Add restored image if provided so AI can see actual colors and details
  if (restoredImageData) {
    parts.push({
      inlineData: {
        data: restoredImageData.base64,
        mimeType: restoredImageData.mimeType,
      },
    });
    parts.push({
      text: `This is the RESTORED and COLORIZED image that will be animated. Analyze the actual colors, clothing, and details visible in THIS image, not the original black and white photo.`
    });
  } else if (assumeRestored) {
    // When pre-generating during analysis, we assume the image WILL BE restored
    parts.push({
      text: `IMPORTANT: Assume this image WILL BE professionally restored and colorized before animation. Describe it as if it already has natural, vibrant colors - skin tones, clothing colors, background colors, etc. Do NOT describe it as black and white or sepia.`
    });
  }
  
  // Add the main prompt
  parts.push({
    text: `You are creating a video animation prompt for a ${assumeRestored ? 'soon-to-be-restored and colorized' : 'restored and colorized'} vintage photograph. This is a precious memory being revived - the goal is to bring this still image to LIFE with natural, subtle movements while PRESERVING the exact identity of all people and creating a warm, nostalgic atmosphere.

CRITICAL IDENTITY PRESERVATION REQUIREMENTS:
- **MAINTAIN EXACT FACIAL IDENTITY**: The faces must remain IDENTICAL to the source image - same facial structure, features, expressions
- **PRESERVE EXACT HAIRSTYLES**: Keep the exact same hair color, style, length, and texture as shown in the image
- **MAINTAIN EXACT CLOTHING**: Preserve all clothing details, colors, patterns, and textures exactly as they appear
- **PHOTOREALISTIC CONSISTENCY**: The animation must maintain photorealistic quality throughout, no morphing or unrealistic changes
- ${assumeRestored ? 'The image WILL BE restored and colorized - describe it with natural, realistic colors as if already restored' : 'The image has been restored and colorized - describe the ACTUAL colors you see'}

ANIMATION GUIDELINES:
- We want to animate this photo with realistic, SUBTLE movements (breathing, blinking, slight head turns, gentle expressions)
- The video should feel like the photo is coming to life while keeping everyone recognizable as the SAME PERSON
- NO changes to facial features, body proportions, or age - only natural movement

AUDIO GENERATION REQUIREMENTS:
- **NOSTALGIC AMBIENT SOUNDS ONLY**: Generate ONLY warm, complementary environmental sounds that enhance the memory and create positive, nostalgic vibes
- **NO HUMAN SOUNDS**: Absolutely NO breathing, panting, laughing, sighing, gasping, or any vocal/respiratory sounds
- **NO DIALOGUE**: No speech, whispers, or any form of conversation
- **FOCUS ON MEMORY-ENHANCING AMBIENCE**: Gentle wind, soft nature sounds, warm room tone, distant pleasant sounds, grandfather clock ticking, gentle rain, birds chirping
- **EXCLUDE**: All human-originated sounds (breathing, panting, footsteps, sighs) and any harsh or jarring noises that break the nostalgic mood
- **ATMOSPHERE**: Create a warm, comforting soundscape that complements the revival of precious memories

Original animation request: "${textPrompt}"
${lightingContext}

Create a structured prompt that will animate this ${assumeRestored ? 'soon-to-be-restored' : 'restored'} photograph with natural movement. CRITICAL FOCUS:
1. **Identity Preservation**: Keep faces, features, and proportions EXACTLY as they are - no morphing or changes
2. ${assumeRestored ? 'Natural, realistic colors that the restored image WILL have' : 'The ACTUAL colors visible in the restored image'} (skin tones, clothing colors, background)
3. Subtle, realistic movements that bring life WITHOUT changing identities
4. Natural actions like breathing, blinking, slight smiles - but faces must remain recognizable as the same people
5. Ambient movement in the scene (hair in breeze, fabric movement) that doesn't alter hairstyles or clothing
6. **Audio**: ONLY warm, nostalgic ambient sounds that enhance the memory - NO human sounds (breathing, panting, sighs) of any kind`
  });

  try {
    const response = await ai.models.generateContent({
      model: flashModel,
      contents: { parts },
      config: {
        temperature: 0.5, // Low temperature for consistent structure
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shot: {
              type: Type.OBJECT,
              properties: {
                composition: { type: Type.STRING, description: 'Camera shot type and framing (e.g., "Medium shot, eye-level angle")' },
                camera_motion: { type: Type.STRING, description: 'Subtle camera movement to enhance life-like feel (e.g., "Gentle handheld movement", "Slight breathing motion")' },
                frame_rate: { type: Type.STRING, description: 'Frame rate (default: "30fps")' },
                film_grain: { type: Type.STRING, description: 'Film texture matching the restored image quality' }
              }
            },
            subject: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING, description: 'Detailed description of subjects as they appear in the RESTORED image with actual skin tones and features' },
                facial_identity: { type: Type.STRING, description: 'CRITICAL: Preserve exact facial features, bone structure, and proportions. No morphing or changes to face shape, eyes, nose, mouth, or any facial characteristics' },
                hairstyle_preservation: { type: Type.STRING, description: 'Maintain EXACT hairstyle, hair color, hair texture, and hair length as shown in the source image - no modifications allowed' },
                wardrobe: { type: Type.STRING, description: 'Actual clothing colors and details visible in the restored image (NOT "period clothing" but specific colors)' },
                body_consistency: { type: Type.STRING, description: 'Preserve exact body proportions, posture, and physical characteristics as shown in the source' },
                character_consistency: { type: Type.STRING, description: 'CRITICAL: Maintain exact photorealistic appearance from the restored photograph - person must be recognizable as the same individual throughout' },
                age_preservation: { type: Type.STRING, description: 'Keep the exact same apparent age - no aging or de-aging effects' }
              }
            },
            scene: {
              type: Type.OBJECT,
              properties: {
                location: { type: Type.STRING, description: 'Setting as visible in the restored image' },
                time_of_day: { type: Type.STRING, description: 'Time period based on the lighting in the restored image' },
                environment: { type: Type.STRING, description: 'Environmental details with actual colors from the restored image' }
              }
            },
            visual_details: {
              type: Type.OBJECT,
              properties: {
                action: { type: Type.STRING, description: 'SUBTLE natural movements that DO NOT alter identity: gentle breathing, soft blinking, micro-expressions, slight head tilts - movements should be minimal to preserve facial recognition' },
                identity_anchoring: { type: Type.STRING, description: 'Ensure all movements maintain facial structure integrity - no warping, morphing, or distortion of features' },
                props: { type: Type.STRING, description: 'Objects visible in the restored image with their actual colors' },
                physics: { type: Type.STRING, description: 'Realistic, subtle movements - gentle hair sway that maintains hairstyle, soft fabric movement that preserves clothing shape, natural breathing without chest distortion' }
              }
            },
            cinematography: {
              type: Type.OBJECT,
              properties: {
                lighting: { type: Type.STRING, description: 'Lighting as it appears in the restored image' },
                tone: { type: Type.STRING, description: 'Visual tone matching the restored image mood' },
                color_palette: { type: Type.STRING, description: 'ACTUAL colors visible in the restored image (e.g., "warm skin tones, blue dress, brown background") NOT "black and white"' }
              }
            },
            audio: {
              type: Type.OBJECT,
              properties: {
                dialogue: { type: Type.STRING, description: 'Always null - absolutely no conversations, speech, or vocal sounds' },
                primary_sounds: { type: Type.STRING, description: 'ONLY nostalgic, complementary environmental sounds (e.g., gentle fabric rustling from breeze, soft paper sounds, curtains swaying). NO breathing, panting, sighing, laughing, or any human-originated sounds' },
                ambient: { type: Type.STRING, description: 'Primary audio focus: Warm, memory-enhancing ambient sounds that create positive nostalgic atmosphere (soft wind, pleasant bird songs, warm room tone, grandfather clock, gentle rain, distant church bells)' },
                environmental_details: { type: Type.STRING, description: 'Additional comforting environmental sounds that enhance the nostalgic mood (soft wood creaking, gentle leaf rustles, peaceful water sounds, vintage mechanical sounds like film projectors or typewriters)' },
                excluded_sounds: { type: Type.STRING, description: 'MUST EXCLUDE: All human sounds including breathing, panting, laughing, sighing, gasping, footsteps, vocal expressions, whispers, or any harsh/jarring sounds that break the nostalgic mood' },
                music: { type: Type.STRING, description: 'Always "No music" - only warm, nostalgic ambient environmental sounds' },
                technical_effects: { type: Type.STRING, description: 'Warm, vintage-inspired audio processing that enhances the memory revival experience' }
              }
            },
            style: {
              type: Type.OBJECT,
              properties: {
                visual_aesthetic: { type: Type.STRING, description: 'Overall visual style' },
                photorealism: { type: Type.STRING, description: 'CRITICAL: Maintain strict photorealistic quality - no artistic interpretation, stylization, or unrealistic effects' },
                consistency_mode: { type: Type.STRING, description: 'Maximum consistency mode: preserve source image identity, features, and appearance throughout entire video' },
                aspect_ratio: { type: Type.STRING, description: 'Aspect ratio (default: "16:9")' },
                quality: { type: Type.STRING, description: 'Video quality (default: "4K")' }
              }
            }
          }
        }
      }
    });

    const jsonText = response.text?.trim();
    if (!jsonText) {
      throw new Error("Failed to convert prompt to VEO3 format");
    }
    
    // Parse and ensure audio constraints are enforced
    const parsed = JSON.parse(jsonText);
    if (parsed.audio) {
      parsed.audio.dialogue = null;
      // Ensure excluded_sounds is always populated to prevent human sounds
      if (!parsed.audio.excluded_sounds) {
        parsed.audio.excluded_sounds = "All human sounds including breathing, panting, laughing, sighing, gasping, footsteps, vocal expressions, whispers, or any harsh/jarring sounds that break the nostalgic mood";
      }
    }
    
    return JSON.stringify(parsed);
  } catch (error) {
    console.error("Error converting prompt to VEO3 JSON:", error);
    console.log("Falling back to enhanced text prompt with identity preservation");
    // Fallback to enhanced text prompt with identity preservation instructions
    const enhancedPrompt = `CRITICAL: Maintain exact facial identity, features, and appearance from source image. ${textPrompt} 
    
STRICT REQUIREMENTS:
- Preserve EXACT facial features and structure - no morphing or changes
- Keep EXACT hairstyle, color, and texture as shown
- Maintain EXACT clothing and appearance
- Ensure photorealistic consistency throughout
- Only add subtle, natural movements (breathing, blinking) that don't alter identity
- Person must remain recognizable as the same individual`;
    
    return enhancedPrompt;
  }
};

/**
 * Start async video generation with Gemini VEO3 and return operation details immediately
 * This avoids timeout issues with long-running video generation on Vercel
 */
export const startGeminiVideoGeneration = async (
  prompt: string,
  imageData: { data: string; mimeType: string; },
  useJsonFormat: boolean = false,
  imageAnalysis?: any,
  veoJsonPrompt?: string
): Promise<string> => {
  const ai = getGeminiAI();
  
  let finalPrompt: string;
  
  // Use pre-computed VEO prompt if available
  if (veoJsonPrompt && useJsonFormat) {
    console.log('Using pre-computed VEO JSON prompt');
    finalPrompt = veoJsonPrompt;
  } else if (useJsonFormat) {
    // Fallback: Convert to JSON format if needed, passing the restored image for context
    console.log('Generating VEO JSON prompt on-demand');
    finalPrompt = await convertPromptToVeoJson(prompt, imageAnalysis, {
      base64: imageData.data, 
      mimeType: imageData.mimeType 
    });
  } else {
    finalPrompt = prompt;
  }
  console.log(`Starting Gemini video generation with ${useJsonFormat ? 'JSON' : 'text'} prompt format`);
  if (useJsonFormat) {
    console.log('VEO3 JSON prompt:', finalPrompt);
  }
  
  const operation = await ai.models.generateVideos({
    model: videoModel,
    prompt: finalPrompt,
    image: {
      imageBytes: imageData.data,
      mimeType: imageData.mimeType,
    },
    config: { numberOfVideos: 1 }
  });

  console.log('Gemini video generation started with operation:', operation.name);
  
  // Return a serialized version of the operation for later use
  // We store essential fields that we'll need to reconstruct the operation
  const operationData = JSON.stringify({
    name: operation.name,
    metadata: operation.metadata,
    done: operation.done
  });
  
  return operationData;
};

/**
 * Check the status of a Gemini video generation operation
 * Returns status and output URL when ready
 */
export const checkGeminiVideoStatus = async (
  operationDataStr: string
): Promise<{ status: string; output?: string }> => {
  const ai = getGeminiAI();
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  
  try {
    // Parse the operation data
    const operationData = JSON.parse(operationDataStr);
    const operationName = operationData.name;
    
    if (!operationName) {
      console.error('No operation name found in operation data');
      return { status: 'failed' };
    }
    
    // Instead of using getVideosOperation, we'll poll the operation directly
    // by making a new generateVideos call with the same parameters and checking if it's done
    // This is a workaround since we can't properly reconstruct the operation object
    
    // Alternative approach: Use the REST API directly to check status
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/';
    const url = `${baseUrl}${operationName}?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error('Failed to check operation status:', response.statusText);
      return { status: 'failed' };
    }
    
    const operation = await response.json();
    
    console.log(`Gemini operation ${operationName} status: ${operation.done ? 'completed' : 'processing'}`);
    
    // Log the full operation when done to see the structure
    if (operation.done) {
      console.log('Completed operation structure:', JSON.stringify(operation, null, 2));
    }
    
    if (operation.error) {
      console.error('Gemini video generation error:', operation.error);
      return { status: 'failed' };
    }
    
    // Check for video URL in the actual REST API response location
    if (operation.done && operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri) {
      const videoUrl = operation.response.generateVideoResponse.generatedSamples[0].video.uri;
      console.log('Found video URL:', videoUrl);
      // Add API key to the URL for authentication
      const authenticatedUrl = `${videoUrl}&key=${apiKey}`;
      return {
        status: 'succeeded',
        output: authenticatedUrl
      };
    }
    
    // Fallback: Check for video URL in the SDK expected location (for compatibility)
    if (operation.done && operation.response?.generatedVideos?.[0]?.video?.uri) {
      const videoUrl = operation.response.generatedVideos[0].video.uri;
      console.log('Found video URL (SDK path):', videoUrl);
      // Add API key to the URL for authentication
      const authenticatedUrl = `${videoUrl}&key=${apiKey}`;
      return {
        status: 'succeeded',
        output: authenticatedUrl
      };
    }
    
    if (operation.done) {
      console.error('Operation completed but no video URL found in response');
    }
    
    return {
      status: operation.done ? 'succeeded' : 'processing'
    };
  } catch (error) {
    console.error('Check Gemini video status error:', error);
    return { status: 'failed' };
  }
};

// Keep the original synchronous function for backward compatibility
export const generateVideo = async (
  prompt: string,
  imageData: { data: string; mimeType: string; },
  useJsonFormat: boolean = false,
  imageAnalysis?: any,
  veoJsonPrompt?: string
): Promise<string> => {
  const ai = getGeminiAI();
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  
  let finalPrompt: string;
  
  // Use pre-computed VEO prompt if available
  if (veoJsonPrompt && useJsonFormat) {
    console.log('Using pre-computed VEO JSON prompt');
    finalPrompt = veoJsonPrompt;
  } else if (useJsonFormat) {
    // Fallback: Convert to JSON format if needed, passing the restored image for context
    console.log('Generating VEO JSON prompt on-demand');
    finalPrompt = await convertPromptToVeoJson(prompt, imageAnalysis, { 
      base64: imageData.data, 
      mimeType: imageData.mimeType 
    });
  } else {
    finalPrompt = prompt;
  }
  console.log(`Generating video with ${useJsonFormat ? 'JSON' : 'text'} prompt format`);
  if (useJsonFormat) {
    console.log('VEO3 JSON prompt:', finalPrompt);
  }
  
  let operation = await ai.models.generateVideos({
    model: videoModel,
    prompt: finalPrompt,
    image: {
      imageBytes: imageData.data,
      mimeType: imageData.mimeType,
    },
    config: { numberOfVideos: 1 }
  });

  while (operation && !operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation as any });
    
    if (!operation) {
      throw new Error("Failed to get video generation status from the server.");
    }

    if (operation.error) {
      const errorMessage = (operation.error as any).message || JSON.stringify(operation.error);
      throw new Error(`Video generation failed during processing: ${errorMessage}`);
    }
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error("Video generation completed, but no download link was found.");
  }

  const response = await fetch(`${downloadLink}&key=${apiKey}`);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }
  const blob = await response.blob();
  
  // Convert blob to base64 for transmission to client
  const buffer = await blob.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return base64;
};
