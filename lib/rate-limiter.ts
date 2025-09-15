/**
 * Rate limiting service for anonymous users
 * Tracks usage per browser fingerprint with geolocation-based limits
 */

interface RateLimitEntry {
  count: number;
  lastReset: Date;
  country: string;
  lastAccess: Date;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  country: string;
  limit: number;
}

interface GeolocationResult {
  country: string;
  countryCode: string;
  isChile: boolean;
}

// In-memory storage for rate limiting data
// In production, this should be replaced with Redis, Vercel KV, or database
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every hour to prevent memory leaks
setInterval(() => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.lastAccess < oneDayAgo) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000);

/**
 * Get user's country based on IP address
 */
export async function getUserCountry(request: Request): Promise<GeolocationResult> {
  try {
    // Get IP from request headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0]?.trim() || realIP || '127.0.0.1';

    // Skip geolocation for localhost/private IPs - default to Chile for development
    if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.') || ip === '::1') {
      console.log('Local development detected, defaulting to Chile limits');
      return {
        country: 'Chile',
        countryCode: 'CL',
        isChile: true
      };
    }

    // Use ipapi.co for geolocation (free tier: 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'Restore Photos App'
      },
      // Set timeout to avoid hanging
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`Geolocation API error: ${response.status}`);
    }

    const data = await response.json();
    
    const country = data.country_name || 'Unknown';
    const countryCode = data.country_code || 'XX';
    const isChile = countryCode === 'CL';

    return { country, countryCode, isChile };
  } catch (error) {
    console.warn('Error getting user country:', error);
    
    // Fallback: assume non-Chile for stricter limits
    return {
      country: 'Unknown',
      countryCode: 'XX',
      isChile: false
    };
  }
}

/**
 * Get rate limit for a country
 */
function getRateLimit(isChile: boolean): number {
  return isChile ? 10 : 5; // 5 per day for Chile, 1 per day for others
}

/**
 * Check if it's a new day (reset period)
 */
function isNewDay(lastReset: Date): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const resetDay = new Date(lastReset.getFullYear(), lastReset.getMonth(), lastReset.getDate());
  
  return today.getTime() > resetDay.getTime();
}

/**
 * Get next reset time (midnight)
 */
function getNextResetTime(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Check rate limit for a given fingerprint
 */
export async function checkRateLimit(
  fingerprint: string,
  request: Request
): Promise<RateLimitResult> {
  try {
    // Get user's country
    const geoResult = await getUserCountry(request);
    const limit = getRateLimit(geoResult.isChile);
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(fingerprint);
    const now = new Date();
    
    if (!entry) {
      // First time user
      entry = {
        count: 0,
        lastReset: now,
        country: geoResult.country,
        lastAccess: now
      };
      rateLimitStore.set(fingerprint, entry);
    } else {
      // Update last access time
      entry.lastAccess = now;
      
      // Check if we need to reset the counter (new day)
      if (isNewDay(entry.lastReset)) {
        entry.count = 0;
        entry.lastReset = now;
        entry.country = geoResult.country; // Update country in case user traveled
      }
    }
    
    // Check if user has exceeded the limit
    const allowed = entry.count < limit;
    const remaining = Math.max(0, limit - entry.count);
    const resetTime = getNextResetTime();
    
    return {
      allowed,
      remaining,
      resetTime,
      country: entry.country,
      limit
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    
    // On error, allow the request but log it
    return {
      allowed: true,
      remaining: 1,
      resetTime: getNextResetTime(),
      country: 'Unknown',
      limit: 1
    };
  }
}

/**
 * Increment usage counter for a fingerprint
 */
export function incrementUsage(fingerprint: string): void {
  const entry = rateLimitStore.get(fingerprint);
  if (entry) {
    entry.count++;
    entry.lastAccess = new Date();
    rateLimitStore.set(fingerprint, entry);
  }
}

/**
 * Get current usage stats for a fingerprint
 */
export async function getUsageStats(
  fingerprint: string,
  request: Request
): Promise<RateLimitResult> {
  return await checkRateLimit(fingerprint, request);
}

/**
 * Reset usage for a fingerprint (for testing)
 */
export function resetUsage(fingerprint: string): void {
  rateLimitStore.delete(fingerprint);
}

/**
 * Get all stored fingerprints (for debugging)
 */
export function getStoredFingerprints(): Array<{ fingerprint: string; entry: RateLimitEntry }> {
  return Array.from(rateLimitStore.entries()).map(([fingerprint, entry]) => ({
    fingerprint,
    entry
  }));
}

/**
 * Clear all rate limit data (for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}
