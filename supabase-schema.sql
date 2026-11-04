-- ROPI DATABASE SCHEMA
-- Meta Global AI Hackathon 2026
-- 24 Tables for Complete System

-- ============================================
-- ENABLE EXTENSIONS
-- ============================================
-- Note: pgvector extension is optional, comment out if not available
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- USER CONTEXT
-- ============================================
CREATE TABLE IF NOT EXISTS user_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  goals JSONB DEFAULT '{}',
  constraints JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  target_job_title TEXT,
  target_exam TEXT,
  work_schedule JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SCHEDULING (6 tables)
-- ============================================
CREATE TABLE IF NOT EXISTS time_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  task_id UUID,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  block_type TEXT, -- 'study', 'work', 'break', 'job_search'
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'skipped'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  day_of_week INTEGER, -- 0 = Sunday, 6 = Saturday
  start_time TIME,
  end_time TIME,
  window_type TEXT, -- 'available', 'work', 'blocked'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  event_type TEXT, -- 'work', 'interview', 'exam', 'personal'
  source TEXT, -- 'manual', 'google_calendar', 'outlook'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS replan_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  trigger TEXT, -- "Manager added shift, only 20min tonight"
  before_schedule JSONB,
  after_schedule JSONB,
  duration_ms INTEGER,
  changes_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduling_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  conflict_type TEXT, -- 'overlap', 'deadline_at_risk', 'overload'
  description TEXT,
  resolution TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JOB APPLICATIONS (5 tables)
-- ============================================
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- Job Details
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  job_url TEXT,
  description TEXT,
  requirements TEXT,
  
  -- Matching
  match_score INTEGER, -- 0-100
  ats_score INTEGER, -- 0-100
  match_reasons TEXT[],
  
  -- Application Status
  status TEXT DEFAULT 'discovered', -- discovered, reviewed, approved, applied, interview, offer, rejected
  applied_at TIMESTAMPTZ,
  interview_date TIMESTAMPTZ,
  outcome TEXT,
  
  -- Tracking
  source TEXT, -- 'linkedin', 'indeed', 'company_watchlist'
  deadline TIMESTAMPTZ,
  notes TEXT,
  
  -- Evidence
  confirmation_id TEXT,
  evidence_screenshot TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  version TEXT NOT NULL, -- 'base', 'monzo-pm-v1', 'aws-engineer-v2'
  content JSONB, -- structured resume data
  file_url TEXT,
  tailored_for UUID REFERENCES job_applications,
  is_base BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cover_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  job_application_id UUID REFERENCES job_applications,
  content TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recruiters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  notes TEXT,
  last_contact TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  company TEXT NOT NULL,
  careers_url TEXT,
  ats_url TEXT,
  last_checked TIMESTAMPTZ,
  new_jobs_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEARNING (6 tables) - Updated for Phase 3
-- ============================================

