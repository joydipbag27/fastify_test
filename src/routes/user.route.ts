import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createUserSchema,
  createUserResponseSchema,
  errorResponseSchema,
  loginSchema,
  loginResponseSchema,
  successResponseSchema,
} from "../schemas/user.schema.js";
import { db } from "../db/index.js";
import bcrypt from "bcrypt";
import { authenticate } from "../hooks/authenticate.js";

const userRouter: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/register",
    {
      schema: {
        body: createUserSchema,
        response: {
          201: createUserResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();

      const existingUser = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", email)
        .executeTakeFirst();

      if (existingUser) {
        return reply.code(409).send({
          success: false,
          message: "Email already exists",
        });
      }

      const password = request.body.password;
      const hashedPass = await bcrypt.hash(password, 10);

      const user = await db
        .insertInto("users")
        .values({
          name: request.body.name,
          email: request.body.email,
          password: hashedPass,
        })
        .returning(["id", "name", "email", "created_at"])
        .executeTakeFirst();

      if (!user) {
        throw new Error("Failed to create user");
      }

      reply.code(201);
      return {
        success: true,
        message: "hello world",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at,
        },
      };
    },
  );

  app.post(
    "/login",
    {
      schema: {
        body: loginSchema,
        response: {
          200: loginResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      const password = request.body.password;

      const userInfo = await db
        .selectFrom("users")
        .select(["email", "password", "id", "name"])
        .where("email", "=", email)
        .executeTakeFirst();

      if (!userInfo) {
        return reply.code(401).send({
          success: false,
          message: "Invalid email or password",
        });
      }

      const isAuthenticated = await bcrypt.compare(password, userInfo.password);

      if (!isAuthenticated) {
        return reply.code(401).send({
          success: false,
          message: "Invalid email or password",
        });
      }

      const existingSessions = await db
        .selectFrom("sessions")
        .select(["id", "created_at"])
        .where("user_id", "=", userInfo.id)
        .orderBy("created_at", "asc")
        .execute();

      if (existingSessions.length > 1) {
        const oldestSession = existingSessions[0];

        if (oldestSession) {
          await db
            .deleteFrom("sessions")
            .where("id", "=", oldestSession.id)
            .execute();
        }
      }

      const sessionInfo = await db
        .insertInto("sessions")
        .values({
          user_id: userInfo.id,
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        })
        .returning("id")
        .executeTakeFirst();

      if (!sessionInfo) {
        return reply.code(500).send({
          success: false,
          message: "Server failed to create session",
        });
      }

      reply.setCookie("sid", sessionInfo.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });

      return {
        success: true,
        message: "Login successful",
        data: {
          name: userInfo.name,
          email: userInfo.email,
          user_id: userInfo.id,
        },
      };
    },
  );

  app.get(
    "/me",
    {
      preHandler: authenticate,
    },
    async (request) => {
      return {
        userId: request.user.id,
      };
    },
  );

  app.post(
    "/logout",
    {
      schema: {
        response: {
          200: successResponseSchema,
          401: errorResponseSchema,
        },
      },
      preHandler: authenticate,
    },

    async (request, reply) => {
      const sessionId = request.cookies.sid;

      if (!sessionId) {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized",
        });
      }

      await db.deleteFrom("sessions").where("id", "=", sessionId).execute();

      reply.clearCookie("sid", {
        path: "/",
      });

      return reply.code(200).send({
        success: true,
        message: "logout successful",
      });
    },
  );
};

export default userRouter;
