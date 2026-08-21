import type { FastifyPluginAsync } from "fastify";
import passwordRoutes from "../auth/password/password.route.js";
import passkeyRoutes from "../auth/passkey/passkey.route.js";
import mobileRoutes from "../auth/mobile/mobile.route.js";
import totpRoutes from "../auth/totp/totp.route.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(passwordRoutes, {
    prefix: "/password",
  });

  fastify.register(totpRoutes, {
    prefix: "/totp",
  });

  fastify.register(passkeyRoutes, {
    prefix: "/passkey",
  });

  fastify.register(mobileRoutes, {
    prefix: "/mobile",
  });
};

export default authRoutes;
