import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/index.js";

export const authenticate = async (
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

  const sessionInfo = await db
    .selectFrom("sessions")
    .innerJoin("users", "users.id", "sessions.user_id")
    .select([
      "sessions.id",
      "sessions.user_id",
      "sessions.expires_at",
      "users.name",
      "users.email",
    ])
    .where("sessions.id", "=", sessionId)
    .executeTakeFirst();

  if (!sessionInfo) {
    return reply.code(401).send({
      success: false,
      message: "Unathorized",
    });
  }

  if (sessionInfo.expires_at < new Date()) {
    return reply.code(401).send({
      success: false,
      message: "Session expired",
    });
  }

  request.user = {
    id: sessionInfo.user_id,
    email: sessionInfo.email,
    name: sessionInfo.name,
  };
};
