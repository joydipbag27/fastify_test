import fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import userRouter from "./routes/user.route.js";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import fastifyCookie from "@fastify/cookie";

const app = fastify({
  logger: true,
});

app.register(cors);
app.register(helmet);
app.register(fastifyCookie)

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(userRouter, { prefix: "/api/auth" });

export default app;
