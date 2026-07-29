CREATE TABLE research_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id      UUID REFERENCES traces(id) ON DELETE CASCADE,
  publisher_id  UUID REFERENCES publishers(id) ON DELETE SET NULL,
  claim_text    TEXT NOT NULL,
  claim_idx     INTEGER NOT NULL,
  sources       JSONB NOT NULL DEFAULT '[]',
  judge_verdict JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_research_trace ON research_results (trace_id);
CREATE INDEX idx_research_publisher ON research_results (publisher_id);
