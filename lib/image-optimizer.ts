import sharp from 'sharp';

interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeKB?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: OptimizationOptions = {
  maxWidth: 1200,
  maxHeight: 1200,
  maxSizeKB: 400,
  quality: 85,
};

/**
 * Optimizes an image by resizing and compressing it if needed
 * @param base64Input - Base64 encoded image string
 * @param mimeType - MIME type of the image
 * @param options - Optimization options
 * @returns Optimized base64 image and metadata
 */
export async function optimizeImage(
  base64Input: string,
  mimeType: string,
  options: OptimizationOptions = {}
): Promise<{
  base64: string;
  mimeType: string;
  wasOptimized: boolean;
  originalSize: number;
  optimizedSize: number;
  dimensions: { width: number; height: number };
}> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Convert base64 to buffer
  const inputBuffer = Buffer.from(base64Input, 'base64');
  const originalSize = inputBuffer.length;
  
  // Get image metadata
  const metadata = await sharp(inputBuffer).metadata();
  const { width = 0, height = 0, format } = metadata;
  
  // Check if optimization is needed
  const needsResize = width > opts.maxWidth! || height > opts.maxHeight!;
  const needsCompression = originalSize > (opts.maxSizeKB! * 1024);
  
  if (!needsResize && !needsCompression) {
    console.log('Image optimization not needed - already within limits');
    return {
      base64: base64Input,
      mimeType,
      wasOptimized: false,
      originalSize,
      optimizedSize: originalSize,
      dimensions: { width, height },
    };
  }
  
  console.log(`Optimizing image: ${width}x${height}, ${(originalSize / 1024).toFixed(2)}KB`);
  
  try {
    // Create sharp instance
    let sharpInstance = sharp(inputBuffer);
    
    // Resize if needed (maintaining aspect ratio)
    if (needsResize) {
      sharpInstance = sharpInstance.resize(opts.maxWidth, opts.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    
    // Apply format-specific compression
    let outputBuffer: Buffer;
    let outputMimeType = mimeType;
    
    if (format === 'jpeg' || format === 'jpg' || mimeType.includes('jpeg')) {
      outputBuffer = await sharpInstance
        .jpeg({ quality: opts.quality, progressive: true })
        .toBuffer();
      outputMimeType = 'image/jpeg';
    } else if (format === 'png' || mimeType.includes('png')) {
      outputBuffer = await sharpInstance
        .png({ quality: opts.quality, compressionLevel: 9 })
        .toBuffer();
      outputMimeType = 'image/png';
    } else if (format === 'webp' || mimeType.includes('webp')) {
      outputBuffer = await sharpInstance
        .webp({ quality: opts.quality })
        .toBuffer();
      outputMimeType = 'image/webp';
    } else {
      // Convert other formats to JPEG for better compression
      outputBuffer = await sharpInstance
        .jpeg({ quality: opts.quality, progressive: true })
        .toBuffer();
      outputMimeType = 'image/jpeg';
    }
    
    // Get optimized image metadata
    const optimizedMetadata = await sharp(outputBuffer).metadata();
    const optimizedSize = outputBuffer.length;
    
    console.log(`Image optimized: ${optimizedMetadata.width}x${optimizedMetadata.height}, ${(optimizedSize / 1024).toFixed(2)}KB`);
    console.log(`Size reduction: ${((1 - optimizedSize / originalSize) * 100).toFixed(1)}%`);
    
    return {
      base64: outputBuffer.toString('base64'),
      mimeType: outputMimeType,
      wasOptimized: true,
      originalSize,
      optimizedSize,
      dimensions: {
        width: optimizedMetadata.width || 0,
        height: optimizedMetadata.height || 0,
      },
    };
  } catch (error) {
    console.error('Error optimizing image:', error);
    // Return original if optimization fails
    return {
      base64: base64Input,
      mimeType,
      wasOptimized: false,
      originalSize,
      optimizedSize: originalSize,
      dimensions: { width, height },
    };
  }
}

/**
 * Checks if an image needs optimization based on size and dimensions
 * @param base64Input - Base64 encoded image string
 * @param options - Optimization options
 * @returns Boolean indicating if optimization is needed
 */
export async function needsOptimization(
  base64Input: string,
  options: OptimizationOptions = {}
): Promise<boolean> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    const inputBuffer = Buffer.from(base64Input, 'base64');
    const size = inputBuffer.length;
    
    // Check file size
    if (size > (opts.maxSizeKB! * 1024)) {
      return true;
    }
    
    // Check dimensions
    const metadata = await sharp(inputBuffer).metadata();
    const { width = 0, height = 0 } = metadata;
    
    return width > opts.maxWidth! || height > opts.maxHeight!;
  } catch (error) {
    console.error('Error checking if optimization is needed:', error);
    return false;
  }
}

/**
 * Optimizes a restored image for download by converting to JPEG and applying compression
 * @param base64Input - Base64 encoded image string
 * @param quality - JPEG quality (default: 90 for restored images)
 * @returns Optimized JPEG image as base64
 */
export async function optimizeRestoredImage(
  base64Input: string,
  quality: number = 90
): Promise<{
  base64: string;
  mimeType: string;
  originalSize: number;
  optimizedSize: number;
  dimensions: { width: number; height: number };
}> {
  try {
    const inputBuffer = Buffer.from(base64Input, 'base64');
    const originalSize = inputBuffer.length;
    
    // Get image metadata
    const metadata = await sharp(inputBuffer).metadata();
    const { width = 0, height = 0 } = metadata;
    
    console.log(`Optimizing restored image: ${width}x${height}, ${(originalSize / 1024).toFixed(2)}KB`);
    
    // Convert to JPEG with high quality for restored images
    // We use higher quality (90) for restored images to preserve details
    const outputBuffer = await sharp(inputBuffer)
      .jpeg({ 
        quality, 
        progressive: true,
        mozjpeg: true, // Use mozjpeg encoder for better compression
      })
      .toBuffer();
    
    const optimizedSize = outputBuffer.length;
    
    console.log(`Restored image optimized: ${width}x${height}, ${(optimizedSize / 1024).toFixed(2)}KB`);
    console.log(`Size reduction: ${((1 - optimizedSize / originalSize) * 100).toFixed(1)}%`);
    
    return {
      base64: outputBuffer.toString('base64'),
      mimeType: 'image/jpeg',
      originalSize,
      optimizedSize,
      dimensions: { width, height },
    };
  } catch (error) {
    console.error('Error optimizing restored image:', error);
    // Return original if optimization fails
    const inputBuffer = Buffer.from(base64Input, 'base64');
    const metadata = await sharp(inputBuffer).metadata();
    
    return {
      base64: base64Input,
      mimeType: 'image/png', // Assume PNG if we can't optimize
      originalSize: inputBuffer.length,
      optimizedSize: inputBuffer.length,
      dimensions: { 
        width: metadata.width || 0, 
        height: metadata.height || 0 
      },
    };
  }
}
