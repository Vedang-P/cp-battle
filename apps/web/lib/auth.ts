/**
 * NextAuth (credentials) configuration.
 *
 * Uses the Credentials provider against our Prisma users table. Sessions are
 * JWT-based (no session DB rows) which keeps the realtime server stateless.
 *
 * The JWT callback injects `userId` + `username` so the session object is
 * everything the rest of the app needs without a DB lookup per request.
 */

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@cp-battle/db';
import { env } from '@/lib/env';
import { verifyPassword } from '@/lib/password';
import { signinSchema } from '@/lib/schemas';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: env.authSecret,
  pages: { signIn: '/signin' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = signinSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.username,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.username = user.name ?? '';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.username = (token.username as string) ?? session.user.name ?? '';
      }
      return session;
    },
  },
};

// Types augmented in types/next-auth.d.ts
