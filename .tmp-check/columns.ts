import { supabase } from '@/lib/supabase';

// Every column the app reads or writes, per table
const EXPECTED: Record<string, string[]> = {
  concept_cards: ['id', 'user_id', 'topic', 'subtopic', 'question', 'answer', 'options', 'correct_answer_index', 'stability', 'difficulty', 'state', 'reps', 'lapses', 'elapsed_days', 'scheduled_days', 'last_review', 'due_date', 'fsrs_card', 'revlogs', 'source_document', 'source_lesson', 'source_quiz', 'created_at'],
  review_sessions: ['id', 'user_id', 'card_id', 'rating', 'revlog', 'state_before', 'state_after', 'interval_days', 'stability_before', 'stability_after', 'difficulty_before', 'difficulty_after', 'time_taken_seconds', 'created_at'],
  quiz_attempts: ['id', 'user_id', 'topic', 'score', 'total_questions', 'correct_answers', 'weak_spots', 'time_taken_seconds', 'quiz_mode', 'created_at'],
  skill_levels: ['id', 'user_id', 'topic', 'confidence', 'quizzes_taken', 'correct_answers', 'total_answers', 'accuracy', 'weak_spots', 'strong_spots', 'last_quiz_at'],
  concept_stats: ['id', 'user_id', 'topic', 'concept', 'attempts', 'correct', 'accuracy', 'last_attempt_at'],
  study_guides: ['id', 'user_id', 'topic', 'title', 'summary', 'key_points', 'prerequisites', 'learning_objectives', 'difficulty', 'estimated_study_time_minutes', 'source_documents', 'source_type'],
  flashcards: ['id', 'study_guide_id', 'user_id', 'front', 'back', 'topic', 'tags', 'difficulty', 'position', 'stability', 'difficulty_score', 'state', 'reps', 'lapses', 'fsrs_card', 'next_review_at', 'last_reviewed_at', 'review_count'],
  replan_log: ['id', 'user_id', 'trigger', 'before_schedule', 'after_schedule', 'duration_ms', 'changes_summary', 'created_at'],
  job_applications: ['id', 'user_id', 'job_title', 'company', 'status', 'ats_score', 'match_score', 'match_reasons'],
  resumes: ['id', 'user_id', 'version', 'content', 'is_base', 'tailored_for'],
};

export default async function () {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) return console.log('sign-in failed', error.message);

  for (const [table, cols] of Object.entries(EXPECTED)) {
    const whole = await supabase.from(table).select('id').limit(1);
    if (whole.error) {
      console.log(`${table.padEnd(17)} TABLE PROBLEM: ${whole.error.code} ${whole.error.message}`);
      continue;
    }
    const missing: string[] = [];
    for (const col of cols) {
      const r = await supabase.from(table).select(col).limit(1);
      if (r.error) missing.push(col);
    }
    console.log(`${table.padEnd(17)} ${missing.length ? 'MISSING COLUMNS: ' + missing.join(', ') : 'all columns present'}`);
  }
  await supabase.auth.signOut();
}
