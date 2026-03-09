import type { FastifyInstance } from 'fastify';
import { discoverRoutes } from './discover.js';
import { matchRoutes } from './match.js';

export async function marketplaceRoutes(app: FastifyInstance) {
  await app.register(discoverRoutes, { prefix: '/discover' });
  await app.register(matchRoutes, { prefix: '/match' });
}
