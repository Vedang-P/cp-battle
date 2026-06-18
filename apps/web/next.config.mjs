/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages so Next handles their TS source directly.
  transpilePackages: [
    '@cp-battle/db',
    '@cp-battle/elo',
    '@cp-battle/judge',
    '@cp-battle/match',
    '@cp-battle/realtime',
  ],
  experimental: {
    // Monorepo-friendly: include workspace packages in server/native builds.
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'bullmq', 'ioredis'],
  },
};

export default nextConfig;
