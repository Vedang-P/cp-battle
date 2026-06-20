const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Transpile workspace packages so Next handles their TS source directly.
  transpilePackages: [
    '@zapdos/db',
    '@zapdos/elo',
    '@zapdos/judge',
    '@zapdos/match',
    '@zapdos/realtime',
  ],
  experimental: {
    // Monorepo-friendly: include workspace packages in server/native builds.
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'bullmq', 'ioredis'],
  },
};

export default nextConfig;
