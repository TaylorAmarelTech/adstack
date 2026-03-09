import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

async function swaggerPluginFn(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AdStack API',
        description: 'AI-powered newsletter ad marketplace API',
        version: '0.1.0',
      },
      servers: [
        { url: 'http://localhost:3001', description: 'Development' },
      ],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Auth', description: 'Authentication' },
        { name: 'Publisher', description: 'Publisher management' },
        { name: 'Newsletter', description: 'Newsletter management' },
        { name: 'Campaign', description: 'Campaign management' },
        { name: 'Matching', description: 'Ad matching engine' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}

export const swaggerPlugin = fp(swaggerPluginFn, {
  name: 'swagger',
});
