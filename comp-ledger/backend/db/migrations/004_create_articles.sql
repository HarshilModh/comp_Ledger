CREATE TABLE articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id  UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  url           TEXT,
  slug          TEXT NOT NULL,
  body_text     TEXT NOT NULL,
  byline        TEXT,
  published_at  TIMESTAMPTZ,
  ingested_at   TIMESTAMPTZ DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'processing')),
  UNIQUE (publisher_id, slug)
);

CREATE INDEX idx_articles_publisher ON articles (publisher_id);
CREATE INDEX idx_articles_status ON articles (publisher_id, status);
