import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";
import { LoginSchema } from "@/lib/schemas";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email: identifier, password } = parsed.data;
        const loginId = identifier.trim();

        let user: Awaited<ReturnType<typeof db.user.findUnique>> = null;

        if (loginId.includes("@")) {
          // Staff, parents, admins: log in with email
          user = await db.user.findUnique({
            where: { email: loginId.toLowerCase() },
          });
        } else {
          // Secondary students: log in with admission number
          const student = await db.student.findFirst({
            where: { admissionNo: { equals: loginId, mode: "insensitive" } },
            include: { user: true },
          });
          if (student?.user && student.user.role === "STUDENT") {
            user = student.user;
          }
        }

        if (!user || !user.isActive) return null;

        const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordsMatch) return null;

        // Update last login
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.role = token.role as any;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
