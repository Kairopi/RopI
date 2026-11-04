-- ROPI: bring the live database in line with the app code (Nov 3, 2026)
--
-- Found by probing the live project with a signed-in user:
--   * concept_cards / review_sessions were created from an older schema and
--     are missing every FSRS column, so review cards could never be saved
--   * study_guides / flashcards do not exist (Learning Hub could never save)
--   * replan_log rejects inserts (RLS on, no usable policy)
--
-- Safe to run more than once: only ADDs missing columns/tables/policies.
-- Never drops or rewrites existing data.

-- =============================================
-- 1. concept_cards: FSRS columns
-- =============================================
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS correct_answer_index INTEGER;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS stability FLOAT DEFAULT 1.0;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS difficulty FLOAT DEFAULT 0.3;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'new';
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS reps INTEGER DEFAULT 0;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS lapses INTEGER DEFAULT 0;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS elapsed_days INTEGER DEFAULT 0;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS scheduled_days INTEGER DEFAULT 0;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS last_review TIMESTAMPTZ;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS fsrs_card JSONB;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS revlogs JSONB[] DEFAULT '{}';
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS source_document TEXT;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS source_lesson TEXT;
ALTER TABLE concept_cards ADD COLUMN IF NOT EXISTS source_quiz TEXT;

-- =============================================
-- 2. review_sessions: FSRS review log columns
-- =============================================
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS revlog JSONB;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS state_before TEXT;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS state_after TEXT;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS interval_days INTEGER;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS stability_before FLOAT;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS stability_after FLOAT;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS difficulty_before FLOAT;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS difficulty_after FLOAT;
ALTER TABLE review_sessions ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_concept_cards_user_due ON concept_cards(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_concept_cards_user_state ON concept_cards(user_id, state);
CREATE INDEX IF NOT EXISTS idx_review_sessions_user_created ON review_sessions(user_id, created_at DESC);

-- =============================================
-- 3. study_guides + flashcards (Learning Hub)
-- =============================================
CREATE TABLE IF NOT EXISTS study_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  key_points TEXT[],
  prerequisites TEXT[],
  learning_objectives TEXT[],
  difficulty TEXT,
  estimated_study_time_minutes INTEGER,
  source_documents TEXT[],
  source_type TEXT DEFAULT 'upload',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_guide_id UUID REFERENCES study_guides(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  topic TEXT NOT NULL,
  tags TEXT[],
  difficulty TEXT,
  position INTEGER,
  stability FLOAT DEFAULT 1.0,
  difficulty_score FLOAT DEFAULT 0.3,
  state TEXT DEFAULT 'new',
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  fsrs_card JSONB,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_guides_user ON study_guides(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_study_guide ON flashcards(study_guide_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_next_review ON flashcards(user_id, next_review_at);

-- =============================================
-- 4. Row Level Security: each user sees only their own rows
-- =============================================
ALTER TABLE study_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE replan_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access own data" ON study_guides;
CREATE POLICY "Users can access own data" ON study_guides
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access own data" ON flashcards;
CREATE POLICY "Users can access own data" ON flashcards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access own data" ON concept_cards;
CREATE POLICY "Users can access own data" ON concept_cards
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access own data" ON review_sessions;
CREATE POLICY "Users can access own data" ON review_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access own data" ON replan_log;
CREATE POLICY "Users can access own data" ON replan_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can access own data" ON quiz_attempts;
CREATE POLICY "Users can access own data" ON quiz_attempts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own skill levels" ON skill_levels;
CREATE POLICY "Users can delete own skill levels" ON skill_levels
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own concept stats" ON concept_stats;
CREATE POLICY "Users can delete own concept stats" ON concept_stats
  FOR DELETE USING (auth.uid() = user_id);

-- Make the API see the new columns/tables immediately
NOTIFY pgrst, 'reload schema';
