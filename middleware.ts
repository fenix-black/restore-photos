// Import middleware from the Edge Runtime-compatible entry point
import { createGrowthKitMiddleware } from '@fenixblack/growthkit/middleware';

export const middleware = createGrowthKitMiddleware({
  apiKey: process.env.GROWTHKIT_API_KEY!,
  apiUrl: process.env.GROWTHKIT_API_URL || 'https://growth.fenixblack.ai/api',
  referralPath: '/r',
  redirectTo: '/',
  debug: process.env.NODE_ENV === 'development'
});

export const config = {
  matcher: ['/r/:path*', '/verify', '/invite/:path*', '/api/growthkit/:path*']
};
