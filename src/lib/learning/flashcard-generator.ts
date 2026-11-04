/**
 * Flashcard Generation System - Production Grade
 * 
 * Based on SurfSense flashcard patterns + Meta Muse AI generation
 * 
 * Features:
 * - AI-powered flashcard generation from documents
 * - Quality filtering (removes trivial cards)
 * - Spaced repetition integration (FSRS)
 * - Multiple difficulty levels
 * - Concept-based organization
 * 
 * Reference: SurfSense flashcards-viewer.tsx + Meta Muse Wonder API
 */

import { callMuseWonder, isMuseConfigured } from '@/lib/api/muse'
import { createConceptCard } from '@/lib/learning/spaced-repetition'

export interface Flashcard {
  id: string
  front: string // Question
  back: string // Answer
  hint?: string // Optional hint
  topic: string
  concept: string // Key concept being tested
  difficulty: 'easy' | 'medium' | 'hard'
  source?: {
    documentTitle: string
    section?: string
    pageNumber?: number
  }
  createdAt: Date
}

export interface FlashcardDeck {
  id: string
  title: string
  topic: string
  cards: Flashcard[]
  totalCards: number
  difficulty: 'easy' | 'medium' | 'hard'
  createdAt: Date
}

/**
 * Generate flashcards from document text using Meta Muse Wonder
 * 
 * @param documentText - Source text to generate flashcards from
 * @param topic - Main topic/subject
 * @param count - Number of flashcards to generate
 * @param difficulty - Target difficulty level
 * @param documentTitle - Optional source document title
 * @returns Array of generated flashcards
 */
export async function generateFlashcards(
  documentText: string,
  topic: string,
  count: number = 10,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium',
  documentTitle?: string
): Promise<Flashcard[]> {
  if (!isMuseConfigured()) {
    throw new Error('Meta Muse API not configured. Please set VITE_MUSE_API_KEY in .env')
  }

  const difficultyGuide = {
    easy: 'Basic recall and recognition. Simple definitions and facts.',
    medium: 'Application and comprehension. Understanding concepts and relationships.',
    hard: 'Analysis and synthesis. Deep understanding, edge cases, trade-offs.',
  }

  const prompt = `
You are an expert flashcard creator using evidence-based learning science principles.

Create ${count} flashcards from the following educational content.

TOPIC: ${topic}
DIFFICULTY: ${difficulty} - ${difficultyGuide[difficulty]}
${documentTitle ? `SOURCE: ${documentTitle}` : ''}

CONTENT:
${documentText.substring(0, 15000)}${documentText.length > 15000 ? '\n...(truncated)' : ''}

FLASHCARD CREATION GUIDELINES:
1. **Front (Question)**: Clear, specific question that tests ONE concept
2. **Back (Answer)**: Concise but complete answer (2-4 sentences max)
3. **Hint (Optional)**: Small clue without giving away the answer
4. **Concept**: The key concept being tested (e.g., "Lambda cold starts", "SOLID principles")

QUALITY STANDARDS:
- ✅ Test understanding, not just recall
- ✅ Questions should be answerable from the content
- ✅ Avoid yes/no questions (except when appropriate)
- ✅ Use "What", "How", "Why" for deeper learning
- ✅ Include practical examples in answers
- ❌ NO trivial facts (dates, names unless critical)
- ❌ NO ambiguous questions
- ❌ NO overly long answers (keep concise)

DIFFICULTY SPECIFIC:
${difficulty === 'easy' ? '- Focus on definitions and basic facts\n- Direct recall questions' : ''}
${difficulty === 'medium' ? '- Focus on application and explanation\n- "How does X work?" style' : ''}
${difficulty === 'hard' ? '- Focus on analysis and comparison\n- "Why would you choose X over Y?" style' : ''}

Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "front": "What causes AWS Lambda cold starts?",
    "back": "Cold starts occur when AWS needs to initialize a new execution environment. This happens during scaling up or after inactivity. The initialization includes loading your code, dependencies, and establishing connections, which can add 100ms-10s of latency.",
    "hint": "Think about when Lambda needs to create a new container",
    "concept": "Lambda cold starts",
    "difficulty": "${difficulty}"
  }
]

Make flashcards interview-ready and career-relevant.
`;

  try {
    console.log(`🎴 Generating ${count} flashcards for topic: ${topic}`)
    
    const response = await callMuseWonder(prompt, 0.7)
    
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse flashcards from Muse response')
    }
    
    const rawCards = JSON.parse(jsonMatch[0])
    
    // Normalize and validate flashcards
    const flashcards: Flashcard[] = rawCards.slice(0, count).map((card: any, index: number) => ({
      id: `${topic.toLowerCase().replace(/\s+/g, '-')}-flashcard-${Date.now()}-${index}`,
      front: card.front || card.question || '',
      back: card.back || card.answer || '',
      hint: card.hint || undefined,
      topic,
      concept: card.concept || topic,
      difficulty: card.difficulty || difficulty,
      source: documentTitle ? {
        documentTitle,
        section: card.section,
        pageNumber: card.pageNumber,
      } : undefined,
      createdAt: new Date(),
    }))
    
    // Filter out invalid cards
    const validCards = flashcards.filter(card => 
      card.front.length > 10 && 
      card.back.length > 10 &&
      card.concept.length > 0
    )
    
    console.log(`✅ Generated ${validCards.length} valid flashcards`)
    
    if (validCards.length === 0) {
      throw new Error('No valid flashcards generated')
    }
    
    return validCards
  } catch (error) {
    console.error('❌ Flashcard generation failed:', error)
    throw error
  }
}

