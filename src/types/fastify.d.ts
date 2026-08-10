import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      name: string;
      email: string;
      user_id: string;
      expires_at: Date;
    };
  }
}
