import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../hooks/authenticate.js";

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/me", { preHandler: authenticate }, async (request) => {
    return {
      userId: request.user.id,
    };
  });
};

export default userRoutes;
