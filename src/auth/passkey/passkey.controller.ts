import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/index.js";
import type {
  passkeyLoginInput,
  verifyPasskeySetupInput,
  passkeyOptionInput,
} from "./passkey.schema.js";
import { request } from "http";

type verifyChallengeRequest = FastifyRequest<{
  Body: verifyPasskeySetupInput;
}>;

type passkeyLoginRequest = FastifyRequest<{
  Body: passkeyLoginInput;
}>;

type passkeyOptionRequest = FastifyRequest<{
  Body: passkeyOptionInput;
}>;

export const challengeSetup = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const existingChallenge = await db
    .selectFrom("challenges")
    .select(["user_id", "id"])
    .where("user_id", "=", request.user.id)
    .executeTakeFirst();

  if (existingChallenge) {
    await db
      .deleteFrom("challenges")
      .where("id", "=", existingChallenge.id)
      .execute();
  }

  const challengePayload = await generateRegistrationOptions({
    rpID: "localhost",
    rpName: "test passkey auth",
    userName: request.user.name,
    userDisplayName: request.user.name,
  });

  await db
    .insertInto("challenges")
    .values({
      user_id: request.user.id,
      challenge: challengePayload.challenge,
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    })
    .execute();

  return reply.code(200).send({
    success: true,
    options: challengePayload,
  });
};

export const verifyChallenge = async (
  request: verifyChallengeRequest,
  reply: FastifyReply,
) => {
  const challengeInfo = await db
    .selectFrom("challenges")
    .selectAll()
    .where("user_id", "=", request.user.id)
    .executeTakeFirst();

  if (!challengeInfo) {
    return reply.code(404).send({
      success: false,
      message: "You don't have any challenges",
    });
  }

  if (challengeInfo.expires_at < new Date()) {
    return reply.code(400).send({
      success: false,
      message: "Challenge expired",
    });
  }

  const verification = await verifyRegistrationResponse({
    response: request.body,
    expectedChallenge: challengeInfo.challenge,
    expectedOrigin: "http://localhost:5173",
    expectedRPID: "localhost",
  });

  if (!verification.verified) {
    return reply.code(400).send({
      success: false,
      message: "Verification failed",
    });
  }

  await db
    .insertInto("passkeys")
    .values({
      user_id: request.user.id,
      credential_id: verification.registrationInfo.credential.id,
      public_key: Buffer.from(
        verification.registrationInfo.credential.publicKey,
      ).toString("base64"),
      counter: verification.registrationInfo.credential.counter,
    })
    .execute();

  await db
    .deleteFrom("challenges")
    .where("id", "=", challengeInfo.id)
    .execute();

  return reply.code(200).send({
    success: true,
    message: "Passkey added to your account",
  });
};

export const passkeyOption = async (
  request: passkeyOptionRequest,
  reply: FastifyReply,
) => {
  const userInfo = await db
    .selectFrom("users")
    .select("id")
    .where("email", "=", request.body.email)
    .executeTakeFirst();

  if (!userInfo) {
    return reply.code(404).send({
      success: false,
      message: "User not found",
    });
  }

  const existingChallenge = await db
    .selectFrom("challenges")
    .select(["user_id", "id"])
    .where("user_id", "=", userInfo.id)
    .executeTakeFirst();

  if (existingChallenge) {
    await db
      .deleteFrom("challenges")
      .where("id", "=", existingChallenge.id)
      .execute();
  }

  const userPasskeyInfo = await db
    .selectFrom("passkeys")
    .selectAll()
    .where("user_id", "=", userInfo.id)
    .executeTakeFirst();

  if (!userPasskeyInfo) {
    return reply.code(404).send({
      success: false,
      message: "User doesn't have a passkey",
    });
  }

  const challengePayload = await generateAuthenticationOptions({
    rpID: "localhost",
    allowCredentials: [
      {
        id: userPasskeyInfo.credential_id,
      },
    ],
  });

  await db
    .insertInto("challenges")
    .values({
      user_id: userInfo.id,
      challenge: challengePayload.challenge,
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
    })
    .execute();

  return reply.code(200).send({
    success: true,
    options: challengePayload,
  });
};

export const passkeyLogin = async (
  request: passkeyLoginRequest,
  reply: FastifyReply,
) => {
  const userInfo = await db
    .selectFrom("users as u")
    .innerJoin("passkeys as p", "p.user_id", "u.id")
    .innerJoin("challenges as c", "c.user_id", "u.id")
    .select([
      "u.id",
      "p.credential_id",
      "p.public_key",
      "p.counter",
      "c.id as challenge_id",
      "c.challenge",
      "c.expires_at",
    ])
    .where("u.email", "=", request.body.email)
    .executeTakeFirst();

  if (!userInfo) {
    return reply.code(404).send({
      success: false,
      message: "User not found",
    });
  }

  if (userInfo.expires_at < new Date()) {
    return reply.code(400).send({
      success: false,
      message: "Login challenge expired",
    });
  }

  const verification = await verifyAuthenticationResponse({
    response: request.body.credential,
    expectedChallenge: userInfo.challenge,
    expectedOrigin: "http://localhost:5173",
    expectedRPID: "localhost",
    credential: {
      id: userInfo.credential_id,
      publicKey: Buffer.from(userInfo.public_key, "base64"),
      counter: Number(userInfo.counter),
    },
  });

  if (!verification.verified) {
    return reply.code(401).send({
      success: false,
      message: "Wrong credentials",
    });
  }

  await db
    .updateTable("passkeys")
    .set({
      counter: verification.authenticationInfo.newCounter,
    })
    .where("credential_id", "=", userInfo.credential_id)
    .execute();

  await db
    .deleteFrom("challenges")
    .where("id", "=", userInfo.challenge_id)
    .execute();

  const existingSessions = await db
    .selectFrom("sessions")
    .select(["id", "created_at"])
    .where("user_id", "=", userInfo.id)
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
      user_id: userInfo.id,
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

  return reply.code(200).send({
    success: true,
    message: "User logged in successfully",
  });
};
