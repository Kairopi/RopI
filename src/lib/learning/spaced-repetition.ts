/**
 * ROPI Spaced Repetition System - Production Grade
 * 
 * Uses ts-fsrs v6 library for proven FSRS-7 algorithm
 * Reference: github-extractions/ts-fsrs/README.md
 * 
 * Key Features:
 * - FSRS-7 algorithm (latest, fractional days)
 * - Review scheduling based on actual performance
 * - Efficient retention (review 10 concepts, not 100)
 * - Personalized to user's retention rate
 * - Production patterns from AI University, Anki
 * 
 * CRITICAL: ts-fsrs v6 is ASYNC! All functions use await DefaultScheduler()
 * 
 * Improvements (Nov 1, 2026):
 * - Database functions for server-side queries
 * - Review log persistence for FSRS optimization
 * - Card state management (new → learning → review)
 * - Analytics and forecasting
 */

import { DefaultScheduler, Rating } from 'ts-fsrs'
import { supabase } from '../supabase'

// ===== TYPES FROM THE v6 SCHEDULER API =====
// ts-fsrs v6 cards use dueAt / lastReviewAt / scheduledDays (the old Card type
// with due / elapsed_days / last_review is deprecated and NOT what newCard() returns).
type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>
/** New cards (newCard) and reviewed cards (review().card) are different v6 types */
export type FSRSCard = ReturnType<Scheduler['newCard']> | ReturnType<Scheduler['review']>['card']
export type ReviewLog = ReturnType<Scheduler['review']>['revlog']
type Grade = Parameters<Scheduler['review']>[0]['grade']
/** 0 = New, 1 = Learning, 2 = Review, 3 = Relearning */
export type State = FSRSCard['state']

/**
 * Cards stored in Postgres JSONB come back with ISO strings instead of Dates.
 * The v6 scheduler rejects those ("Expected valid Date fields"), so convert back.
 */
export function hydrateFsrsCard(raw: any): FSRSCard {
  return {
    ...raw,
    dueAt: new Date(raw.dueAt ?? raw.due ?? Date.now()),
    lastReviewAt: raw.lastReviewAt ? new Date(raw.lastReviewAt) : raw.last_review ? new Date(raw.last_review) : null,
  } as FSRSCard
}

/** Whole days since the card was last reviewed (0 if never) */
function elapsedDays(card: FSRSCard, now: Date = new Date()): number {
  if (!card.lastReviewAt) return 0
  return Math.max(0, Math.floor((now.getTime() - new Date(card.lastReviewAt).getTime()) / 86_400_000))
}

// ===== SCHEDULER CACHE =====
// DefaultScheduler() is expensive to create, so we cache it
let schedulerCache: Scheduler | null = null

/**
 * Get or create the FSRS scheduler
 * Uses FSRS-7 with optimized settings for learning
 */
export async function getScheduler() {
  if (!schedulerCache) {
    schedulerCache = await DefaultScheduler({
      version: 'FSRS-7',          // Latest model (fractional days)
      desiredRetention: 0.9,       // 90% retention target
      enableShortTerm: true,       // Short-term memory enabled
      learningSteps: ['1m', '10m'], // Learning phase steps
      relearningSteps: ['10m'],    // Relearning phase steps
      enableFuzz: false,           // No fuzzing for consistent demo
      maximumInterval: 36_500,     // ~100 years max interval
    })
  }
  return schedulerCache
}

// ===== INTERFACES =====

export interface ConceptCard {
  id: string
  userId: string
  topic: string
  subtopic?: string
  question: string
  answer: string
  options?: string[] // For multiple choice
  correctAnswerIndex?: number
  
  // FSRS state (the actual card from ts-fsrs)
  fsrsCard: FSRSCard
  
  // Tracking
  reviewCount: number
  lastReviewedAt?: Date
  nextReviewDue: Date
  
  // Source
  sourceDocument?: string
  sourceLesson?: string
  
  createdAt: Date
}

export interface ReviewResult {
  cardId: string
  rating: Rating
  updatedCard: Partial<ConceptCard>
  revlog: ReviewLog // MUST save to database!
  nextReviewDate: Date
  intervalDays: number
  confidence: number // 0-100% based on stability
  state: State
  reviewedAt: Date
}

// Re-export Rating for convenience
export { Rating }

// ===== HELPERS =====

/**
 * Convert FSRS numeric state to string
 */