-- Study Guides (generated from documents/questions)
CREATE TABLE IF NOT EXISTS study_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT, -- AI-generated 300-500 word summary
  key_points TEXT[], -- Array of key concepts
  prerequisites TEXT[], -- What to know first
  learning_objectives TEXT[], -- What you'll learn
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_study_time_minutes INTEGER,
  source_documents TEXT[], -- File names or URLs
  source_type TEXT DEFAULT 'upload', -- 'upload', 'url', 'question', 'ai-search'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcards (linked to study guides)
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_guide_id UUID REFERENCES study_guides(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users NOT NULL,
  front TEXT NOT NULL, -- Question
  back TEXT NOT NULL, -- Answer
  topic TEXT NOT NULL,
  tags TEXT[],
  difficulty TEXT,
  position INTEGER, -- Order in deck
  
  -- FSRS fields (same as concept_cards for compatibility)
  stability FLOAT DEFAULT 1.0,
  difficulty_score FLOAT DEFAULT 0.3,
  state TEXT DEFAULT 'new',
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  fsrs_card JSONB NOT NULL,
  next_review_at TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  review_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  topic TEXT NOT NULL, -- 'AWS Lambda', 'Python Async', 'PM Frameworks'
  title TEXT,
  content TEXT,
  order_index INTEGER,
  estimated_duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  lesson_id UUID REFERENCES lessons,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  time_spent_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concept_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT, -- 'cold starts', 'timeout limits', 'pricing'
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  options JSONB, -- ['A', 'B', 'C', 'D']
  correct_answer_index INTEGER, -- Index of correct answer in options
  
  -- FSRS-7 Parameters (for querying & analytics)
  stability FLOAT DEFAULT 1.0,
  difficulty FLOAT DEFAULT 0.3,
  state TEXT DEFAULT 'new', -- 'new' | 'learning' | 'review' | 'relearning'
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  elapsed_days INTEGER DEFAULT 0,
  scheduled_days INTEGER DEFAULT 0,
  last_review TIMESTAMPTZ,
  
  -- Scheduling
  due_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Full FSRS card state (for ts-fsrs library)
  fsrs_card JSONB NOT NULL,
  
  -- Review logs (CRITICAL for FSRS optimization)
  revlogs JSONB[] DEFAULT '{}',
  
  -- Source tracking
  source_document TEXT,
  source_lesson TEXT,
  source_quiz TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  card_id UUID REFERENCES concept_cards,
  
  -- User response
  answer TEXT,
  correct BOOLEAN,
  time_taken_seconds INTEGER,
  
  -- FSRS rating (0=Again, 1=Hard, 2=Good, 3=Easy)
  rating INTEGER,
  
  -- FSRS review log (CRITICAL for optimization)
  revlog JSONB,
  
  -- State tracking
  state_before TEXT, -- 'new' | 'learning' | 'review' | 'relearning'
  state_after TEXT,
  interval_days INTEGER,
  stability_before FLOAT,
  stability_after FLOAT,
  difficulty_before FLOAT,
  difficulty_after FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE (1 table)
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,
  content TEXT,
  source TEXT, -- 'uploaded', 'web', 'manual'
  file_url TEXT,
  tags TEXT[],
  -- embedding VECTOR(1536), -- for semantic search (optional, requires pgvector extension)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENT SYSTEM (8 tables)
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 5, -- 1-10
  deadline TIMESTAMPTZ,
  estimated_duration INTEGER,
  flexible BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, deferred
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_intentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  agent_name TEXT, -- 'job-hunter', 'resume-writer', 'application-submitter'
  intention TEXT,
  reasoning TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, denied, completed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verified_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  agent_name TEXT,
  action_type TEXT, -- 'submit_application', 'send_email', 'schedule_interview'
  action_target TEXT,
  evidence JSONB,
  screenshot_url TEXT,
  confirmation_id TEXT,
  verified BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  activity_type TEXT, -- 'job_applied', 'quiz_completed', 'schedule_recalculated'
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- Intent
  intent_description TEXT,
  intent_reason TEXT,
  
  -- Action
  action_type TEXT,
  action_target TEXT,
  
  -- Permission
  permission_decision TEXT, -- 'allow', 'ask', 'deny'
  permission_rule_matched TEXT,
  permission_decided_by UUID,
  permission_decided_at TIMESTAMPTZ,
  
  -- Execution
  execution_started_at TIMESTAMPTZ,
  execution_completed_at TIMESTAMPTZ,
  success BOOLEAN,
  error_message TEXT,
  
  -- Evidence
  extracted_data JSONB,
  before_screenshot TEXT,
  after_screenshot TEXT,
  validation_checks JSONB,
  verification_passed BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  workspace_mode TEXT DEFAULT 'ask', -- 'ask', 'auto', 'supervised'
  action_rules JSONB DEFAULT '{"safe": ["search", "read", "analyze"], "confirmable": ["draft", "generate"], "sensitive": ["submit", "delete", "payment"]}',
  site_rules JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS control_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  agent_name TEXT,
  blocker_type TEXT, -- 'login_required', '2fa', 'captcha', 'payment_info'
  blocker_description TEXT,
  help_requested_at TIMESTAMPTZ,
  control_released_at TIMESTAMPTZ,
  user_action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  topic TEXT,
  subtopic TEXT,
  score INTEGER,
  total_questions INTEGER,
  correct_answers INTEGER,
  weak_spots TEXT[],
  time_taken_seconds INTEGER,
  quiz_mode TEXT, -- 'text', 'voice'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE replan_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES (Users can only access their own data)
-- ============================================
CREATE POLICY "Users can access own data" ON user_context FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON time_blocks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON availability_windows FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON calendar_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON replan_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON scheduling_conflicts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON job_applications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON cover_letters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON recruiters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON company_watchlists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON lessons FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON lesson_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON concept_cards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON review_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON knowledge_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON agent_intentions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON verified_actions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON activity_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON action_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON agent_permissions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON control_handoffs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON quiz_attempts FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_time_blocks_user_time ON time_blocks(user_id, start_time);
CREATE INDEX idx_job_applications_user_status ON job_applications(user_id, status);
CREATE INDEX idx_concept_cards_user_due ON concept_cards(user_id, due_date);
CREATE INDEX idx_concept_cards_user_state ON concept_cards(user_id, state);
CREATE INDEX idx_concept_cards_due_learning ON concept_cards(user_id, due_date) WHERE state IN ('learning', 'review', 'relearning');
CREATE INDEX idx_review_sessions_user_card ON review_sessions(user_id, card_id, created_at DESC);
CREATE INDEX idx_activity_log_user_created ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_quiz_attempts_user_topic ON quiz_attempts(user_id, topic, created_at DESC);

-- ============================================
-- DONE! 24 TABLES CREATED
-- ============================================

-- ============================================
-- INDEXES FOR STUDY MATERIALS (Phase 3)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_study_guides_user ON study_guides(user_id);
CREATE INDEX IF NOT EXISTS idx_study_guides_topic ON study_guides(topic);
CREATE INDEX IF NOT EXISTS idx_flashcards_study_guide ON flashcards(study_guide_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_next_review ON flashcards(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_state ON flashcards(user_id, state);


-- ============================================
-- PHASE 4: LEARNING FEEDBACK LOOP
-- ============================================

-- Table: skill_levels
-- Tracks overall skill level per topic with weak/strong spots
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

-- Table: concept_stats
-- Tracks concept-level performance for adaptive learning
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

-- Indexes for skill tracking
CREATE INDEX IF NOT EXISTS idx_skill_levels_user_id ON skill_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_levels_topic ON skill_levels(topic);
CREATE INDEX IF NOT EXISTS idx_skill_levels_confidence ON skill_levels(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_concept_stats_user_id ON concept_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_concept_stats_topic ON concept_stats(topic);
CREATE INDEX IF NOT EXISTS idx_concept_stats_accuracy ON concept_stats(accuracy ASC);
CREATE INDEX IF NOT EXISTS idx_concept_stats_user_topic ON concept_stats(user_id, topic);

-- RLS Policies for skill tracking
ALTER TABLE skill_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skill levels" ON skill_levels FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skill levels" ON skill_levels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skill levels" ON skill_levels FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own concept stats" ON concept_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own concept stats" ON concept_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own concept stats" ON concept_stats FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- FIX (Nov 3): study_guides and flashcards had RLS enabled with no policies.
-- For an EXISTING project, run supabase-migrations/20261103_sync_live_database.sql
-- instead (it also adds FSRS columns the live database is missing).
-- ============================================
CREATE POLICY "Users can access own data" ON study_guides FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can access own data" ON flashcards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own skill levels" ON skill_levels FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own concept stats" ON concept_stats FOR DELETE USING (auth.uid() = user_id);
