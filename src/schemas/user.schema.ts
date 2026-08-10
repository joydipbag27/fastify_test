import { z } from "zod";

export const createUserSchema = z.object({
  name: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z\s]+$/, "Name can only contain letters and spaces"), // Restricting users to use emoji
  email: z.email(),
  password: z
    .string()
    .min(6)
    .max(100)
    .regex(/^[A-Za-z\s]+$/, "Name can only contain letters and spaces"), // Restricting users to use emoji
});

export const createUserResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    created_at: z.date(),
  }),
});

export const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

export type CreateUserBody = z.infer<typeof createUserSchema>;
export type CreateUserResponseBody = z.infer<typeof createUserResponseSchema>;
