import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'pms-unityx.sgp1.cdn.digitaloceanspaces.com' },
      { protocol: 'https', hostname: 'pms-unityx.sgp1.digitaloceanspaces.com' },
      { protocol: 'https', hostname: 'sgp1.digitaloceanspaces.com' },
      { protocol: 'https', hostname: '*.digitaloceanspaces.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  },
}

export default nextConfig
