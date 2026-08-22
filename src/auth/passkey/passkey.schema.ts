import { z } from "zod";

export const verifySchema = z.object({
  id: z.string(),
  rawId: z.string(),
  response: z.object({
    clientDataJSON: z.string(),
    attestationObject: z.string(),
  }),
  type: z.literal("public-key"),
  clientExtensionResults: z.record(z.string(), z.unknown()),
});

export const passkeyLoginSchema = z.object({
  email: z.email(),
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string(),
    }),
    type: z.literal("public-key"),
    clientExtensionResults: z.record(z.string(), z.unknown()),
  }),
});

export const passkeyOptionSchema = z.object({
  email: z.email(),
});

export type verifyPasskeySetupInput = z.infer<typeof verifySchema>;
export type passkeyLoginInput = z.infer<typeof passkeyLoginSchema>;
export type passkeyOptionInput = z.infer<typeof passkeyOptionSchema>;