export function getCardState(fsrsCard: FSRSCard): 'new' | 'learning' | 'review' | 'relearning' {
  const stateMap: Array<'new' | 'learning' | 'review' | 'relearning'> = ['new', 'learning', 'review', 'relearning']
  return stateMap[fsrsCard.state] || 'new'
}

/**
 * Get color for card state (for UI badges)
 */
export function getStateColor(state: 'new' | 'learning' | 'review' | 'relearning'): string {
  return {
    new: 'blue',
    learning: 'yellow',
    review: 'green',
    relearning: 'red',
  }[state]
}

/**
 * Get user-friendly label for card state
 */
export function getStateLabel(state: 'new' | 'learning' | 'review' | 'relearning'): string {
  return {
    new: 'New',
    learning: 'Learning',
    review: 'Review',
    relearning: 'Relearning',
  }[state]
}

// ===== CREATE NEW CARD =====

/**
 * Create a new concept card with FSRS scheduling
 * 
 * @param concept - The topic/concept name
 * @param question - The question text
 * @param answer - The correct answer with explanation
 * @param options - Optional multiple choice options
 * @param correctAnswerIndex - Index of correct option if multiple choice
 * @returns New concept card (ready to save to database)
 */
export async function createConceptCard(
  concept: string,
  question: string,
  answer: string,
  options?: string[],
  correctAnswerIndex?: number
): Promise<Omit<ConceptCard, 'id' | 'userId' | 'createdAt'>> {
  const scheduler = await getScheduler()
  const now = new Date()
  
  // Create new FSRS card (state: New, due: now)
  const fsrsCard = scheduler.newCard({ now })
  
  return {
    topic: concept,
    question,
    answer,
    options,
    correctAnswerIndex,
    fsrsCard,
    reviewCount: 0,
    nextReviewDue: fsrsCard.dueAt,
    lastReviewedAt: undefined,
    sourceDocument: undefined,
    sourceLesson: undefined,
  }
}

// ===== PREVIEW RATINGS =====

/**
 * Preview what would happen for each rating BEFORE user answers
 * Call this to show user the consequences of each choice
 * 
 * @param card - The concept card
 * @param now - Current time (defaults to now)
 * @returns Preview for all 4 ratings (Again, Hard, Good, Easy)
 */
export async function previewRatings(
  card: ConceptCard,
  now: Date = new Date()
): Promise<{
  again: { card: FSRSCard; nextReview: Date; interval: string }
  hard: { card: FSRSCard; nextReview: Date; interval: string }
  good: { card: FSRSCard; nextReview: Date; interval: string }
  easy: { card: FSRSCard; nextReview: Date; interval: string }
}> {
  const scheduler = await getScheduler()
  
  // ts-fsrs v6 preview() returns an iterable with 4 items (grades 1-4: Again, Hard, Good, Easy)
  const preview = scheduler.preview({ card: /* ts-fsrs v6 typings reject their own card type here; shape verified at runtime */ hydrateFsrsCard(card.fsrsCard) as any, now })
  const [again, hard, good, easy] = Array.from(preview)
  const item = (p: typeof again) => ({
    card: p.card,
    nextReview: p.card.dueAt,
    interval: formatDuration(p.card.dueAt, now),
  })

  return { again: item(again), hard: item(hard), good: item(good), easy: item(easy) }
}

// ===== REVIEW CARD =====

/**
 * Review a concept card and get next review date
 * This is the main function called after user answers
 * 
 * @param card - The concept card to review
 * @param rating - User's rating (0=Again, 1=Hard, 2=Good, 3=Easy)
 * @param reviewedAt - When the review happened (defaults to now)
 * @returns Updated card state, revlog (MUST SAVE!), and metadata
 */
export async function reviewCard(
  card: ConceptCard,
  rating: Rating,
  reviewedAt: Date = new Date()
): Promise<ReviewResult> {
  const scheduler = await getScheduler()
  
  if (rating === Rating.Manual) {
    throw new Error('Manual rating is not a review grade')
  }

  // Apply rating to card (cards from the database need their dates restored first)
  const result = scheduler.review({
    card: /* ts-fsrs v6 typings reject their own card type here; shape verified at runtime */ hydrateFsrsCard(card.fsrsCard) as any,
    grade: rating as Grade,
    now: reviewedAt,
  })
  
  // Calculate interval in days
  const intervalMs = result.card.dueAt.getTime() - reviewedAt.getTime()
  const intervalDays = Math.round(intervalMs / (1000 * 60 * 60 * 24))
  
  // Calculate confidence (0-100%) based on FSRS stability
  // Higher stability = higher confidence in retention
  // FSRS-7 stability ranges from ~0.4 (new) to 100+ (mastered)
  const confidence = Math.min(100, Math.round(result.card.stability * 5))
  
  // Updated card data (merge with existing card)
  const updatedCard: Partial<ConceptCard> = {
    fsrsCard: result.card,
    nextReviewDue: result.card.dueAt,
    lastReviewedAt: reviewedAt,
    reviewCount: card.reviewCount + 1,
  }
  
  return {
    cardId: card.id,
    rating,
    updatedCard,
    revlog: result.revlog, // CRITICAL: Save this to database!
    nextReviewDate: result.card.dueAt,
    intervalDays,
    confidence,
    state: result.card.state,
    reviewedAt,
  }
}

