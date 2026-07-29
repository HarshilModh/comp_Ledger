ALTER TABLE embeddings ADD COLUMN publisher_id UUID REFERENCES publishers(id) ON DELETE CASCADE;

CREATE INDEX idx_embeddings_publisher ON embeddings (publisher_id);
