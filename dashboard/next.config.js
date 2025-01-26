/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone',
  eslint: {
    // Désactiver la vérification ESLint pendant le build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Désactiver la vérification TypeScript pendant le build
    ignoreBuildErrors: true,
  },
  env: {
    PORT: process.env.PORT || 8080
  },
  experimental: {
    optimizeCss: false // Désactivons cette option qui cause des problèmes
  }
}

module.exports = nextConfig;
