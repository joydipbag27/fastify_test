import type { FastifyPluginAsync } from "fastify";
import { challengeSetup, passkeyLogin, passkeyOption, verifyChallenge } from "./passkey.controller.js";
import { authenticate } from "../../hooks/authenticate.js";
import type { verifyPasskeySetupInput } from "./passkey.schema.js";

const passkeyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/setup", { preHandler: authenticate }, challengeSetup);

  fastify.post<{ Body: verifyPasskeySetupInput }>(
    "/verify",
    { preHandler: authenticate },
    verifyChallenge,
  );

  fastify.post("/option", passkeyOption)

  fastify.post("/login", passkeyLogin)
};

export default passkeyRoutes;
