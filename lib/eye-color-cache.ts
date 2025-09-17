/**
 * Eye Color Cache Service
 * Manages browser-based caching of restored images with different eye colors
 */

export interface CachedImage {
  base64: string;
  mimeType: string;
  timestamp: number;
}

export type EyeColor = 'brown' | 'blue' | 'green' | 'hazel' | 'gray' | 'amber';

export const EYE_COLORS: { value: EyeColor; label: string; color: string }[] = [
  { value: 'brown', label: 'Brown', color: '#6B4423' },  // Natural dark brown
  { value: 'blue', label: 'Blue', color: '#6B9BD1' },    // Natural blue-gray
  { value: 'green', label: 'Green', color: '#7EA77A' },  // Natural green-hazel
  { value: 'hazel', label: 'Hazel', color: '#8B7355' },  // Natural hazel-brown
  { value: 'gray', label: 'Gray', color: '#8B9A9B' },    // Natural gray-blue
  { value: 'amber', label: 'Amber', color: '#B87333' },  // Natural amber-brown
];

class EyeColorCacheService {
  private cache = new Map<string, Map<EyeColor, CachedImage>>();
  private readonly MAX_CACHE_AGE = 1000 * 60 * 60; // 1 hour
  private readonly MAX_IMAGES_PER_ORIGINAL = 6; // Max eye colors we support

  /**
   * Generates a cache key for an original image
   */
  private generateImageKey(base64: string): string {
    // Use a simple hash of the first 100 characters of base64 for performance
    return btoa(base64.substring(0, 100)).replace(/[+/=]/g, '');
  }

  /**
   * Stores a restored image with specific eye color in cache
   */
  setCachedImage(
    originalBase64: string,
    eyeColor: EyeColor,
    restoredImage: { base64: string; mimeType: string }
  ): void {
    const imageKey = this.generateImageKey(originalBase64);
    
    if (!this.cache.has(imageKey)) {
      this.cache.set(imageKey, new Map());
    }
    
    const imageCache = this.cache.get(imageKey)!;
    imageCache.set(eyeColor, {
      base64: restoredImage.base64,
      mimeType: restoredImage.mimeType,
      timestamp: Date.now(),
    });

    // Clean up old entries if cache gets too large
    this.cleanup();
  }

  /**
   * Retrieves a cached restored image for specific eye color
   */
  getCachedImage(
    originalBase64: string,
    eyeColor: EyeColor
  ): CachedImage | null {
    const imageKey = this.generateImageKey(originalBase64);
    const imageCache = this.cache.get(imageKey);
    
    if (!imageCache) {
      return null;
    }

    const cached = imageCache.get(eyeColor);
    if (!cached) {
      return null;
    }

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.MAX_CACHE_AGE) {
      imageCache.delete(eyeColor);
      return null;
    }

    return cached;
  }

  /**
   * Checks if a specific eye color version is cached
   */
  isCached(originalBase64: string, eyeColor: EyeColor): boolean {
    return this.getCachedImage(originalBase64, eyeColor) !== null;
  }

  /**
   * Gets all cached eye colors for an original image
   */
  getCachedEyeColors(originalBase64: string): EyeColor[] {
    const imageKey = this.generateImageKey(originalBase64);
    const imageCache = this.cache.get(imageKey);
    
    if (!imageCache) {
      return [];
    }

    const validColors: EyeColor[] = [];
    const now = Date.now();

    for (const [eyeColor, cached] of imageCache.entries()) {
      if (now - cached.timestamp <= this.MAX_CACHE_AGE) {
        validColors.push(eyeColor);
      } else {
        // Remove expired entries
        imageCache.delete(eyeColor);
      }
    }

    return validColors;
  }

  /**
   * Clears cache for a specific original image (e.g., when user uploads new image)
   */
  clearImageCache(originalBase64: string): void {
    const imageKey = this.generateImageKey(originalBase64);
    this.cache.delete(imageKey);
  }

  /**
   * Clears all cached images
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Cleanup old or excessive cache entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Remove expired entries
    for (const [imageKey, imageCache] of this.cache.entries()) {
      for (const [eyeColor, cached] of imageCache.entries()) {
        if (now - cached.timestamp > this.MAX_CACHE_AGE) {
          imageCache.delete(eyeColor);
        }
      }
      
      // Remove empty image caches
      if (imageCache.size === 0) {
        this.cache.delete(imageKey);
      }
    }

    // If we still have too many total cache entries, remove oldest ones
    if (this.cache.size > 10) { // Max 10 different original images
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => {
        const aOldest = Math.min(...Array.from(a[1].values()).map(c => c.timestamp));
        const bOldest = Math.min(...Array.from(b[1].values()).map(c => c.timestamp));
        return aOldest - bOldest;
      });
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - 10);
      toRemove.forEach(([imageKey]) => this.cache.delete(imageKey));
    }
  }

  /**
   * Gets cache statistics for debugging
   */
  getCacheStats(): {
    totalImages: number;
    totalVariations: number;
    memoryEstimate: string;
  } {
    let totalVariations = 0;
    let totalSize = 0;

    for (const imageCache of this.cache.values()) {
      totalVariations += imageCache.size;
      for (const cached of imageCache.values()) {
        // Rough estimate: base64 string length * 0.75 (base64 overhead) 
        totalSize += cached.base64.length * 0.75;
      }
    }

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      totalImages: this.cache.size,
      totalVariations,
      memoryEstimate: formatBytes(totalSize),
    };
  }
}

// Export singleton instance
export const eyeColorCache = new EyeColorCacheService();
