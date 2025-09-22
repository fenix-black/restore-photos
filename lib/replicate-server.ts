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

    // Configure the Kling v2.1 model input with identity preservation
    const enhancedPrompt = `${prompt}. CRITICAL: Maintain exact facial identity and features from source image. Preserve exact hairstyle, clothing, and appearance. Ensure photorealistic consistency with subtle, natural movements only.`;
    
    const input = {
      mode: "standard",
      prompt: enhancedPrompt,
      duration: 5, // 5 second video
      start_image: dataUri,
      negative_prompt: "blurry, distorted, unrealistic movement, artifacts, glitches, face morphing, identity changes, feature distortion, unrealistic transformations"
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

    // Configure Flux Restore Image model input (specialized for restoration)
    /*const input = {
      input_image: dataUri,
      output_format: "png",
      safety_tolerance: 2
    };
    console.log("Starting image restoration with Replicate Flux Restore Image...");
    // Run the model
    const output = await replicate.run(
      "flux-kontext-apps/restore-image", 
      { input }
    ) as any;*/
    const input = {
      image: dataUri,
      upscale: 2,
      face_upsample: true,
      background_enhance: true,
      codeformer_fidelity: 0.8
    };
    console.log("Starting image restoration with Replicate CodeFormer...");
    
    // Run the model
    const output = await replicate.run(
      "sczhou/codeformer:7de2ea26c616d5bf2245ad0d5e24f0ff9a6204578a5c876db53142edd9d2cd56", 
      { input }
    ) as any;

    // Handle the output - Flux Restore Image returns an object with url() method
    console.log("Replicate output received:", typeof output);
    
    if (!output) {
      console.error("Invalid output from Replicate:", output);
      throw new Error("No output returned from Replicate CodeFormer Image");
    }
    
    // Get the image output (Flux Restore typically returns a single object)
    const imageOutput = Array.isArray(output) ? output[0] : output;
    let base64: string;
    let contentType = mimeType;
    
    // Check if it's a ReadableStream
    if (imageOutput && imageOutput instanceof ReadableStream) {
      console.log("Output is a ReadableStream, reading directly...");
      const reader = imageOutput.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
      base64 = buffer.toString('base64');
      contentType = 'image/png'; // Seedream-4 typically outputs PNG
    }
    // Check if it has a url method
    else if (imageOutput && typeof imageOutput.url === 'function') {
      const imageUrl = await imageOutput.url();
      console.log("Image restored successfully, downloading from:", imageUrl);
      
      // Download the image from the URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download restored image from Replicate: ${response.statusText}`);
      }
      
      // Convert to base64
      const arrayBuffer = await response.arrayBuffer();
      base64 = Buffer.from(arrayBuffer).toString('base64');
      contentType = 'image/png'; // Seedream-4 typically outputs PNG as configured
    }
    // If it's already a string URL
    else if (typeof imageOutput === 'string') {
      console.log("Image restored successfully, downloading from:", imageOutput);
      
      const response = await fetch(imageOutput);
      if (!response.ok) {
        throw new Error(`Failed to download restored image from Replicate: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      base64 = Buffer.from(arrayBuffer).toString('base64');
      contentType = 'image/png'; // Seedream-4 typically outputs PNG
    }
    // If it's a Buffer or Uint8Array
    else if (Buffer.isBuffer(imageOutput) || imageOutput instanceof Uint8Array) {
      console.log("Output is a buffer, converting directly...");
      base64 = Buffer.from(imageOutput).toString('base64');
      contentType = 'image/png'; // Seedream-4 typically outputs PNG
    }
    else {
      console.error("Unexpected output format from Replicate:", imageOutput);
      throw new Error("Unable to process Replicate output");
    }
    
    console.log("Image processed and converted to base64");
    
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
 * Start async video generation and return prediction ID immediately
 * This avoids timeout issues with long-running video generation
 */
export const startVideoGeneration = async (
  prompt: string,
  imageData: { data: string; mimeType: string; }
): Promise<string> => {
  const replicate = getReplicateClient();

  try {
    // Convert base64 image to data URI for Replicate
    const dataUri = `data:${imageData.mimeType};base64,${imageData.data}`;

    // Configure the model input with identity preservation
    const enhancedPrompt = `${prompt}. CRITICAL: Maintain exact facial identity and features from source image. Preserve exact hairstyle, clothing, and appearance. Ensure photorealistic consistency with subtle, natural movements only.`;
    
    const input = {
      fps: 24,
      image: dataUri,
      prompt: enhancedPrompt,
      duration: 5,
      resolution: "480p",
      camera_fixed: true,
      aspect_ratio: "16:9"
    };

    console.log("Starting async video generation with Replicate...");
    
    // Create prediction instead of running directly
    const prediction = await replicate.predictions.create({
      model: "bytedance/seedance-1-pro",
      input
    });

    console.log("Video generation started with prediction ID:", prediction.id);
    
    return prediction.id;
  } catch (error) {
    console.error('Replicate video generation start error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('REPLICATE_API_TOKEN')) {
        throw new Error('Replicate API token is not configured. Please set REPLICATE_API_TOKEN in your environment variables.');
      }
      throw error;
    }
    
    throw new Error('Failed to start video generation');
  }
};

/**
 * Check the status of a video generation prediction
 * Returns status and output URL when ready
 */
export const checkVideoGenerationStatus = async (
  predictionId: string
): Promise<{ status: string; output?: string }> => {
  const replicate = getReplicateClient();

  try {
    const prediction = await replicate.predictions.get(predictionId);
    
    console.log(`Prediction ${predictionId} status: ${prediction.status}`);
    
    // Return status and output if available
    if (prediction.status === 'succeeded' && prediction.output) {
      // Handle different output formats
      const videoUrl = Array.isArray(prediction.output) 
        ? prediction.output[0] 
        : prediction.output;
      
      return {
        status: prediction.status,
        output: videoUrl
      };
    }
    
    return {
      status: prediction.status
    };
  } catch (error) {
    console.error('Check video status error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to check video generation status');
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

    // Configure the Kling v2.1 model input: kwaivgi/kling-v2.1
    /*const input = {
      mode: "standard",
      prompt: prompt,
      duration: 5,
      start_image: dataUri,
      negative_prompt: "blurry, distorted, unrealistic movement, artifacts, glitches"
    };*/
    // Configure the Kling v2.1 model input
    const input = {
      prompt: prompt,
      duration: 6,
      first_frame_image: dataUri,
      resolution: "512p",
      prompt_optimizer: false
    };

    console.log("Starting video generation with Replicate (URL mode)...");
    
    // Run the model
    const output = await replicate.run("minimax/hailuo-02", { 
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
