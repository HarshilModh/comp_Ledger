CREATE TABLE publishers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  publication  TEXT NOT NULL,
  domain       TEXT NOT NULL UNIQUE,
  alt_domains  TEXT[] DEFAULT '{}',
  rss_url      TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_publishers_domain ON publishers (domain);
CREATE INDEX idx_publishers_status ON publishers (status);
