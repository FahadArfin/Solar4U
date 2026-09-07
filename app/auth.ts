import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigured
    ? [Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      })]
    : [],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/signin" },
  callbacks: {
    authorized: async () => true,
    jwt: async ({ token, profile }) => {
      if (profile?.sub) token.googleSubject = profile.sub;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = String(token.sub || token.googleSubject || "");
        session.user.role = "member";
      }
      return session;
    },
  },
});
