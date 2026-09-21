import { FastifyInstance } from 'fastify';
import { IAPIAccessStrategy } from './IAPIAccessStrategy';
import { UserAPIAccessStrategy } from './UserAPIAccessStrategy';
import { AdminAPIAccessStrategy } from './AdminAPIAccessStrategy';

export class APIAccessStrategyFactory {
  static getStrategy(fastify: FastifyInstance, userId: string): IAPIAccessStrategy {
    if (userId === 'admin') {
      return new AdminAPIAccessStrategy(fastify);
    }
    return new UserAPIAccessStrategy(fastify, userId);
  }
}