// ===== GET DUE CARDS =====

/**
 * Get all concept cards due for review
 * 
 * @param cards - All concept cards
 * @param now - Current time (defaults to now)
 * @returns Cards due for review, sorted by due date (oldest first)
 */
export function getDueCards(
  cards: ConceptCard[],
  now: Date = new Date()
): ConceptCard[] {
  return cards
    .filter(card => card.nextReviewDue <= now)
    .sort((a, b) => a.nextReviewDue.getTime() - b.nextReviewDue.getTime())
}

/**
 * Get cards due in the next N days
 */
export function getUpcomingCards(
  cards: ConceptCard[],
  days: number = 7,
  now: Date = new Date()
): ConceptCard[] {
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  
  return cards
    .filter(card => card.nextReviewDue > now && card.nextReviewDue <= futureDate)
    .sort((a, b) => a.nextReviewDue.getTime() - b.nextReviewDue.getTime())
}

// ===== CALCULATE RETRIEVABILITY =====

/**
 * Calculate: What % chance does user remember this card right now?
 * This is the FSRS forgetting curve in action
 * 
 * @param card - The concept card
 * @param now - Current time (defaults to now)
 * @returns Probability of recall (0-100%)
 */
export async function calculateRetrievability(
  card: ConceptCard,
  now: Date = new Date()
): Promise<number> {
  const scheduler = await getScheduler()
  
  // New cards have no memory yet
  const fsrsCard = hydrateFsrsCard(card.fsrsCard)
  if (fsrsCard.state === 0) return 0

  // Elapsed days since the last review. Prefer FSRS's own timestamp. Measured
  // directly, so it can't silently flip sign (a negative value clamped to 0
  // would always report 100%).
  const last = (fsrsCard as any).lastReviewAt ? new Date((fsrsCard as any).lastReviewAt) : card.lastReviewedAt || card.createdAt
  const elapsed = Math.max(0, (now.getTime() - new Date(last).getTime()) / 86_400_000)
  
  // Forgetting curve: probability user still remembers
  const retrievability = scheduler.model.forgettingCurve(
    fsrsCard as any,
    elapsed
  )
  
  return Math.round(retrievability * 100) // Convert to percentage
}

// ===== STATISTICS =====

/**
 * Get statistics for a set of cards
 */
export function getCardStatistics(cards: ConceptCard[]): {
  total: number
  dueToday: number
  dueThisWeek: number
  new: number
  learning: number
  reviewing: number
  relearning: number
  averageInterval: number
} {
  const now = new Date()
  const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  const dueToday = cards.filter(c => c.nextReviewDue <= now).length
  const dueThisWeek = cards.filter(c => c.nextReviewDue > now && c.nextReviewDue <= oneWeek).length
  
  // FSRS states: New, Learning, Review, Relearning
  const newCards = cards.filter(c => c.fsrsCard.state === 0).length // State.New
  const learning = cards.filter(c => c.fsrsCard.state === 1).length // State.Learning
  const reviewing = cards.filter(c => c.fsrsCard.state === 2).length // State.Review
  const relearning = cards.filter(c => c.fsrsCard.state === 3).length // State.Relearning
  
  // Calculate average interval for review cards
  const reviewingCards = cards.filter(c => c.fsrsCard.state === 2) // State.Review
  const avgInterval = reviewingCards.length > 0
    ? reviewingCards.reduce((sum, card) => {
        const interval = card.nextReviewDue.getTime() - (card.lastReviewedAt?.getTime() || card.createdAt.getTime())
        return sum + interval
      }, 0) / reviewingCards.length / (1000 * 60 * 60 * 24)
    : 0
  
  return {
    total: cards.length,
    dueToday,
    dueThisWeek,
    new: newCards,
    learning,
    reviewing,
    relearning,
    averageInterval: Math.round(avgInterval),
  }
}

