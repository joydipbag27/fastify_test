import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../db/index.js";
import bcrypt from "bcrypt";
import type { CreateUserInput, LoginInput } from "./password.schema.js";

type RegisterRequest = FastifyRequest<{
  Body: CreateUserInput;
}>;

type LoginRequest = FastifyRequest<{
  Body: LoginInput;
}>;

export const registerController = async (
  request: RegisterRequest,
  reply: FastifyReply,
) => {
  const name = request.body.name.trim();
  const email = request.body.email.trim().toLowerCase();

  const existingUser = await db
    .selectFrom("users")
    .select("id")
    .where("email", "=", email)
    .executeTakeFirst();

  if (existingUser) {
    return reply.code(409).send({
      success: false,
      message: "Email already exists",
    });
  }

  const password = request.body.password;
  const hashedPass = await bcrypt.hash(password, 10);

  const user = await db
    .insertInto("users")
    .values({
      name,
      email,
      password: hashedPass,
    })
    .returning(["id", "name", "email", "created_at"])
    .executeTakeFirst();

  if (!user) {
    throw new Error("Failed to create user");
  }

  reply.code(201);
  return {
    success: true,
    message: "hello world",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
    },
  };
};

export const loginController = async (
  request: LoginRequest,
  reply: FastifyReply,
) => {
  const email = request.body.email.trim().toLowerCase();
  const password = request.body.password;

  const userInfo = await db
    .selectFrom("users")
    .select(["email", "password", "id", "name"])
    .where("email", "=", email)
    .executeTakeFirst();

  if (!userInfo) {
    return reply.code(401).send({
      success: false,
      message: "Invalid email or password",
    });
  }

  const isAuthenticated = await bcrypt.compare(password, userInfo.password);

  if (!isAuthenticated) {
    return reply.code(401).send({
      success: false,
      message: "Invalid email or password",
    });
  }

  const totpInfo = await db
    .selectFrom("user_totps")
    .select(["user_id", "enabled"])
    .where("user_id", "=", userInfo.id)
    .executeTakeFirst();

  if (totpInfo?.enabled) {
    return reply.code(200).send({
      success: true,
      requiresTotp: true,
      userId: userInfo.id,
    });
  }

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

  return {
    success: true,
    message: "Login successful",
  };
};

export const logoutController = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const sessionId = request.cookies.sid;

  if (!sessionId) {
    return reply.code(401).send({
      success: false,
      message: "Unauthorized",
    });
  }

  await db.deleteFrom("sessions").where("id", "=", sessionId).execute();

  reply.clearCookie("sid", {
    path: "/",
  });

  return reply.code(200).send({
    success: true,
    message: "logout successful",
  });
};
