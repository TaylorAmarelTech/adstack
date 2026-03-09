import type { FastifyInstance } from 'fastify';
import { profileRoutes } from './profile.js';
import { newsletterRoutes } from './newsletters.js';
import { adSlotRoutes } from './ad-slots.js';

export async function publisherRoutes(app: FastifyInstance) {
  await app.register(profileRoutes, { prefix: '/profile' });
  await app.register(newsletterRoutes, { prefix: '/newsletters' });
  await app.register(adSlotRoutes, { prefix: '/newsletters/:newsletterId/slots' });
}
