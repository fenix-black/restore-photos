/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Increase body size limit for image uploads
    serverActions: {
      bodySizeLimit: '50mb',
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
