import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../hooks/authenticate.js";
import { email } from "zod";

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/me", { preHandler: authenticate }, async (request) => {

    return {
      userId: request.user.id,
      name: request.user.name,
      email: request.user.email
    };
  });
};

export default userRoutes;
