/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Increase body size limit for image uploads
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
}

export default nextConfig;
