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
    return JSON.parse(jsonText) as ImageAnalysis;
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
    prompt += ". ADD REALISTIC COLOR: Not everything should be muted - real photos have VARIATION. Apply: 1) TRUE blacks for dark suits/piano (not gray), TRUE whites for white clothing (not cream). 2) Natural skin tones with individual variation - some pink, some tan, some pale. 3) Hair in realistic shades - some darker brown, some lighter, with natural highlights. 4) Let SOME colors be vibrant where appropriate (ties, ribbons) while others stay muted. 5) The piano should be rich dark wood, the wall neutral but not brown. Think genuine 1950s Kodachrome - it had punchy reds and blues alongside muted tones. AVOID the uniform pastel 'colorized' look.";
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

export const generateVideo = async (
  prompt: string,
  imageData: { data: string; mimeType: string; }
): Promise<string> => {
  const ai = getGeminiAI();
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  
  let operation = await ai.models.generateVideos({
    model: videoModel,
    prompt: prompt,
    image: {
      imageBytes: imageData.data,
      mimeType: imageData.mimeType,
    },
    config: { numberOfVideos: 1 }
  });

  while (operation && !operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
    
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
