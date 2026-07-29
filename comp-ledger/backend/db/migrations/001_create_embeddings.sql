CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
  id          SERIAL PRIMARY KEY,
  doc_id      TEXT NOT NULL,
  chunk_idx   INTEGER NOT NULL,
  corpus_type TEXT NOT NULL CHECK (corpus_type IN ('publisher', 'reference')),
  text        TEXT NOT NULL,
  embedding   vector(512) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (doc_id, chunk_idx, corpus_type)
);

CREATE INDEX idx_embeddings_cosine ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_embeddings_corpus ON embeddings (corpus_type);
