/**
 * Study Guide Generation System - Production Grade
 * 
 * Generates comprehensive study materials from documents:
 * - Summary (key concepts and main ideas)
 * - Flashcards (for memorization)
 * - Quiz (for testing)
 * - Learning roadmap (suggested study order)
 * 
 * Based on SurfSense patterns + Meta Muse AI generation
 * 
 * Reference: SurfSense artifact generation + ROPI learning systems
 */

import { callMuseWonder, isMuseConfigured, generateQuizFromTextWithMuse } from '@/lib/api/muse'
import { generateFlashcards, type Flashcard, type FlashcardDeck } from './flashcard-generator'
import type { QuizQuestion } from './quiz-generator'

export interface StudyGuide {
  id: string
  topic: string
  title: string
  
  // Core content
  summary: string // 300-500 word overview
  keyPoints: string[] // Bullet points of main ideas
  prerequisites: string[] // What to know first
  learningObjectives: string[] // What you'll learn
  
  // Study materials
  flashcards: Flashcard[]
  quiz: QuizQuestion[]
  
  // Metadata
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedStudyTimeMinutes: number
  sourceDocuments: string[]
  createdAt: Date
}

export interface StudyRoadmap {
  topic: string
  phases: Array<{
    name: string
    description: string
    duration: string
    materials: string[]
    milestones: string[]
  }>
  totalEstimatedHours: number
}

/**
 * Generate comprehensive study guide from document
 * 
 * @param documentText - Source text
 * @param topic - Main topic/subject
 * @param difficulty - Target difficulty level
 * @param documentTitle - Optional source document title
 * @returns Complete study guide
 */
