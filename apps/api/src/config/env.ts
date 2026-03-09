import { z } from 'zod';

/**
 * Environment variable validation using Zod.
 * Fails fast on startup if required variables are missing.
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:3001'),

  // Database
  DATABASE_URL: z
    .string()
    .default('postgresql://adstack:adstack_dev@localhost:5433/adstack_dev'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth
  SESSION_SECRET: z.string().min(32).default('dev-session-secret-change-in-production-min-32-chars'),
  COOKIE_DOMAIN: z.string().default('localhost'),

  // Stripe (optional for MVP)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // AI Services (optional for MVP)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32).default('dev-encryption-key-change-in-prod-32chars'),
});

// Load .env in development
if (process.env.NODE_ENV !== 'production') {
  const { config } = await import('dotenv');
  config();
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
