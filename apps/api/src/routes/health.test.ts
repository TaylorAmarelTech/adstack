import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../test/helpers.js';

describe('GET /api/v1/health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeDefined();
    expect(body.uptime).toBeTypeOf('number');
  });

  it('includes database status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    const body = res.json();
    expect(body.database).toBeDefined();
    expect(['connected', 'disconnected']).toContain(body.database);
  });
});
