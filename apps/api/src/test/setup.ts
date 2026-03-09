/**
 * Vitest global test setup.
 *
 * - Loads environment variables from .env (dotenv is a devDependency).
 * - Sets NODE_ENV=test so that env.ts picks it up.
 * - Increases the default test timeout for DB-backed integration tests.
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

// Ensure NODE_ENV is "test" before env.ts parses process.env
process.env.NODE_ENV = 'test';

// Load .env from the api package root (if present)
config({ path: resolve(import.meta.dirname, '../../.env') });
