import type { verifyTOTPInput, TOTPLoginInput } from "./totp.schema.js";
import { generateSecret, verify, generateURI } from "otplib";
import { db } from "../../db/index.js";
import type { FastifyReply, FastifyRequest } from "fastify";

type verifyTOTPRequest = FastifyRequest<{
  Body: verifyTOTPInput;
}>;
type TOTPLoginRequest = FastifyRequest<{
  Body: TOTPLoginInput;
}>;

export const generateSetupUri = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const existingTotp = await db
    .selectFrom("user_totps")
    .select(["id", "enabled"])
    .where("user_id", "=", request.user.id)
    .executeTakeFirst();

  if (existingTotp && existingTotp.enabled) {
    return reply.code(409).send({
      success: false,
      message: "TOTP already enabled",
    });
  }

  const secret = generateSecret();

  const uri = generateURI({
    issuer: "MultiAuth-Test",
    label: request.user.email,
    secret,
  });

  if (existingTotp && !existingTotp.enabled) {
    await db
      .updateTable("user_totps")
      .set({
        secret,
      })
      .where("user_id", "=", request.user.id)
      .where("id", "=", existingTotp.id)
      .execute();

    reply.code(201);
    return {
      success: true,
      message: "TOTP setup initiated",
      data: {
        uri,
      },
    };
  }

  const totp = await db
    .insertInto("user_totps")
    .values({
      user_id: request.user.id,
      secret,
      enabled: false,
      verified_at: null,
    })
    .returning("id")
    .executeTakeFirst();

  if (!totp) {
    throw new Error("Failed to create Temporary OTP");
  }

  reply.code(201);
  return {
    success: true,
    message: "TOTP setup initiated",
    data: {
      uri,
    },
  };
};

export const verifySetup = async (
  request: verifyTOTPRequest,
  reply: FastifyReply,
) => {
  const verificationCode = request.body.code;

  const userTOTPInfo = await db
    .selectFrom("user_totps")
    .select(["id", "secret", "enabled"])
    .where("user_id", "=", request.user.id)
    .executeTakeFirst();

  if (!userTOTPInfo) {
    return reply.code(404).send({
      success: false,
      message: "TOTP setup not found",
    });
  }

  if (userTOTPInfo.enabled) {
    return reply.code(400).send({
      success: false,
      message: "TOTP setup already done",
    });
  }

  const result = await verify({
    secret: userTOTPInfo.secret,
    token: verificationCode,
  });

  if (!result.valid) {
    return reply.code(401).send({
      success: false,
      message: "Invalid TOTP code",
    });
  }

  await db
    .updateTable("user_totps")
    .set({
      enabled: true,
      verified_at: new Date(),
    })
    .where("user_id", "=", request.user.id)
    .where("id", "=", userTOTPInfo.id)
    .execute();

  return {
    success: true,
    message: "TOTP enabled successfully",
  };
};

export const login = async (request: TOTPLoginRequest, reply: FastifyReply) => {
  const verificationCode = request.body.code;
  const userId = request.body.userId;

  const totpInfo = await db
    .selectFrom("user_totps")
    .select(["secret", "enabled"])
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!totpInfo || !totpInfo.enabled) {
    return reply.code(404).send({
      success: false,
      message: "TOTP is not enabled",
    });
  }

  const result = await verify({
    secret: totpInfo.secret,
    token: verificationCode,
  });

  if (!result.valid) {
    return reply.code(401).send({
      success: false,
      message: "Invalid TOTP code",
    });
  }

  const existingSessions = await db
    .selectFrom("sessions")
    .select(["id", "created_at"])
    .where("user_id", "=", userId)
    .orderBy("created_at", "asc")
    .execute();

  if (existingSessions.length >= 2) {
    const oldestSession = existingSessions[0];

    if (oldestSession) {
      await db
        .deleteFrom("sessions")
        .where("id", "=", oldestSession.id)
        .execute();
    }
  }

  const sessionInfo = await db
    .insertInto("sessions")
    .values({
      user_id: userId,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    })
    .returning("id")
    .executeTakeFirst();

  if (!sessionInfo) {
    return reply.code(500).send({
      success: false,
      message: "Server failed to create session",
    });
  }

  reply.setCookie("sid", sessionInfo.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return {
    success: true,
    message: "Login successful",
  };
};
