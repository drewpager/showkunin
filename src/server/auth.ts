import { type GetServerSidePropsContext } from "next";
import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
  type Session,
} from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import "~/dotenv-config";
import { prisma } from "~/server/db";
import { PostHog } from "posthog-node";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      stripeSubscriptionStatus: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    stripeSubscriptionStatus: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    stripeSubscriptionStatus?: string;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.stripeSubscriptionStatus = user.stripeSubscriptionStatus;
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        stripeSubscriptionStatus: token.stripeSubscriptionStatus ?? "trialing",
        id: token.id,
      },
    }),
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(!!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(!!process.env.GITHUB_ID && !!process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("User not found or password incorrect");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValid) {
          throw new Error("User not found or password incorrect");
        }

        return {
           ...user,
           stripeSubscriptionStatus: user.stripeSubscriptionStatus ?? "trialing" // Provide default
        };
      },
    }),
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  events: {
    async signIn(message) {
      if (!!process.env.NEXT_PUBLIC_POSTHOG_KEY && !!process.env.NEXT_PUBLIC_POSTHOG_HOST) {
        const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        });

        client.capture({
          distinctId: message.user.id,
          event: "user logged in",
          properties: {
            provider: message.account?.provider,
            isNewUser: message.isNewUser,
          },
        });

        await client.shutdownAsync();
      }
    },
    async signOut(message) {
      if (!!process.env.NEXT_PUBLIC_POSTHOG_KEY && !!process.env.NEXT_PUBLIC_POSTHOG_HOST) {
        // Extract userId safely without 'any' to satisfy ESLint
        const session = message.session as Session | null;
        const token = message.token as { sub?: string; id?: string } | null;
        const userId = session?.user?.id || token?.sub || token?.id;
        
        if (!userId) return;

        const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        });

        client.capture({
          distinctId: userId,
          event: "user logged out",
        });

        await client.shutdownAsync();
      }
    },
  },
  pages: {
    signIn: "/sign-in",
  },
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext["req"];
  res: GetServerSidePropsContext["res"];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};
