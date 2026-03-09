import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';
import * as schema from '../db/schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

// Extend Fastify's type system to include `db` on the app instance
declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    pool: pg.Pool;
  }
}

async function dbPluginFn(app: FastifyInstance) {
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Verify connection on startup
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now, version() as version');
    app.log.info(
      `Database connected: ${result.rows[0]?.version?.split(',')[0]}`,
    );
    client.release();
  } catch (err) {
    app.log.error('Failed to connect to database');
    throw err;
  }

  const db = drizzle(pool, { schema });

  // Decorate app with db instance
  app.decorate('db', db);
  app.decorate('pool', pool);

  // Close pool on shutdown
  app.addHook('onClose', async () => {
    app.log.info('Closing database pool...');
    await pool.end();
  });
}

export const dbPlugin = fp(dbPluginFn, {
  name: 'db',
});
