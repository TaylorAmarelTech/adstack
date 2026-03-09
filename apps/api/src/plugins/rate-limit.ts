import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

async function rateLimitPluginFn(app: FastifyInstance) {
  // Skip rate limiting entirely in test environment
  if (env.NODE_ENV === 'test') {
    return;
  }

  // Global rate limit: 100 requests per minute
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Retry after ${context.after}`,
      },
    }),
  });

  // Stricter limit for auth routes: 10 requests per minute
  app.addHook('onRoute', (routeOptions) => {
    const url = routeOptions.url ?? '';
    if (url.endsWith('/register') || url.endsWith('/login')) {
      const existingConfig = routeOptions.config ?? {};
      routeOptions.config = {
        ...existingConfig,
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      };
    }
  });
}

export const rateLimitPlugin = fp(rateLimitPluginFn, {
  name: 'rate-limit',
});
