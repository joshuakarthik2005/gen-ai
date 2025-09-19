/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize for production deployment
  poweredByHeader: false,
  reactStrictMode: true,
  // Fix workspace root detection
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
