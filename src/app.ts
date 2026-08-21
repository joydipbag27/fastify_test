import fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import fastifyCookie from "@fastify/cookie";
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";

const app = fastify({
  logger: true,
});

app.register(cors, {
  origin: true,
  credentials: true,
});
app.register(helmet);
app.register(fastifyCookie)

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(authRoutes, {prefix: "/api/auth"})
app.register(userRoutes, {prefix: "/api/user"})

export default app;
