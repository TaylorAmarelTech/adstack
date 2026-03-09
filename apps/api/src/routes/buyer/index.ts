import type { FastifyInstance } from 'fastify';
import { profileRoutes } from './profile.js';
import { campaignRoutes } from './campaigns.js';
import { creativeRoutes } from './creatives.js';
import { statsRoutes } from './stats.js';

export async function buyerRoutes(app: FastifyInstance) {
  await app.register(profileRoutes, { prefix: '/profile' });
  await app.register(campaignRoutes, { prefix: '/campaigns' });
  await app.register(creativeRoutes, { prefix: '/campaigns/:campaignId/creatives' });
  await app.register(statsRoutes, { prefix: '/stats' });
}
