/**
 * NextAuth configuration with Credentials + Google OAuth.
 *
 * Uses PrismaAdapter for OAuth accounts and JWT sessions for the realtime server.
 * The JWT callback injects `userId` + `username` so the session object is
 * everything the rest of the app needs without a DB lookup per request.
 */

import type { NextAuthOptions } from 'next-auth';
import type { Provider } from 'next-auth/providers/index';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@zapdos/db';
import { env } from '@/lib/env';
import { verifyPassword } from '@/lib/password';
import { signinSchema } from '@/lib/schemas';

// PrismaAdapter needs a type assertion because @auth/prisma-adapter and next-auth
// have slightly different type definitions for the Adapter interface.
const adapter = PrismaAdapter(db) as NextAuthOptions['adapter'];

// Only register OAuth providers when their credentials are actually set —
// otherwise NextAuth renders a sign-in button that fails with an opaque error.
const providers: Provider[] = [];

if (env.googleClientId && env.googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  );
}

if (env.githubClientId && env.githubClientSecret) {
  providers.push(
    GitHubProvider({
      clientId: env.githubClientId,
      clientSecret: env.githubClientSecret,
    }),
  );
}

providers.push(
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

        // OAuth-only users don't have a password
        if (!user.passwordHash) return null;

        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.username,
          email: user.email,
        };
      },
    }),
);

export const authOptions: NextAuthOptions = {
  adapter,
  session: { strategy: 'jwt' },
  secret: env.authSecret,
  pages: { signIn: '/signin' },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth: link account to existing user or create new user
      if (account?.provider && account.provider !== 'credentials') {
        const email = user.email?.toLowerCase();
        if (!email) return false;

        // Check if user already exists
        const existingUser = await db.user.findUnique({
          where: { email },
          select: { id: true, passwordHash: true },
        });

        if (existingUser) {
          // Prevent OAuth from silently taking over a credentials account.
          // If the existing user has a password, they must sign in with it.
          if (existingUser.passwordHash) {
            return '/signin?error=OAuthEmailConflict';
          }
          // Link OAuth to existing OAuth-only account
          await db.account.upsert({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            update: {
              userId: existingUser.id,
            },
            create: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state,
            },
          });
          user.id = existingUser.id;
        } else {
          // Create new user from OAuth
          const username = email.split('@')[0] ?? email;
          // Ensure username is unique by appending random suffix if needed
          let finalUsername = username;
          const existing = await db.user.findUnique({ where: { username } });
          if (existing) {
            finalUsername = `${username}_${Math.random().toString(36).slice(2, 6)}`;
          }
          const newUser = await db.user.create({
            data: {
              email,
              username: finalUsername,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              passwordHash: null,
              onboardingComplete: false,
              accounts: {
                create: {
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  refresh_token: account.refresh_token,
                  access_token: account.access_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state,
                },
              },
            },
          });
          user.id = newUser.id;
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.username = user.name ?? '';
      }
      // Always refresh onboardingComplete from DB on every token refresh.
      // This ensures changes (like claim-handle) are reflected immediately.
      if (token.userId) {
        const dbUser = await db.user.findUnique({
          where: { id: token.userId as string },
          select: { id: true, username: true, onboardingComplete: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.username = dbUser.username;
          token.onboardingComplete = dbUser.onboardingComplete;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.username = (token.username as string) ?? session.user.name ?? '';
        session.user.onboardingComplete = token.onboardingComplete as boolean ?? true;
      }
      return session;
    },
  },
};

// Types augmented in types/next-auth.d.ts
