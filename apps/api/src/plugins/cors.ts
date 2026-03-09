import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

async function corsPluginFn(app: FastifyInstance) {
  await app.register(cors, {
    origin: env.NODE_ENV === 'development' ? true : env.APP_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    maxAge: 86400, // 24 hours
  });
}

export const corsPlugin = fp(corsPluginFn, {
  name: 'cors',
});
