import Groq from 'groq-sdk';
import type { ImageAnalysis } from '@/types';

// Server-side only - these functions will be called from API routes
export function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set.");
  }
  return new Groq({ apiKey });
}

// Using llama-3.3-70b-versatile as it's one of the best available models on Groq
const textModel = 'openai/gpt-oss-20b';

export const translateText = async (text: string, targetLanguage: 'es'): Promise<string> => {
  const groq = getGroqClient();
  
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Translate text while maintaining the cinematic and descriptive tone. Provide only the translation without any additional text, quotes, or explanations.'
        },
        {
          role: 'user',
          content: `Translate the following cinematic prompt to Spanish for a user interface. Keep the tone cinematic and descriptive:\n\n${text}`
        }
      ],
      model: textModel,
      temperature: 0.3,
      max_tokens: 1000,
    });

    const translatedText = response.choices[0]?.message?.content?.trim();
    
    if (!translatedText) {
      throw new Error('No translation received from Groq');
    }
    
    return translatedText;
  } catch (error) {
    console.error('Groq translation error:', error);
    throw error;
  }
};

export const generatePromptsWithGroq = async (
  imageAnalysisFromGemini: Partial<ImageAnalysis>,
  language: 'en' | 'es',
  examplePrompt: string
): Promise<{ videoPrompt: string; restorationPrompt: string; suggestedFilename: string }> => {
  const groq = getGroqClient();
  const languageMap = {
    en: 'English',
    es: 'Spanish'
  };
  const currentLanguage = languageMap[language] || 'English';
  
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert at creating prompts for image restoration and video generation. Based on the image analysis provided, generate:
1. A restoration prompt (under 50 words) focusing on preserving facial features and enhancing colors/details
2. A cinematic video prompt for the Veo model following specific guidelines
3. A suggested filename in ${currentLanguage}

Return your response as valid JSON with keys: restorationPrompt, videoPrompt, suggestedFilename`
        },
        {
          role: 'user',
          content: `Image Analysis Results:
- Contains children: ${imageAnalysisFromGemini.containsChildren || false}
- Needs perspective correction: ${imageAnalysisFromGemini.needsPerspectiveCorrection || false}
- Has many people (7+): ${imageAnalysisFromGemini.hasManyPeople || false}
- Is black and white: ${imageAnalysisFromGemini.isBlackAndWhite || false}
- Is very old (pre-1960s): ${imageAnalysisFromGemini.isVeryOld || false}

Generate:
1. Restoration prompt: Focus on preserving all facial features exactly, then enhance with vibrant colors, sharp details, good contrast. DO NOT include perspective corrections.

2. Video prompt (in English): Create a detailed, cinematic prompt for subtle animation. Guidelines:
- Keep characters, clothing, background consistent with original
- Describe subtle, real-time movements (no slow motion)
- NO dialogue or conversations, focus on non-verbal actions
- Emphasize ambient sounds (birds, wind, etc.)
- Use fixed/static camera terms
- Any minimal vocalization must be in ${currentLanguage}
Example: "${examplePrompt}"

3. Filename: Short, descriptive, URL-safe in ${currentLanguage}`
        }
      ],
      model: textModel,
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response received from Groq');
    }

    const result = JSON.parse(content);
    
    // Validate the response has required fields
    if (!result.restorationPrompt || !result.videoPrompt || !result.suggestedFilename) {
      throw new Error('Invalid response format from Groq');
    }
    
    return result;
  } catch (error) {
    console.error('Groq prompt generation error:', error);
    throw error;
  }
};

// Fallback function that tries Groq first, then falls back to a provided function
export const withGroqFallback = async <T>(
  groqFunction: () => Promise<T>,
  fallbackFunction: () => Promise<T>,
  functionName: string
): Promise<T> => {
  try {
    console.log(`Attempting ${functionName} with Groq...`);
    return await groqFunction();
  } catch (groqError) {
    console.error(`Groq ${functionName} failed:`, groqError);
    console.log(`Falling back to Gemini for ${functionName}...`);
    
    try {
      return await fallbackFunction();
    } catch (fallbackError) {
      console.error(`Gemini fallback for ${functionName} also failed:`, fallbackError);
      // Throw the original Groq error as it's our primary service
      throw groqError;
    }
  }
};
