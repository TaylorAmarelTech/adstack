import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        response: {
          200: z.object({
            status: z.literal('ok'),
            timestamp: z.string(),
            version: z.string(),
            uptime: z.number(),
            database: z.enum(['connected', 'disconnected']),
          }),
        },
      },
    },
    async (_request) => {
      let dbStatus: 'connected' | 'disconnected' = 'disconnected';

      try {
        await app.pool.query('SELECT 1');
        dbStatus = 'connected';
      } catch {
        _request.log.warn('Database health check failed');
      }

      return {
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        uptime: process.uptime(),
        database: dbStatus,
      };
    },
  );
}