// ===== QUIZ INTEGRATION =====

/**
 * Extract concept cards from quiz questions that user got wrong
 * 
 * This is ROPI's intelligence - deciding WHICH concepts need review
 * FSRS handles WHEN to review them
 */
export async function extractConceptsFromQuiz(
  topic: string,
  questions: Array<{
    question: string
    correctAnswer: string
    explanation: string
    isCorrect: boolean
    options?: string[]
    correctAnswerIndex?: number
  }>
): Promise<Array<Omit<ConceptCard, 'id' | 'userId' | 'createdAt'>>> {
  const concepts: Array<Omit<ConceptCard, 'id' | 'userId' | 'createdAt'>> = []
  
  // Only create cards for questions the user got wrong
  for (const q of questions) {
    if (!q.isCorrect) {
      const card = await createConceptCard(
        topic,
        q.question,
        `${q.correctAnswer}\n\n${q.explanation}`,
        q.options,
        q.correctAnswerIndex
      )
      
      concepts.push(card)
    }
  }
  
  return concepts
}

// ===== ANALYTICS =====

/**
 * Calculate retention rate for a topic
 */
export function calculateRetentionRate(
  reviews: Array<{ rating: Rating; reviewedAt: Date }>,
  dayRange: number = 30
): number {
  const now = new Date()
  const cutoffDate = new Date(now.getTime() - dayRange * 24 * 60 * 60 * 1000)
  
  const recentReviews = reviews.filter(r => r.reviewedAt >= cutoffDate)
  
  if (recentReviews.length === 0) return 0
  
  // Count Good and Easy ratings as "retained"
  const retainedCount = recentReviews.filter(
    r => r.rating === Rating.Good || r.rating === Rating.Easy
  ).length
  
  return Math.round((retainedCount / recentReviews.length) * 100)
}

/**
 * Suggest optimal daily review count based on user's schedule
 */
export function suggestDailyReviewCount(
  availableMinutes: number,
  averageReviewTimeSeconds: number = 20
): number {
  const availableSeconds = availableMinutes * 60
  return Math.floor(availableSeconds / averageReviewTimeSeconds)
}

// ===== HELPERS =====

/**
 * Format duration between two dates into human-readable string
 */
/** Compact interval for rating buttons: 1m, 10m, 3h, 4d, 2mo */
export function formatInterval(future: Date, now: Date = new Date()): string {
  const min = Math.max(1, Math.round((future.getTime() - now.getTime()) / 60000))
  if (min < 60) return `${min}m`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 31) return `${d}d`
  const mo = Math.round(d / 30)
  return mo < 12 ? `${mo}mo` : `${Math.round(d / 365)}y`
}

