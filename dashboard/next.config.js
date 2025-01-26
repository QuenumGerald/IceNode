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
  }
}

module.exports = nextConfig;
