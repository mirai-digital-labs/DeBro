-- Initialize Universal Commerce Database
-- Ensure pgvector extension is enabled for AI Semantic Search
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Universal Commerce Database initialized with pgvector and uuid-ossp extensions.';
END $$;
