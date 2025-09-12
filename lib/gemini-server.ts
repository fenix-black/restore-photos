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

const analysisModel = 'gemini-2.5-flash';
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
        { text: `Analyze this old photograph. Your response must follow the provided JSON schema. First, determine if the photo contains children. Second, determine if it needs perspective correction. Third, create a SHORT, CONCISE restoration prompt (under 50 words) focusing on: vibrant colors, sharp details, good contrast, realistic skin tones. Fourth, generate a detailed, cinematic video prompt in ENGLISH for the Veo model, following the guidelines in the schema. Fifth, generate a suggested filename in ${currentLanguage}.` },
      ],
    },
    config: {
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
            description: "True if the image is a photo of a physical photograph, possibly on a table or held, and requires perspective correction and cropping."
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
            description: "Create a concise, technical prompt to restore and colorize this photo. Focus on: vibrant natural colors, sharp details, good contrast, warm skin tones, realistic textures. Keep it under 50 words. Example: 'Restore and colorize with vibrant natural colors. Sharp details, good contrast, warm realistic skin tones. Fix damage. Modern photo quality.'"
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
  prompt: string
): Promise<{ data: string; mimeType: string; }> => {
  console.log("Starting image restoration with Google Gemini...");
  console.log("Restoration prompt:", prompt);
  
  const ai = getGeminiAI();
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: editModel,
    contents: {
      parts: [
        {
          inlineData: {
            data: base64ImageData,
            mimeType,
          },
        },
        { text: prompt },
      ],
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
