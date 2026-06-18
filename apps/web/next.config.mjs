/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
