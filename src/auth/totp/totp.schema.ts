import { z } from "zod";

export const verifyTOTPSchema = z.object({
  code: z.coerce.string().length(6, { message: "OTP must be 6 digit" }),
});

export const TOTPLogin = z.object({
  code: z.coerce.string().length(6, { message: "OTP must be 6 digit" }),
  userId: z.uuid()
})

export type verifyTOTPInput = z.infer<typeof verifyTOTPSchema>;
export type TOTPLoginInput = z.infer<typeof TOTPLogin>
