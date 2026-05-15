-- Required by @elizaos/plugin-sql before runtime migrations can create
-- the embeddings table with vector(...) columns.
CREATE EXTENSION IF NOT EXISTS vector;

-- Required by gen_random_uuid() on PostgreSQL versions/configurations where
-- it is not available by default.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
