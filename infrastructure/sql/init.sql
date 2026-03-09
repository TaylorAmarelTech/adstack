-- Initialize pgvector extension
-- This runs automatically on first container start via docker-entrypoint-initdb.d
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify pgvector is installed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'pgvector extension installed successfully';
  ELSE
    RAISE EXCEPTION 'pgvector extension failed to install';
  END IF;
END $$;
