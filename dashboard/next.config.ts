/** @type {import('next').NextConfig} */

const nextConfig = {
  eslint: {
    // Désactiver la vérification ESLint pendant le build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Désactiver la vérification TypeScript pendant le build
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/:path*'
      }
    ]
  }
}

export default nextConfig;