export async function generateStudyGuide(
  documentText: string,
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  documentTitle?: string
): Promise<StudyGuide> {
  if (!isMuseConfigured()) {
    throw new Error('Meta Muse API not configured. Please set VITE_MUSE_API_KEY in .env')
  }

  console.log(`📚 Generating study guide for: ${topic}`)

  try {
    // The three parts don't depend on each other: ask Muse for all of them at once (about 3x faster)
    console.log('📝 Writing summary, flashcards and quiz together...')
    // (No quiz here: the guide's Quiz tab writes a fresh one when you open it, so writing one now was wasted time)
    // Cards in two halves at once (core ideas / using it), so they arrive in about half the time
    const [{ summary, keyPoints, prerequisites, learningObjectives }, cardsA, cardsB] = await Promise.all([
      generateSummary(documentText, topic, difficulty),
      generateFlashcards(documentText, topic, 4, difficulty, documentTitle, 'the core ideas: what each thing is and why it matters'),
      generateFlashcards(documentText, topic, 4, difficulty, documentTitle, 'using it at work and the common mistakes people make').catch(() => []),
    ])
    const flashcards = [...cardsA, ...cardsB].map((c, i) => ({ ...c, id: `card-${i + 1}` }))
    const quizQuestions: Awaited<ReturnType<typeof generateQuizFromTextWithMuse>> = []

    // Calculate estimated study time
    const estimatedStudyTimeMinutes = calculateStudyTime(
      summary,
      flashcards.length,
      quizQuestions.length
    )

    const studyGuide: StudyGuide = {
      id: `guide-${topic.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      topic,
      title: `${topic} Study Guide`,
      summary,
      keyPoints,
      prerequisites,
      learningObjectives,
      flashcards,
      quiz: quizQuestions.map((q, i) => ({
        id: `q${i + 1}`,
        question: q.question,
        options: q.options,
        correctAnswerIndex: q.correctAnswerIndex,
        explanation: q.explanation,
        concept: q.concept,
        difficulty: q.difficulty,
      })),
      difficulty,
      estimatedStudyTimeMinutes,
      sourceDocuments: documentTitle ? [documentTitle] : [],
      createdAt: new Date(),
    }

    console.log('✅ Study guide generated successfully!')
    console.log(`   📝 Summary: ${summary.length} chars`)
    console.log(`   🎴 Flashcards: ${flashcards.length}`)
    console.log(`   ❓ Quiz: ${quizQuestions.length} questions`)
    console.log(`   ⏱️ Study time: ${estimatedStudyTimeMinutes} minutes`)

    return studyGuide
  } catch (error) {
    console.error('❌ Study guide generation failed:', error)
    throw error
  }
}

/**
 * Generate summary and key learning points
 */
async function generateSummary(
  documentText: string,
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<{
  summary: string
  keyPoints: string[]
  prerequisites: string[]
  learningObjectives: string[]
}> {
  const difficultyContext = {
    easy: 'Beginner-friendly explanations with basic examples',
    medium: 'Intermediate understanding with practical applications',
    hard: 'Advanced concepts with edge cases and trade-offs',
  }

  const prompt = `
You are an expert curriculum designer creating study materials for ${topic}.

DIFFICULTY LEVEL: ${difficulty} - ${difficultyContext[difficulty]}

DOCUMENT CONTENT:
${documentText.substring(0, 15000)}${documentText.length > 15000 ? '\n...(truncated)' : ''}

Generate a comprehensive study guide overview in JSON format:

{
  "summary": "150-250 words in plain English, for someone busy who wants it straight: what it is in one sentence, why it matters at work, then one short real-life scenario that shows it happening (a named situation, e.g. 'Your team is launching a feature on Friday...'). Short sentences. No jargon without saying what it means.",
  
  "keyPoints": [
    "Each key point is one idea in plain words, then 'For example:' and a one-sentence real situation",
    "(4 to 5 of these)"
  ],
  
  "prerequisites": [
    "What learners should know before studying this",
    "Required background knowledge",
    "Foundational concepts needed"
  ],
  
  "learningObjectives": [
    "After studying, learner will be able to...",
    "Specific skills or knowledge gained",
    "Practical applications they can do"
  ]
}

Make it simple to get and straightforward: everyday words, concrete examples, nothing padded.
Return ONLY valid JSON (no markdown formatting).
`;

  try {
    // JSON mode, and one retry: a long summary occasionally comes back with a broken quote
    let parsed: any = null
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const response = await callMuseWonder(prompt, 0.7, { json: true, reasoningEffort: 'minimal', maxTokens: 3000 })
      try {
        parsed = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] ?? response)
      } catch (e) {
        if (attempt === 1) throw new Error('Meta Muse sent back a summary Ropi couldn’t read. Try again.')
      }
    }
    
    return {
      summary: parsed.summary || '',
      keyPoints: parsed.keyPoints || [],
      prerequisites: parsed.prerequisites || [],
      learningObjectives: parsed.learningObjectives || [],
    }
  } catch (error) {
    console.error('Failed to generate summary:', error)
    throw error
  }
}

/**
 * Generate learning roadmap for a topic
 * Breaks down learning into phases with milestones
 */
export async function generateLearningRoadmap(
  topic: string,
  currentSkillLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner',
  targetSkillLevel: 'intermediate' | 'advanced' | 'expert' = 'intermediate',
  documentText?: string
): Promise<StudyRoadmap> {
  if (!isMuseConfigured()) {
    throw new Error('Meta Muse API not configured')
  }

  const prompt = `
You are an expert learning path designer. Create a structured learning roadmap for ${topic}.

CURRENT SKILL LEVEL: ${currentSkillLevel}
TARGET SKILL LEVEL: ${targetSkillLevel}
${documentText ? `\nREFERENCE CONTENT:\n${documentText.substring(0, 10000)}` : ''}

Create a phased learning plan with clear milestones and materials.

Return ONLY valid JSON:
{
  "topic": "${topic}",
  "phases": [
    {
      "name": "Phase 1: Foundations",
      "description": "Build core understanding",
      "duration": "2-3 weeks",
      "materials": [
        "Official documentation",
        "Intro tutorials",
        "Basic exercises"
      ],
      "milestones": [
        "Understand basic concepts",
        "Complete first project",
        "Pass fundamentals quiz"
      ]
    }
  ],
  "totalEstimatedHours": 40
}

Include 3-5 phases with realistic time estimates.
`;

  try {
    const response = await callMuseWonder(prompt, 0.7)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse roadmap')
    }
    
    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Failed to generate roadmap:', error)
    throw error
  }
}

/**
 * Generate practice exercises for a topic
 */
export async function generatePracticeExercises(
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard',
  count: number = 5,
  documentText?: string
): Promise<Array<{
  id: string
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedTimeMinutes: number
  hints: string[]
  solution: string
}>> {
  if (!isMuseConfigured()) {
    throw new Error('Meta Muse API not configured')
  }

  const prompt = `
Create ${count} hands-on practice exercises for learning ${topic} at ${difficulty} difficulty level.

${documentText ? `REFERENCE CONTENT:\n${documentText.substring(0, 8000)}\n` : ''}

Generate exercises that:
1. Apply concepts from the material
2. Build practical skills
3. Prepare for real-world scenarios
4. Increase in complexity

Return ONLY valid JSON array:
[
  {
    "title": "Exercise name",
    "description": "What to build/do",
    "difficulty": "${difficulty}",
    "estimatedTimeMinutes": 30,
    "hints": ["Helpful hint 1", "Helpful hint 2"],
    "solution": "Step-by-step solution or approach"
  }
]
`;

  try {
    const response = await callMuseWonder(prompt, 0.7)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse exercises')
    }
    
    const exercises = JSON.parse(jsonMatch[0])
    
    return exercises.slice(0, count).map((ex: any, i: number) => ({
      id: `exercise-${topic.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${i}`,
      title: ex.title || `Exercise ${i + 1}`,
      description: ex.description || '',
      difficulty: ex.difficulty || difficulty,
      estimatedTimeMinutes: ex.estimatedTimeMinutes || 30,
      hints: ex.hints || [],
      solution: ex.solution || '',
    }))
  } catch (error) {
    console.error('Failed to generate exercises:', error)
    throw error
  }
}

/**
 * Calculate estimated study time
 */
function calculateStudyTime(
  summary: string,
  flashcardCount: number,
  quizQuestionCount: number
): number {
  // Reading summary: ~200 words per minute
  const wordCount = summary.split(/\s+/).length
  const readingMinutes = Math.ceil(wordCount / 200)
  
  // Flashcards: ~2 minutes per card (first pass)
  const flashcardMinutes = flashcardCount * 2
  
  // Quiz: ~2 minutes per question
  const quizMinutes = quizQuestionCount * 2
  
  // Add buffer for note-taking and reflection
  const bufferMinutes = Math.ceil((readingMinutes + flashcardMinutes + quizMinutes) * 0.2)
  
  return readingMinutes + flashcardMinutes + quizMinutes + bufferMinutes
}

/**
 * Generate study guide from multiple documents
 * Combines content from multiple sources
 */
export async function generateComprehensiveStudyGuide(
  documents: Array<{ text: string; title: string }>,
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<StudyGuide> {
  // Combine all document texts
  const combinedText = documents
    .map(doc => `=== ${doc.title} ===\n${doc.text}`)
    .join('\n\n')
  
  const sourceDocuments = documents.map(doc => doc.title)
  
  const guide = await generateStudyGuide(combinedText, topic, difficulty)
  
  // Update source documents
  guide.sourceDocuments = sourceDocuments
  guide.title = `${topic} - Comprehensive Study Guide (${documents.length} sources)`
  
  return guide
}

/**
 * Export study guide to different formats
 */
export function exportStudyGuide(
  guide: StudyGuide,
  format: 'json' | 'markdown' | 'text' = 'markdown'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(guide, null, 2)
    
    case 'markdown':
      return `# ${guide.title}

## Summary
${guide.summary}

## Key Points
${guide.keyPoints.map(point => `- ${point}`).join('\n')}

## Prerequisites
${guide.prerequisites.map(prereq => `- ${prereq}`).join('\n')}

## Learning Objectives
${guide.learningObjectives.map(obj => `- ${obj}`).join('\n')}

## Flashcards (${guide.flashcards.length})
${guide.flashcards.map((card, i) => `
### ${i + 1}. ${card.front}
**Answer**: ${card.back}
${card.hint ? `**Hint**: ${card.hint}` : ''}
`).join('\n')}

## Quiz (${guide.quiz.length} questions)
${guide.quiz.map((q, i) => `
### Question ${i + 1}: ${q.question}
${q.options.map((opt, j) => `${j === q.correctAnswerIndex ? '✓' : ' '} ${opt}`).join('\n')}

**Explanation**: ${q.explanation}
`).join('\n')}

---
Generated: ${guide.createdAt.toLocaleString()}
Estimated study time: ${guide.estimatedStudyTimeMinutes} minutes
`
    
    case 'text':
      return `${guide.title}

SUMMARY:
${guide.summary}

KEY POINTS:
${guide.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

FLASHCARDS: ${guide.flashcards.length}
QUIZ QUESTIONS: ${guide.quiz.length}
ESTIMATED STUDY TIME: ${guide.estimatedStudyTimeMinutes} minutes
`
  }
}
