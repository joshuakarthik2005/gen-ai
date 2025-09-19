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
};

module.exports = nextConfig;
