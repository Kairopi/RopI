-- Phase 4: Learning Feedback Loop - Skill Tracking System
-- Migration: Create skill_levels and concept_stats tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Table: skill_levels
-- Tracks overall skill level per topic
-- =============================================
CREATE TABLE IF NOT EXISTS skill_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  
  -- Overall stats
  confidence INTEGER NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  quizzes_taken INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  total_answers INTEGER NOT NULL DEFAULT 0,
  accuracy FLOAT NOT NULL DEFAULT 0 CHECK (accuracy >= 0 AND accuracy <= 100),
  
  -- Concept-level tracking
  weak_spots TEXT[] DEFAULT '{}',    -- Concepts with <50% accuracy
  strong_spots TEXT[] DEFAULT '{}',  -- Concepts with >85% accuracy
  
  -- Temporal tracking
  last_quiz_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one skill level per user per topic
  UNIQUE(user_id, topic)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_skill_levels_user_id ON skill_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_levels_topic ON skill_levels(topic);
CREATE INDEX IF NOT EXISTS idx_skill_levels_confidence ON skill_levels(confidence DESC);

-- =============================================
-- Table: concept_stats
-- Tracks concept-level performance
-- =============================================
CREATE TABLE IF NOT EXISTS concept_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  concept TEXT NOT NULL,
  
  -- Stats
  attempts INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  accuracy FLOAT NOT NULL DEFAULT 0 CHECK (accuracy >= 0 AND accuracy <= 100),
  
  -- Temporal tracking
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one stat per user per topic per concept
  UNIQUE(user_id, topic, concept)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_concept_stats_user_id ON concept_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_concept_stats_topic ON concept_stats(topic);
CREATE INDEX IF NOT EXISTS idx_concept_stats_accuracy ON concept_stats(accuracy ASC);
CREATE INDEX IF NOT EXISTS idx_concept_stats_user_topic ON concept_stats(user_id, topic);

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS
ALTER TABLE skill_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_stats ENABLE ROW LEVEL SECURITY;

-- skill_levels policies
CREATE POLICY "Users can view own skill levels"
  ON skill_levels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skill levels"
  ON skill_levels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own skill levels"
  ON skill_levels FOR UPDATE
  USING (auth.uid() = user_id);

-- concept_stats policies
CREATE POLICY "Users can view own concept stats"
  ON concept_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own concept stats"
  ON concept_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own concept stats"
  ON concept_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE skill_levels IS 'Phase 4: Overall skill level tracking per topic with weak/strong spots';
COMMENT ON TABLE concept_stats IS 'Phase 4: Concept-level performance tracking for adaptive learning';

COMMENT ON COLUMN skill_levels.confidence IS 'Weighted confidence (recent 70% + historical 30%)';
COMMENT ON COLUMN skill_levels.weak_spots IS 'Array of concepts with <50% accuracy and ≥2 attempts';
COMMENT ON COLUMN skill_levels.strong_spots IS 'Array of concepts with >85% accuracy and ≥3 attempts';

COMMENT ON COLUMN concept_stats.accuracy IS 'Percentage accuracy for this specific concept';
