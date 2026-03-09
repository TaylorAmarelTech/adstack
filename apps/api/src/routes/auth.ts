import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { authSchemas } from '@adstack/shared';
import { publishers, advertisers } from '../db/schema/index.js';
import { setAuthCookie, clearAuthCookie } from '../plugins/auth.js';

export async function authRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------------
  // POST /register
  // -----------------------------------------------------------------------
  app.post(
    '/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new account',
        body: authSchemas.registerRequest,
      },
    },
    async (request, reply) => {
      const { email, password, name, companyName, role } = request.body as z.infer<
        typeof authSchemas.registerRequest
      >;

      // Check for duplicate email across both tables
      const existingPublisher = await app.db.query.publishers.findFirst({
        where: eq(publishers.email, email),
        columns: { id: true },
      });

      if (existingPublisher) {
        return reply.status(409).send({
          success: false as const,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'An account with this email already exists',
          },
        });
      }

      const existingAdvertiser = await app.db.query.advertisers.findFirst({
        where: eq(advertisers.email, email),
        columns: { id: true },
      });

      if (existingAdvertiser) {
        return reply.status(409).send({
          success: false as const,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'An account with this email already exists',
          },
        });
      }

      // Hash password
      const passwordHash = await argon2.hash(password);

      if (role === 'publisher') {
        const [inserted] = await app.db
          .insert(publishers)
          .values({
            email,
            name,
            companyName: companyName ?? null,
            passwordHash,
          })
          .returning({ id: publishers.id, email: publishers.email, name: publishers.name });

        return reply.status(201).send({
          success: true as const,
          data: {
            id: inserted!.id,
            email: inserted!.email,
            name: inserted!.name,
            role: 'publisher' as const,
          },
        });
      }

      // role === 'advertiser'
      const [inserted] = await app.db
        .insert(advertisers)
        .values({
          email,
          name,
          companyName: companyName ?? '',
          passwordHash,
        })
        .returning({ id: advertisers.id, email: advertisers.email, name: advertisers.name });

      return reply.status(201).send({
        success: true as const,
        data: {
          id: inserted!.id,
          email: inserted!.email,
          name: inserted!.name,
          role: 'advertiser' as const,
        },
      });
    },
  );

  // -----------------------------------------------------------------------
  // POST /login
  // -----------------------------------------------------------------------
  app.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Log in to an existing account',
        body: authSchemas.loginRequest,
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as z.infer<typeof authSchemas.loginRequest>;

      // Try publishers first
      const publisher = await app.db.query.publishers.findFirst({
        where: eq(publishers.email, email),
        columns: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          plan: true,
        },
      });

      if (publisher) {
        const validPassword = await argon2.verify(publisher.passwordHash, password);
        if (!validPassword) {
          return reply.status(401).send({
            success: false as const,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password',
            },
          });
        }

        const user = {
          id: publisher.id,
          email: publisher.email,
          name: publisher.name,
          role: 'publisher' as const,
          plan: publisher.plan,
        };

        setAuthCookie(reply, { id: user.id, email: user.email, role: user.role });

        return {
          success: true as const,
          data: { user },
        };
      }

      // Try advertisers
      const advertiser = await app.db.query.advertisers.findFirst({
        where: eq(advertisers.email, email),
        columns: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
        },
      });

      if (advertiser) {
        const validPassword = await argon2.verify(advertiser.passwordHash, password);
        if (!validPassword) {
          return reply.status(401).send({
            success: false as const,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password',
            },
          });
        }

        const user = {
          id: advertiser.id,
          email: advertiser.email,
          name: advertiser.name,
          role: 'advertiser' as const,
        };

        setAuthCookie(reply, { id: user.id, email: user.email, role: user.role });

        return {
          success: true as const,
          data: { user },
        };
      }

      // No user found
      return reply.status(401).send({
        success: false as const,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    },
  );

  // -----------------------------------------------------------------------
  // GET /me
  // -----------------------------------------------------------------------
  app.get(
    '/me',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Get current authenticated user',
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const sessionUser = request.user!;

      // Hydrate user from database to get latest name / plan
      if (sessionUser.role === 'publisher') {
        const publisher = await app.db.query.publishers.findFirst({
          where: eq(publishers.id, sessionUser.id),
          columns: { id: true, email: true, name: true, plan: true },
        });

        if (!publisher) {
          return reply.status(401).send({
            success: false as const,
            error: { code: 'UNAUTHORIZED', message: 'User no longer exists' },
          });
        }

        return {
          success: true as const,
          data: {
            user: {
              id: publisher.id,
              email: publisher.email,
              name: publisher.name,
              role: 'publisher' as const,
              plan: publisher.plan,
            },
          },
        };
      }

      if (sessionUser.role === 'advertiser') {
        const advertiser = await app.db.query.advertisers.findFirst({
          where: eq(advertisers.id, sessionUser.id),
          columns: { id: true, email: true, name: true },
        });

        if (!advertiser) {
          return reply.status(401).send({
            success: false as const,
            error: { code: 'UNAUTHORIZED', message: 'User no longer exists' },
          });
        }

        return {
          success: true as const,
          data: {
            user: {
              id: advertiser.id,
              email: advertiser.email,
              name: advertiser.name,
              role: 'advertiser' as const,
            },
          },
        };
      }

      // Admin or unknown role: return what we have from the JWT
      return {
        success: true as const,
        data: {
          user: {
            id: sessionUser.id,
            email: sessionUser.email,
            name: sessionUser.name,
            role: sessionUser.role,
          },
        },
      };
    },
  );

  // -----------------------------------------------------------------------
  // POST /logout
  // -----------------------------------------------------------------------
  app.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Log out and clear session',
      },
    },
    async (_request, reply) => {
      clearAuthCookie(reply);

      return {
        success: true as const,
        data: { message: 'Logged out' },
      };
    },
  );
}
