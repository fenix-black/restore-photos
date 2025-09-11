import Replicate from "replicate";

export function getReplicateClient() {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    throw new Error("REPLICATE_API_TOKEN environment variable is not set.");
  }
  return new Replicate({
    auth: apiToken,
  });
}

/**
 * Generates a video using Replicate's Kling v2.1 model
 * @param prompt - The video generation prompt
 * @param imageData - The base64 image data and mime type
 * @returns Base64 encoded video data
 */
export const generateVideoWithReplicate = async (
  prompt: string,
  imageData: { data: string; mimeType: string; }
): Promise<string> => {
  const replicate = getReplicateClient();

  try {
    // Convert base64 image to data URI for Replicate
    // Replicate accepts data URIs as input for images
    const dataUri = `data:${imageData.mimeType};base64,${imageData.data}`;

    // Configure the Kling v2.1 model input
    const input = {
      mode: "standard",
      prompt: prompt,
      duration: 5, // 5 second video
      start_image: dataUri,
      negative_prompt: "blurry, distorted, unrealistic movement, artifacts, glitches"
    };

    console.log("Starting video generation with Replicate...");
    
    // Run the model
    // Note: This returns a URL or array of URLs depending on the model
    const output = await replicate.run("kwaivgi/kling-v2.1", { 
      input 
    }) as string | string[];

    // Handle the output - it might be a string URL or array of URLs
    const videoUrl = Array.isArray(output) ? output[0] : output;
    
    if (!videoUrl) {
      throw new Error("No video URL returned from Replicate");
    }

    console.log("Video generated successfully, downloading...");

    // Download the video from the URL
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video from Replicate: ${response.statusText}`);
    }

    // Convert to base64 for consistency with current implementation
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    console.log("Video downloaded and converted to base64");
    
    return base64;
  } catch (error) {
    console.error('Replicate video generation error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('REPLICATE_API_TOKEN')) {
        throw new Error('Replicate API token is not configured. Please set REPLICATE_API_TOKEN in your environment variables.');
      }
      if (error.message.includes('rate limit')) {
        throw new Error('Replicate API rate limit exceeded. Please try again later.');
      }
      if (error.message.includes('timeout')) {
        throw new Error('Video generation timed out. Please try again with a shorter duration or simpler prompt.');
      }
      throw error;
    }
    
    throw new Error('An unexpected error occurred during video generation');
  }
};

/**
 * Restores and enhances an image using Replicate's Seedream-4 model
 * This is used as a fallback when Google Gemini image editing fails
 * @param base64ImageData - The base64 encoded image data
 * @param mimeType - The MIME type of the image
 * @param prompt - The restoration prompt
 * @returns Base64 encoded restored image data
 */
export const restoreImageWithReplicate = async (
  base64ImageData: string,
  mimeType: string,
  prompt: string
): Promise<{ data: string; mimeType: string }> => {
  const replicate = getReplicateClient();

  try {
    // Convert base64 image to data URI for Replicate
    const dataUri = `data:${mimeType};base64,${base64ImageData}`;

    // Configure Seedream-4 model input
    // The model works best with specific size and aspect ratio settings
    const input = {
      size: "2K",
      width: 2048,
      height: 2048,
      prompt: prompt,
      max_images: 1,
      image_input: [dataUri], // Seedream-4 accepts image input for restoration/enhancement
      aspect_ratio: "match_input_image", // Will be overridden by actual image dimensions
      sequential_image_generation: "disabled"
    };

    console.log("Starting image restoration with Replicate Seedream-4...");
    
    // Run the model
    const output = await replicate.run(
      "bytedance/seedream-4", 
      { input }
    ) as Array<{ url: string }> | { url: string };

    // Handle the output - Seedream-4 returns an array of image objects
    const imageUrl = Array.isArray(output) 
      ? output[0]?.url 
      : (output as any)?.url || output;
    
    if (!imageUrl) {
      throw new Error("No image URL returned from Replicate Seedream-4");
    }

    console.log("Image restored successfully, downloading...");

    // Download the image from the URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download restored image from Replicate: ${response.statusText}`);
    }

    // Convert to base64 for consistency with current implementation
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Determine the mime type from the response or default to the input type
    const contentType = response.headers.get('content-type') || mimeType;
    
    console.log("Image downloaded and converted to base64");
    
    return { 
      data: base64, 
      mimeType: contentType 
    };
  } catch (error) {
    console.error('Replicate image restoration error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('REPLICATE_API_TOKEN')) {
        throw new Error('Replicate API token is not configured. Please set REPLICATE_API_TOKEN in your environment variables.');
      }
      if (error.message.includes('rate limit')) {
        throw new Error('Replicate API rate limit exceeded. Please try again later.');
      }
      if (error.message.includes('timeout')) {
        throw new Error('Image restoration timed out. Please try again with a simpler prompt.');
      }
      throw error;
    }
    
    throw new Error('An unexpected error occurred during image restoration with Replicate');
  }
};

/**
 * Alternative method that returns the video URL directly instead of base64
 * This is more efficient for Vercel deployments as it avoids large payloads
 */
export const generateVideoUrlWithReplicate = async (
  prompt: string,
  imageData: { data: string; mimeType: string; }
): Promise<string> => {
  const replicate = getReplicateClient();

  try {
    // Convert base64 image to data URI for Replicate
    const dataUri = `data:${imageData.mimeType};base64,${imageData.data}`;

    // Configure the Kling v2.1 model input
    const input = {
      mode: "standard",
      prompt: prompt,
      duration: 5,
      start_image: dataUri,
      negative_prompt: "blurry, distorted, unrealistic movement, artifacts, glitches"
    };

    console.log("Starting video generation with Replicate (URL mode)...");
    
    // Run the model
    const output = await replicate.run("kwaivgi/kling-v2.1", { 
      input 
    }) as string | string[];

    // Handle the output
    const videoUrl = Array.isArray(output) ? output[0] : output;
    
    if (!videoUrl) {
      throw new Error("No video URL returned from Replicate");
    }

    console.log("Video generated successfully, URL:", videoUrl);
    
    return videoUrl;
  } catch (error) {
    console.error('Replicate video generation error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('REPLICATE_API_TOKEN')) {
        throw new Error('Replicate API token is not configured. Please set REPLICATE_API_TOKEN in your environment variables.');
      }
      throw error;
    }
    
    throw new Error('An unexpected error occurred during video generation');
  }
};
