import { type FastifyRequest, type FastifyReply, fastify } from "fastify";
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

  const start = performance.now();

  const sessionInfo = await db
    .selectFrom("sessions")
    .select(["id", "user_id", "expires_at"])
    .where("id", "=", sessionId)
    .executeTakeFirst();

  console.log("session query:", performance.now() - start);

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

  const userStart = performance.now();

  const userInfo = await db
    .selectFrom("users")
    .select("id")
    .where("id", "=", sessionInfo.user_id)
    .executeTakeFirst();

  console.log("user query:", performance.now() - userStart);

  if (!userInfo) {
    return reply.code(401).send({
      success: false,
      message: "Unauthorized",
    });
  }

  request.user = userInfo;
};
