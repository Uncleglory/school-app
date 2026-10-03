import type { NextAuthConfig } from "next-auth";

// Pages a student or parent is allowed to open
const RESTRICTED_ROLES = ["STUDENT", "PARENT"];
const RESTRICTED_ALLOWED_PREFIXES = [
  "/dashboard/materials",
  "/dashboard/notifications",
];

function isAllowedForRestricted(pathname: string) {
  return RESTRICTED_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Keep the role inside the login token so the gatekeeper can read it
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).role = token.role as any;
        (session.user as any).id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as any)?.role as string | undefined;
      const pathname = nextUrl.pathname;
      const isOnDashboard = pathname.startsWith("/dashboard");
      const isOnLogin = pathname.startsWith("/login");

      if (isOnDashboard) {
        if (!isLoggedIn) return false; // Redirect to login

        // Students and parents: Materials and Notifications only
        if (role && RESTRICTED_ROLES.includes(role)) {
          if (!isAllowedForRestricted(pathname)) {
            return Response.redirect(
              new URL("/dashboard/materials", nextUrl)
            );
          }
        }

        return true;
      }

      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
  providers: [], // Added later in auth.ts
} satisfies NextAuthConfig;
