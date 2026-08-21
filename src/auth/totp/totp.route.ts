import { type TOTPLoginInput, type verifyTOTPInput } from "./totp.schema.js";
import type { FastifyPluginAsync } from "fastify";
import { authenticate } from "../../hooks/authenticate.js";
import { generateSetupUri, login, verifySetup } from "./totp.controller.js";

const totpRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/setup", { preHandler: authenticate }, generateSetupUri);

  fastify.post<{ Body: verifyTOTPInput }>(
    "/verify-setup",
    { preHandler: authenticate },
    verifySetup,
  );

  fastify.post<{ Body: TOTPLoginInput }>(
    "/login",
    login,
  );
};

export default totpRoutes;
