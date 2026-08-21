import type { FastifyPluginAsync } from "fastify";
import { createUserSchema, loginSchema } from "../password/password.schema.js";
import { authenticate } from "../../hooks/authenticate.js";
import {
  loginController,
  logoutController,
  registerController,
} from "./password.controller.js";

const passwordRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/register",
    {
      schema: {
        body: createUserSchema,
      },
    },
    registerController,
  );

  fastify.post(
    "/login",
    {
      schema: {
        body: loginSchema,
      },
    },
    loginController,
  );

  fastify.post(
    "/logout",
    {
      preHandler: authenticate,
    },

    logoutController,
  );
};

export default passwordRoutes;
