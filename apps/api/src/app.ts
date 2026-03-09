import fastify, { type FastifyError } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import { corsPlugin } from './plugins/cors.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { dbPlugin } from './plugins/db.js';
import { authPlugin } from './plugins/auth.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { publisherRoutes } from './routes/publisher/index.js';
import { buyerRoutes } from './routes/buyer/index.js';
import { marketplaceRoutes } from './routes/marketplace/index.js';

export async function buildApp() {
  const app = fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    genReqId: () => crypto.randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // --- Plugins ---
  await app.register(corsPlugin);
  await app.register(swaggerPlugin);
  await app.register(dbPlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);

  // --- Routes ---
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(publisherRoutes, { prefix: '/api/v1/publisher' });
  await app.register(buyerRoutes, { prefix: '/api/v1/buyer' });
  await app.register(marketplaceRoutes, { prefix: '/api/v1/marketplace' });

  // --- Global error handler ---
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation,
        },
      });
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code ?? 'CLIENT_ERROR',
          message: error.message,
        },
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message:
          env.NODE_ENV === 'development'
            ? error.message
            : 'An unexpected error occurred',
      },
    });
  });

  return app;
}
