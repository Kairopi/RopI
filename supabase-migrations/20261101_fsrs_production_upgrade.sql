-- ============================================
-- FSRS Production Upgrade Migration
-- Meta Global AI Hackathon 2026
-- Date: November 1, 2026
-- ============================================
-- This migration upgrades the concept_cards table to production-grade FSRS
-- Based on research from AI University, Anki, and ts-fsrs documentation
-- ============================================

-- Step 1: Add new FSRS-specific columns to concept_cards
ALTER TABLE concept_cards 
  ADD COLUMN IF NOT EXISTS stability FLOAT DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS difficulty FLOAT DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS reps INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapses INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elapsed_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_review TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correct_answer_index INTEGER,
  ADD COLUMN IF NOT EXISTS source_lesson TEXT,
  ADD COLUMN IF NOT EXISTS source_quiz TEXT,
  ADD COLUMN IF NOT EXISTS revlogs JSONB[] DEFAULT '{}';

-- Step 2: Rename old column for clarity
ALTER TABLE concept_cards 
  RENAME COLUMN fsrs_state TO fsrs_card;

-- Step 3: Drop old difficulty column (was INTEGER, now FLOAT)
ALTER TABLE concept_cards 
  DROP COLUMN IF EXISTS difficulty;
  
ALTER TABLE concept_cards 
  ADD COLUMN IF NOT EXISTS difficulty FLOAT DEFAULT 0.3;

-- Step 4: Migrate existing data (extract FSRS parameters from JSONB)
UPDATE concept_cards 
SET 
  stability = COALESCE((fsrs_card->>'stability')::float, 1.0),
  difficulty = COALESCE((fsrs_card->>'difficulty')::float, 0.3),
  state = CASE 
    WHEN (fsrs_card->>'state')::int = 0 THEN 'new'
    WHEN (fsrs_card->>'state')::int = 1 THEN 'learning'
    WHEN (fsrs_card->>'state')::int = 2 THEN 'review'
    WHEN (fsrs_card->>'state')::int = 3 THEN 'relearning'
    ELSE 'new'
  END,
  reps = COALESCE((fsrs_card->>'reps')::int, 0),
  lapses = COALESCE((fsrs_card->>'lapses')::int, 0),
  elapsed_days = COALESCE((fsrs_card->>'elapsed_days')::int, 0),
  scheduled_days = COALESCE((fsrs_card->>'scheduled_days')::int, 0),
  last_review = CASE 
    WHEN fsrs_card->>'last_review' IS NOT NULL 
    THEN (fsrs_card->>'last_review')::timestamptz 
    ELSE NULL 
  END
WHERE fsrs_card IS NOT NULL;

-- Step 5: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_concept_cards_user_state 
  ON concept_cards(user_id, state);

CREATE INDEX IF NOT EXISTS idx_concept_cards_due_learning 
  ON concept_cards(user_id, due_date) 
  WHERE state IN ('learning', 'review', 'relearning');

CREATE INDEX IF NOT EXISTS idx_concept_cards_stability 
  ON concept_cards(user_id, stability DESC);

-- Step 6: Upgrade review_sessions table
ALTER TABLE review_sessions 
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS revlog JSONB,
  ADD COLUMN IF NOT EXISTS state_before TEXT,
  ADD COLUMN IF NOT EXISTS state_after TEXT,
  ADD COLUMN IF NOT EXISTS interval_days INTEGER,
  ADD COLUMN IF NOT EXISTS stability_before FLOAT,
  ADD COLUMN IF NOT EXISTS stability_after FLOAT,
  ADD COLUMN IF NOT EXISTS difficulty_before FLOAT,
  ADD COLUMN IF NOT EXISTS difficulty_after FLOAT;

CREATE INDEX IF NOT EXISTS idx_review_sessions_user_card 
  ON review_sessions(user_id, card_id, created_at DESC);

-- Step 7: Add check constraints for data integrity
ALTER TABLE concept_cards 
  ADD CONSTRAINT check_state_valid 
  CHECK (state IN ('new', 'learning', 'review', 'relearning'));

ALTER TABLE concept_cards 
  ADD CONSTRAINT check_stability_positive 
  CHECK (stability > 0);

ALTER TABLE concept_cards 
  ADD CONSTRAINT check_difficulty_range 
  CHECK (difficulty >= 0 AND difficulty <= 10);

ALTER TABLE review_sessions 
  ADD CONSTRAINT check_rating_valid 
  CHECK (rating IS NULL OR rating IN (0, 1, 2, 3));

-- Step 8: Add helpful comments
COMMENT ON COLUMN concept_cards.stability IS 'FSRS-7 stability parameter: days for retrievability to drop from 100% to 90%';
COMMENT ON COLUMN concept_cards.difficulty IS 'FSRS-7 difficulty parameter: inherent complexity (0-10)';
COMMENT ON COLUMN concept_cards.state IS 'Card state: new | learning | review | relearning';
COMMENT ON COLUMN concept_cards.reps IS 'Total number of reviews';
COMMENT ON COLUMN concept_cards.lapses IS 'Number of times card was forgotten (Again rating)';
COMMENT ON COLUMN concept_cards.revlogs IS 'Array of FSRS ReviewLog objects for optimization';
COMMENT ON COLUMN review_sessions.rating IS 'FSRS rating: 0=Again, 1=Hard, 2=Good, 3=Easy';
COMMENT ON COLUMN review_sessions.revlog IS 'FSRS ReviewLog for this review (for parameter optimization)';

-- ============================================
-- Migration Complete!
-- ============================================
-- New capabilities unlocked:
-- 1. Fast queries by card state
-- 2. Analytics on retention rates
-- 3. Review log storage for FSRS optimization
-- 4. Production-grade performance with indexes
-- ============================================
