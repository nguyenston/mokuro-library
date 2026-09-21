import { Prisma } from '../generated/prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';
// Import the strategy interface
import { IAPIAccessStrategy } from '../lib/strategies/IAPIAccessStrategy';

export type AuthUser = {
  id: string;
  username: string;
  settings: Prisma.JsonValue;
};

declare module 'fastify' {
  export interface FastifyInstance {
    projectRoot: string;
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }

  export interface FastifyRequest {
    user: AuthUser;
    accessStrategy: IAPIAccessStrategy;
  }
}
