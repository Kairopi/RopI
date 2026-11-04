-- ROPI: action receipts + source-grounded study material
-- Run once in Supabase: SQL Editor > New query > paste all > Run.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS). Creates 3 new tables, changes nothing else.
--
-- receipts       append-only log of things that really happened (OpenMuse "activity" pattern).
--                verification says HOW we know: system_recorded (Ropi did it / saw it),
--                self_reported (you told Ropi), external_confirmed (proof from outside).
-- sources        documents you uploaded (full text kept so quizzes can quote it)
-- source_chunks  ~300-word passages with a full-text index (Open Notebook-style chunking,
--                Postgres FTS instead of embeddings)

-- ===== receipts =====
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('plan', 'study', 'job')),
  kind TEXT NOT NULL,                       -- e.g. plan.replanned, study.quiz_completed, job.applied
  actor TEXT NOT NULL CHECK (actor IN ('user', 'ropi', 'muse')),
  verification TEXT NOT NULL CHECK (verification IN ('system_recorded', 'self_reported', 'external_confirmed')),
  outcome TEXT NOT NULL DEFAULT 'succeeded' CHECK (outcome IN ('succeeded', 'failed', 'outcome_unknown')),
  title TEXT NOT NULL,
  detail TEXT,
  subject_id TEXT,                          -- id of the quiz attempt / job / constraint it is about
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receipts_user_time ON receipts (user_id, occurred_at DESC);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
-- Append-only: you can add and read your own receipts, never edit or delete them
DROP POLICY IF EXISTS "receipts read own" ON receipts;
CREATE POLICY "receipts read own" ON receipts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "receipts insert own" ON receipts;
CREATE POLICY "receipts insert own" ON receipts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===== sources =====
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT,
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('pdf', 'docx', 'text')),
  page_count INT,
  char_count INT,
  content_hash TEXT NOT NULL,
  full_text TEXT NOT NULL,
  summary TEXT,                             -- one line, written by Meta Muse (Karakeep-style)
  tags TEXT[] NOT NULL DEFAULT '{}',        -- 3-5 topic tags, written by Meta Muse
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_hash)
);
ALTER TABLE sources ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sources own" ON sources;
CREATE POLICY "sources own" ON sources FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== source_chunks =====
CREATE TABLE IF NOT EXISTS source_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES sources ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  page INT,
  heading TEXT,
  content TEXT NOT NULL,
  tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(heading, '') || ' ' || content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS source_chunks_tsv ON source_chunks USING GIN (tsv);

ALTER TABLE source_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "source_chunks own" ON source_chunks;
CREATE POLICY "source_chunks own" ON source_chunks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Full-text search over your own chunks (runs as the caller, so RLS applies)
CREATE OR REPLACE FUNCTION search_chunks(q TEXT, p_source_id UUID DEFAULT NULL, k INT DEFAULT 8)
RETURNS TABLE (id UUID, source_id UUID, chunk_index INT, page INT, content TEXT, rank REAL)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT c.id, c.source_id, c.chunk_index, c.page, c.content,
         ts_rank_cd(c.tsv, websearch_to_tsquery('english', q)) AS rank
  FROM source_chunks c
  WHERE (p_source_id IS NULL OR c.source_id = p_source_id)
    AND c.tsv @@ websearch_to_tsquery('english', q)
  ORDER BY rank DESC
  LIMIT k
$$;

-- Review cards made from a document quiz keep the exact passage they came from
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS source_chunk_id UUID REFERENCES source_chunks ON DELETE SET NULL;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS source_quote TEXT;
