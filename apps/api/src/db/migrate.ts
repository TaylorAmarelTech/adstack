import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://adstack:adstack_dev@localhost:5433/adstack_dev';

async function main() {
  console.log('Running migrations...');

  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 1,
  });

  const db = drizzle(pool);

  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, 'migrations'),
  });

  console.log('Migrations completed successfully.');
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
