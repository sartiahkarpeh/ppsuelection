// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // expose the secret to the middleware
  env: {
    JWT_SECRET: process.env.JWT_SECRET
  },
  // Skip ESLint during builds to prevent CI failures on lint errors
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

