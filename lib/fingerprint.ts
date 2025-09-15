/**
 * Browser fingerprinting utility for anonymous user identification
 * Generates a unique fingerprint based on browser and device characteristics
 */

// Hash function for generating fingerprint
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get canvas fingerprint
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    canvas.width = 200;
    canvas.height = 50;
    
    // Draw some text and shapes for fingerprinting
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Fingerprint test 🔒', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Fingerprint test 🔒', 4, 17);

    return canvas.toDataURL();
  } catch (e) {
    return 'canvas-error';
  }
}

// Get WebGL fingerprint
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) return 'no-webgl';

    const renderer = gl.getParameter(gl.RENDERER);
    const vendor = gl.getParameter(gl.VENDOR);
    const version = gl.getParameter(gl.VERSION);
    const shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);

    return `${renderer}|${vendor}|${version}|${shadingLanguageVersion}`;
  } catch (e) {
    return 'webgl-error';
  }
}

// Get available fonts (simplified version)
function getFontFingerprint(): string {
  try {
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
      'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
      'Trebuchet MS', 'Arial Black', 'Impact'
    ];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-fonts';

    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    
    // Get baseline measurements
    const baselines: { [key: string]: number } = {};
    baseFonts.forEach(font => {
      ctx.font = `${testSize} ${font}`;
      baselines[font] = ctx.measureText(testString).width;
    });

    // Test each font
    const availableFonts: string[] = [];
    testFonts.forEach(font => {
      baseFonts.forEach(baseFont => {
        ctx.font = `${testSize} ${font}, ${baseFont}`;
        const width = ctx.measureText(testString).width;
        if (width !== baselines[baseFont]) {
          if (!availableFonts.includes(font)) {
            availableFonts.push(font);
          }
        }
      });
    });

    return availableFonts.sort().join(',');
  } catch (e) {
    return 'fonts-error';
  }
}

// Collect all fingerprint data
async function collectFingerprintData(): Promise<string> {
  const data = {
    // Screen characteristics
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight
    },
    
    // Browser characteristics
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    languages: navigator.languages?.join(',') || '',
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory || 0,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || '',
    
    // User agent (partial, to avoid too much uniqueness)
    userAgent: navigator.userAgent.substring(0, 100),
    
    // Canvas and WebGL fingerprints
    canvas: getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
    fonts: getFontFingerprint(),
    
    // Additional characteristics
    touchSupport: 'ontouchstart' in window,
    localStorage: typeof(Storage) !== 'undefined',
    sessionStorage: typeof(Storage) !== 'undefined',
    indexedDB: typeof(indexedDB) !== 'undefined'
  };

  return JSON.stringify(data);
}

// Generate browser fingerprint
export async function generateBrowserFingerprint(): Promise<string> {
  try {
    const fingerprintData = await collectFingerprintData();
    const hash = await hashString(fingerprintData);
    
    // Store in localStorage for consistency
    localStorage.setItem('browser_fingerprint', hash);
    
    return hash;
  } catch (error) {
    console.warn('Error generating fingerprint:', error);
    
    // Fallback to a simpler fingerprint
    const fallbackData = `${screen.width}x${screen.height}-${navigator.language}-${Date.now()}`;
    const fallbackHash = await hashString(fallbackData);
    localStorage.setItem('browser_fingerprint', fallbackHash);
    
    return fallbackHash;
  }
}

// Get existing fingerprint or generate new one
export async function getBrowserFingerprint(): Promise<string> {
  try {
    // Check if we already have a fingerprint stored
    const stored = localStorage.getItem('browser_fingerprint');
    if (stored && stored.length === 64) { // SHA-256 hash length
      return stored;
    }
    
    // Generate new fingerprint
    return await generateBrowserFingerprint();
  } catch (error) {
    console.warn('Error getting fingerprint:', error);
    
    // Ultimate fallback
    const fallback = `fallback-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('browser_fingerprint', fallback);
    return fallback;
  }
}

// Clear stored fingerprint (for testing)
export function clearStoredFingerprint(): void {
  localStorage.removeItem('browser_fingerprint');
}
