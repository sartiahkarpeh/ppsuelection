// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // expose the secret to the middleware
  env: {
    JWT_SECRET: process.env.JWT_SECRET
  },
  
}

module.exports = nextConfig

