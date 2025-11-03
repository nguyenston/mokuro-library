import { PrismaClient, Prisma } from '../generated/prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';

// Define the shape of the user data we'll attach to the request
export type AuthUser = {
  id: string;
  username: string;
  settings: Prisma.JsonValue;
};

// This declaration merges with Fastify's existing types
declare module 'fastify' {
  export interface FastifyInstance {
    prisma: PrismaClient;
    // Our custom authentication hook
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }

  export interface FastifyRequest {
    // This 'user' property will be populated by our 'authenticate' hook
    user: AuthUser;
  }
}
