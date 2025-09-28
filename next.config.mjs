/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Increase body size limit for image uploads
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Turbopack configuration
    turbo: {
      // Set the workspace root to fix the multiple lockfiles warning
      root: '/Users/pabloschaffner/Documents/code/mini-webs/restore-photos',
      // Configure external packages for Turbopack
      resolveExtensions: [
        '.mdx',
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.mjs',
        '.json',
      ],
    },
  },
  // Handle sharp as an external package for proper Vercel deployment
  serverExternalPackages: ['sharp'],
  // Ensure sharp works correctly on Vercel
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize sharp to prevent bundling issues
      config.externals = [...(config.externals || []), 'sharp'];
    }
    return config;
  },
}

export default nextConfig;