/**
 * Generate flashcards and create FSRS spaced repetition cards
 * Integrated workflow: Generate → Save to database
 * 
 * @param documentText - Source text
 * @param topic - Topic name
 * @param count - Number of flashcards
 * @param difficulty - Difficulty level
 * @returns Flashcards with FSRS cards ready for database
 */
export async function generateFlashcardsWithFSRS(
  documentText: string,
  topic: string,
  count: number = 10,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<Array<{
  flashcard: Flashcard
  fsrsCard: Awaited<ReturnType<typeof createConceptCard>>
}>> {
  // Generate flashcards
  const flashcards = await generateFlashcards(documentText, topic, count, difficulty)
  
  // Create FSRS cards for spaced repetition
  const cardsWithFSRS = await Promise.all(
    flashcards.map(async (flashcard) => {
      const fsrsCard = await createConceptCard(
        flashcard.concept,
        flashcard.front,
        flashcard.back,
        undefined, // no options (not multiple choice)
        undefined
      )
      
      return {
        flashcard,
        fsrsCard,
      }
    })
  )
  
  console.log(`✅ Created ${cardsWithFSRS.length} flashcards with FSRS scheduling`)
  
  return cardsWithFSRS
}

/**
 * Create flashcard deck from multiple flashcards
 * SurfSense pattern: Organize flashcards into decks
 */
export function createFlashcardDeck(
  title: string,
  topic: string,
  cards: Flashcard[],
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): FlashcardDeck {
  return {
    id: `deck-${topic.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    title,
    topic,
    cards,
    totalCards: cards.length,
    difficulty,
    createdAt: new Date(),
  }
}

/**
 * Improve existing flashcard quality using Meta Muse
 * 
 * @param flashcard - Flashcard to improve
 * @returns Improved flashcard
 */
export async function improveFlashcard(flashcard: Flashcard): Promise<Flashcard> {
  if (!isMuseConfigured()) {
    console.warn('Meta Muse not configured. Returning original flashcard.')
    return flashcard
  }

  const prompt = `
You are an expert learning designer. Improve this flashcard to make it clearer, more specific, and more effective for learning.

ORIGINAL FLASHCARD:
Front: ${flashcard.front}
Back: ${flashcard.back}
${flashcard.hint ? `Hint: ${flashcard.hint}` : ''}
Concept: ${flashcard.concept}
Difficulty: ${flashcard.difficulty}

IMPROVEMENT GUIDELINES:
1. Make the question more specific and testable
2. Ensure the answer is concise but complete
3. Add a helpful hint if missing (or improve existing)
4. Maintain the same difficulty level
5. Keep the core concept the same

Return ONLY valid JSON:
{
  "front": "Improved question",
  "back": "Improved answer",
  "hint": "Helpful hint (optional)",
  "explanation": "Why this version is better"
}
`;

  try {
    const response = await callMuseWonder(prompt, 0.6)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const improved = JSON.parse(jsonMatch[0])
      
      return {
        ...flashcard,
        front: improved.front || flashcard.front,
        back: improved.back || flashcard.back,
        hint: improved.hint || flashcard.hint,
      }
    }
    
    return flashcard
  } catch (error) {
    console.error('Failed to improve flashcard:', error)
    return flashcard
  }
}

/**
 * Generate flashcards focused on a specific concept
 * Useful for deep dives into particular topics
 */
export async function generateConceptFlashcards(
  documentText: string,
  topic: string,
  focusConcept: string,
  count: number = 5,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<Flashcard[]> {
  if (!isMuseConfigured()) {
    throw new Error('Meta Muse API not configured')
  }

  const prompt = `
Create ${count} flashcards specifically about "${focusConcept}" within the topic of ${topic}.

FOCUS CONCEPT: ${focusConcept}
DIFFICULTY: ${difficulty}

CONTENT:
${documentText.substring(0, 10000)}

All flashcards should test different aspects of "${focusConcept}":
- Definition and explanation
- Practical applications
- Common pitfalls
- Best practices
- Real-world examples

Return ONLY valid JSON array:
[
  {
    "front": "Question about ${focusConcept}",
    "back": "Answer",
    "hint": "Optional hint",
    "concept": "${focusConcept}",
    "difficulty": "${difficulty}"
  }
]
`;

  try {
    const response = await callMuseWonder(prompt, 0.7)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse concept flashcards')
    }
    
    const rawCards = JSON.parse(jsonMatch[0])
    
    return rawCards.slice(0, count).map((card: any, index: number) => ({
      id: `${focusConcept.toLowerCase().replace(/\s+/g, '-')}-flashcard-${Date.now()}-${index}`,
      front: card.front || '',
      back: card.back || '',
      hint: card.hint,
      topic,
      concept: focusConcept,
      difficulty: card.difficulty || difficulty,
      createdAt: new Date(),
    }))
  } catch (error) {
    console.error('Failed to generate concept flashcards:', error)
    throw error
  }
}

/**
 * Batch generate flashcards from multiple documents
 * Efficient for processing entire courses or books
 */
export async function batchGenerateFlashcards(
  documents: Array<{ text: string; title: string }>,
  topic: string,
  cardsPerDocument: number = 10,
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<FlashcardDeck[]> {
  const decks: FlashcardDeck[] = []
  
  for (const doc of documents) {
    try {
      console.log(`📚 Processing: ${doc.title}`)
      
      const cards = await generateFlashcards(
        doc.text,
        topic,
        cardsPerDocument,
        difficulty,
        doc.title
      )
      
      const deck = createFlashcardDeck(
        `${topic} - ${doc.title}`,
        topic,
        cards,
        difficulty
      )
      
      decks.push(deck)
      
      console.log(`✅ Created deck: ${deck.title} (${deck.totalCards} cards)`)
    } catch (error) {
      console.error(`❌ Failed to process ${doc.title}:`, error)
      // Continue with other documents
    }
  }
  
  return decks
}
