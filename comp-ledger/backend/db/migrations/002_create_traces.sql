CREATE TABLE traces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  mode        TEXT NOT NULL DEFAULT 'audit',
  claims      JSONB NOT NULL DEFAULT '[]',
  model_id    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_traces_created ON traces (created_at DESC);
