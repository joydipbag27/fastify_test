import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  createUserSchema,
  createUserResponseSchema,
  errorResponseSchema,
} from "../schemas/user.schema.js";
import { db } from "../db/index.js";
import bcrypt from "bcrypt"

const userRouter: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/register",
    {
      schema: {
        body: createUserSchema,
        response: {
          201: createUserResponseSchema,
          409: errorResponseSchema
        },
      },
    },
    async (request, reply) => {
    
      const email = request.body.email.trim().toLowerCase()


      const existingUser = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", email)
        .executeTakeFirst();

      if(existingUser){
        return reply.code(409).send({
          success: false,
          message: "Email already exists"
        })
      }

      const password = request.body.password
      const hashedPass = await bcrypt.hash(password, 10)

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
};

export default userRouter;
