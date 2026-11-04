-- ROPI: topic folders and saved conversations
-- Run once in Supabase: SQL Editor > New query > paste all > Run.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS). Creates 2 new tables, changes nothing else.
-- Until this runs, the app keeps folders and conversations in the browser instead.
--
-- topics         folders you study in ("Intro to project management") and their subtopics.
--                match_key ties a folder to the topic name your quizzes and documents already use,
--                so renaming a folder never breaks the link. links = things you or Ropi saved to it.
-- conversations  your talks with Ropi (voice or typed), one row per conversation, every turn timed.

-- ===== topics =====
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  parent_id UUID REFERENCES topics ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  match_key TEXT NOT NULL,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS topics_user_key ON topics (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), match_key);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "topics own" ON topics;
CREATE POLICY "topics own" ON topics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== conversations =====
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  topic_key TEXT,                              -- match_key of the folder it belongs to, if any
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'voice' CHECK (mode IN ('voice', 'text')),
  turns JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{ role: 'you' | 'ropi', text, at, kind?, sources? }]
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_user_time ON conversations (user_id, started_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations own" ON conversations;
CREATE POLICY "conversations own" ON conversations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