function formatDuration(future: Date, now: Date): string {
  const ms = future.getTime() - now.getTime()
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''}`
  return 'now'
}


// ===== DATABASE FUNCTIONS (Production Grade) =====

/**
 * Save concept card to database with FSRS parameters
 * Based on AI University implementation pattern
 */
export async function saveCardToDatabase(
  card: Omit<ConceptCard, 'id' | 'userId' | 'createdAt'>,
  userId: string
): Promise<{ id: string; card: ConceptCard }> {
  const cardState = getCardState(card.fsrsCard)
  
  const { data, error } = await supabase
    .from('concept_cards')
    .insert({
      user_id: userId,
      topic: card.topic,
      subtopic: card.subtopic,
      question: card.question,
      answer: card.answer,
      options: card.options,
      correct_answer_index: card.correctAnswerIndex,
      
      // FSRS parameters (for querying & analytics)
      stability: card.fsrsCard.stability,
      difficulty: card.fsrsCard.difficulty,
      state: cardState,
      reps: card.fsrsCard.reps,
      lapses: card.fsrsCard.lapses,
      // INTEGER columns; v6 scheduledDays is fractional
      elapsed_days: elapsedDays(card.fsrsCard),
      scheduled_days: Math.round(card.fsrsCard.scheduledDays ?? 0),
      last_review: card.fsrsCard.lastReviewAt,
      
      // Full FSRS card (for library)
      fsrs_card: card.fsrsCard,
      
      // Scheduling
      due_date: card.nextReviewDue,
      
      // Source tracking
      source_document: card.sourceDocument,
      source_lesson: card.sourceLesson,
    })
    .select()
    .single()
    
  if (error) throw error
  
  return {
    id: data.id,
    card: {
      ...card,
      id: data.id,
      userId,
      createdAt: new Date(data.created_at),
    },
  }
}

/**
 * Update card after review
 */
export async function updateCardInDatabase(
  cardId: string,
  userId: string,
  updates: Partial<ConceptCard>
): Promise<void> {
  const cardState = updates.fsrsCard ? getCardState(updates.fsrsCard) : undefined
  
  const updateData: any = {}
  
  if (updates.fsrsCard) {
    updateData.stability = updates.fsrsCard.stability
    updateData.difficulty = updates.fsrsCard.difficulty
    updateData.state = cardState
    updateData.reps = updates.fsrsCard.reps
    updateData.lapses = updates.fsrsCard.lapses
    updateData.elapsed_days = 0 // just reviewed
    updateData.scheduled_days = Math.round(updates.fsrsCard.scheduledDays ?? 0)
    updateData.last_review = updates.fsrsCard.lastReviewAt
    updateData.fsrs_card = updates.fsrsCard
  }
  
  if (updates.nextReviewDue) {
    updateData.due_date = updates.nextReviewDue
  }
  
  if (updates.lastReviewedAt) {
    updateData.last_review = updates.lastReviewedAt
  }
  
  const { error } = await supabase
    .from('concept_cards')
    .update(updateData)
    .eq('id', cardId)
    .eq('user_id', userId)
    
  if (error) throw error
}

/**
 * Save review session with FSRS review log
 * CRITICAL: Review logs enable FSRS parameter optimization
 */
export async function saveReviewSession(
  cardId: string,
  userId: string,
  reviewResult: ReviewResult,
  beforeCard: ConceptCard,
  timeSpentSeconds?: number
): Promise<void> {
  const { error } = await supabase
    .from('review_sessions')
    .insert({
      user_id: userId,
      card_id: cardId,
      rating: reviewResult.rating,
      revlog: reviewResult.revlog,
      state_before: getCardState(beforeCard.fsrsCard),
      state_after: getCardState(reviewResult.updatedCard.fsrsCard!),
      interval_days: reviewResult.intervalDays,
      stability_before: beforeCard.fsrsCard.stability,
      stability_after: reviewResult.updatedCard.fsrsCard!.stability,
      difficulty_before: beforeCard.fsrsCard.difficulty,
      difficulty_after: reviewResult.updatedCard.fsrsCard!.difficulty,
      time_taken_seconds: timeSpentSeconds ?? null,
    })
    
  if (error) throw error
  // The full review history lives in review_sessions (one row per review, with revlog).
  // The old code also tried supabase.raw(...) to append to concept_cards.revlogs;
  // supabase-js has no .raw(), so that line threw on every single review.
}

/**
 * Get due cards from database (server-side query)
 * Much faster than client-side filtering
 */
export async function getDueCardsFromDatabase(
  userId: string,
  limit: number = 20
): Promise<ConceptCard[]> {
  const { data, error } = await supabase
    .from('concept_cards')
    .select('*')
    .eq('user_id', userId)
    .lte('due_date', new Date().toISOString())
    .order('due_date', { ascending: true })
    .limit(limit)
    
  if (error) throw error
  if (!data) return []
  
  return data.map(d => ({
    id: d.id,
    userId: d.user_id,
    topic: d.topic,
    subtopic: d.subtopic,
    question: d.question,
    answer: d.answer,
    options: d.options,
    correctAnswerIndex: d.correct_answer_index,
    fsrsCard: hydrateFsrsCard(d.fsrs_card),
    reviewCount: d.reps,
    lastReviewedAt: d.last_review ? new Date(d.last_review) : undefined,
    nextReviewDue: new Date(d.due_date),
    sourceDocument: d.source_document,
    sourceLesson: d.source_lesson,
    createdAt: new Date(d.created_at),
  }))
}

/**
 * Get cards by state (for filtered views)
 */
export async function getCardsByState(
  userId: string,
  state: 'new' | 'learning' | 'review' | 'relearning',
  limit: number = 100
): Promise<ConceptCard[]> {
  const { data, error } = await supabase
    .from('concept_cards')
    .select('*')
    .eq('user_id', userId)
    .eq('state', state)
    .order('created_at', { ascending: false })
    .limit(limit)
    
  if (error) throw error
  if (!data) return []
  
  return data.map(d => ({
    id: d.id,
    userId: d.user_id,
    topic: d.topic,
    subtopic: d.subtopic,
    question: d.question,
    answer: d.answer,
    options: d.options,
    correctAnswerIndex: d.correct_answer_index,
    fsrsCard: hydrateFsrsCard(d.fsrs_card),
    reviewCount: d.reps,
    lastReviewedAt: d.last_review ? new Date(d.last_review) : undefined,
    nextReviewDue: new Date(d.due_date),
    sourceDocument: d.source_document,
    sourceLesson: d.source_lesson,
    createdAt: new Date(d.created_at),
  }))
}

/**
 * Get cards by topic (for topic-specific reviews)
 */
export async function getCardsByTopic(
  userId: string,
  topic: string,
  limit: number = 100
): Promise<ConceptCard[]> {
  const { data, error } = await supabase
    .from('concept_cards')
    .select('*')
    .eq('user_id', userId)
    .eq('topic', topic)
    .order('created_at', { ascending: false })
    .limit(limit)
    
  if (error) throw error
  if (!data) return []
  
  return data.map(d => ({
    id: d.id,
    userId: d.user_id,
    topic: d.topic,
    subtopic: d.subtopic,
    question: d.question,
    answer: d.answer,
    options: d.options,
    correctAnswerIndex: d.correct_answer_index,
    fsrsCard: hydrateFsrsCard(d.fsrs_card),
    reviewCount: d.reps,
    lastReviewedAt: d.last_review ? new Date(d.last_review) : undefined,
    nextReviewDue: new Date(d.due_date),
    sourceDocument: d.source_document,
    sourceLesson: d.source_lesson,
    createdAt: new Date(d.created_at),
  }))
}

/**
 * Get learning analytics for dashboard
 */
export async function getLearningAnalytics(userId: string): Promise<{
  total: number
  dueToday: number
  newCards: number
  learningCards: number
  reviewCards: number
  relearningCards: number
  retentionRate: number
  averageStability: number
  forecastTomorrow: number
  forecastWeek: number
}> {
  const { data: cards, error } = await supabase
    .from('concept_cards')
    .select('state, stability, due_date')
    .eq('user_id', userId)
    
  if (error) throw error
  if (!cards) return {
    total: 0,
    dueToday: 0,
    newCards: 0,
    learningCards: 0,
    reviewCards: 0,
    relearningCards: 0,
    retentionRate: 0,
    averageStability: 0,
    forecastTomorrow: 0,
    forecastWeek: 0,
  }
  
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  
  const dueToday = cards.filter(c => new Date(c.due_date) <= now).length
  const newCards = cards.filter(c => c.state === 'new').length
  const learningCards = cards.filter(c => c.state === 'learning').length
  const reviewCards = cards.filter(c => c.state === 'review').length
  const relearningCards = cards.filter(c => c.state === 'relearning').length
  
  // Calculate average stability for review cards
  const reviewCardsData = cards.filter(c => c.state === 'review')
  const avgStability = reviewCardsData.length > 0
    ? reviewCardsData.reduce((sum, c) => sum + c.stability, 0) / reviewCardsData.length
    : 0
  
  // Forecast cards due tomorrow and next week
  const forecastTomorrow = cards.filter(c => {
    const due = new Date(c.due_date)
    return due > now && due <= tomorrow
  }).length
  
  const forecastWeek = cards.filter(c => {
    const due = new Date(c.due_date)
    return due > now && due <= nextWeek
  }).length
  
  // Get retention rate from recent reviews
  const { data: recentReviews } = await supabase
    .from('review_sessions')
    .select('rating')
    .eq('user_id', userId)
    .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString())
    
  const retentionRate = recentReviews && recentReviews.length > 0
    ? (recentReviews.filter(r => r.rating === Rating.Good || r.rating === Rating.Easy).length / recentReviews.length) * 100
    : 0
  
  return {
    total: cards.length,
    dueToday,
    newCards,
    learningCards,
    reviewCards,
    relearningCards,
    retentionRate: Math.round(retentionRate),
    averageStability: Math.round(avgStability * 10) / 10,
    forecastTomorrow,
    forecastWeek,
  }
}

/**
 * Complete review workflow: Review card + Update database + Save session
 * This is the main function to call from UI components
 */
export async function reviewCardComplete(
  card: ConceptCard,
  rating: Rating,
  userId: string,
  timeSpentSeconds?: number
): Promise<ReviewResult> {
  // 1. Review card with FSRS
  const result = await reviewCard(card, rating)
  
  // 2. Update card in database
  await updateCardInDatabase(card.id, userId, result.updatedCard)
  
  // 3. Save review session (with time spent, in the same row)
  await saveReviewSession(card.id, userId, result, card, timeSpentSeconds)
  
  return result
}
