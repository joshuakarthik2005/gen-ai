/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  experimental: {
    outputFileTracingIncludes: {
      '/': ['./public/**/*'],
    }
  }
};

module.exports = nextConfig;
