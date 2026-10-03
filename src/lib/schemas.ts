import { z } from "zod";

// "email" now accepts either an email address (staff, parents)
// or an admission number (secondary students)
export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3, "Please enter your email or admission number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
