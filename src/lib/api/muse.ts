/**
 * Meta Muse API Integration
 * 
 * Connects to Meta Muse Wonder for AI-powered:
 * - Quiz generation from documents
 * - Concept extraction
 * - Question generation with explanations
 */

const MUSE_API_KEY = import.meta.env.VITE_MUSE_API_KEY;
const MUSE_API_BASE_URL = import.meta.env.VITE_META_API_BASE_URL || 'https://api.meta.ai/v1';

/**
 * Models available on Meta Model API (checked with GET /v1/models).
 * muse-spark-1.3 with low reasoning effort returned a full lesson in ~8s in testing;
 * muse-wonder-1.0 took ~18s for the same request.
 */
export const MUSE_MODELS = {
  fast: 'muse-spark-1.3',
  deep: 'muse-wonder-1.0',
} as const;

export interface MuseCallOptions {
  model?: string;
  temperature?: number;
  /** Reasoning budget. Spark 1.3 accepts minimal | low | medium | high (not 'none') */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  /** Force a JSON object response (only for prompts that ask for an object, not an array) */
  json?: boolean;
  /** Includes reasoning tokens, so keep it generous */
  maxTokens?: number;
  /** Highest-precedence instructions (Muse prefers 'developer' over 'system') */
  developer?: string;
  timeoutMs?: number;
}

/**
 * Call Meta Model API chat completions (OpenAI-compatible).
 * Docs: https://dev.meta.ai/docs/cookbook/quickstart-chat-completions
 */
export async function callMuse(prompt: string, options: MuseCallOptions = {}): Promise<string> {
  if (!MUSE_API_KEY) {
    throw new Error('Meta Muse API key not configured. Please set VITE_MUSE_API_KEY in .env');
  }

  const {
    model = MUSE_MODELS.fast,
    temperature,
    reasoningEffort = 'low',
    json = false,
    maxTokens = 8000,
    developer,
    timeoutMs = 90000,
  } = options;

  const messages = [
    ...(developer ? [{ role: 'developer', content: developer }] : []),
    { role: 'user', content: prompt },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${MUSE_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MUSE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        reasoning_effort: reasoningEffort,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.error?.message || data?.message || response.statusText;
      throw new Error(`Muse API error ${response.status}: ${message}`);
    }

    const choice = data?.choices?.[0];
    const content: string | null = choice?.message?.content ?? null;

    if (!content) {
      throw new Error(
        choice?.finish_reason === 'length'
          ? 'Muse ran out of tokens before answering. Try a shorter request.'
          : 'Muse returned an empty response.'
      );
    }

    return content;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Muse API timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

interface MuseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface MuseQuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard';
  sourceCitation?: {
    documentTitle: string;
    section?: string;
    pageNumber?: number;
  };
}

/**
 * Call Meta Muse Wonder API for reasoning tasks
 */
export async function callMuseWonder(
  prompt: string,
  temperature: number = 0.7,
  options: Omit<MuseCallOptions, 'temperature'> = {}
): Promise<string> {
  try {
    return await callMuse(prompt, { temperature, ...options });
  } catch (error) {
    console.error('Error calling Meta Muse API:', error);
    throw error;
  }
}

/**
 * Extract key concepts from document content using Meta Muse
 */
export async function extractConceptsWithMuse(
  content: string,
  topic: string,
  maxConcepts: number = 20
): Promise<string[]> {
  const prompt = `
You are an expert learning systems designer. Analyze the following educational content and extract the most important concepts worth testing.

TOPIC: ${topic}

CONTENT:
${content.substring(0, 10000)} ${content.length > 10000 ? '...(truncated)' : ''}

Extract ${maxConcepts} key concepts that:
1. Are fundamental to understanding the topic
2. Are testable with clear correct/incorrect answers
3. Build upon each other logically
4. Are relevant for career applications (interviews, certifications)

Return a JSON array of concept strings:
["concept 1", "concept 2", "concept 3", ...]

Focus on concepts that matter for practical application, not trivia.
`;

  try {
    const response = await callMuseWonder(prompt);
    
    // Parse JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const concepts = JSON.parse(jsonMatch[0]);
      return concepts.slice(0, maxConcepts);
    }
    
    // Fallback: extract concepts from response text
    const lines = response.split('\n').filter(line => line.trim());
    return lines.slice(0, maxConcepts);
  } catch (error) {
    console.error('Error extracting concepts with Muse:', error);
    // Return empty array on error
    return [];
  }
}

/**
 * Generate quiz questions from documents using Meta Muse Wonder
 */
export async function generateQuizWithMuse(
  documents: Array<{ title: string; content: string; id: string }>,
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard',
  questionCount: number = 10,
  focusConcept?: string
): Promise<MuseQuizQuestion[]> {
  const combinedContent = documents.map(doc => `
=== ${doc.title} ===
${doc.content.substring(0, 5000)}
`).join('\n\n');

  const difficultyGuide = {
    easy: 'Basic recall and recognition. Direct facts from the material.',
    medium: 'Application and comprehension. Require understanding, not just memorization.',
    hard: 'Analysis and synthesis. Connect multiple concepts, edge cases, trade-offs.',
  };

  const prompt = `
You are an expert educator creating a quiz for a student learning ${topic}.

${focusConcept ? `FOCUS CONCEPT: ${focusConcept}\n` : ''}
DIFFICULTY: ${difficulty} - ${difficultyGuide[difficulty]}
NUMBER OF QUESTIONS: ${questionCount}

SOURCE MATERIALS:
${combinedContent}

Generate ${questionCount} multiple-choice quiz questions based ONLY on the source materials above.

REQUIREMENTS:
1. Each question must be grounded in the sources (include citation)
2. 4 answer choices per question (A, B, C, D)
3. Mark the correct answer
4. Provide detailed explanation referencing the source
5. Identify the key concept being tested
6. Appropriate difficulty level: ${difficulty}

Return ONLY a valid JSON array of questions:
[
  {
    "question": "What is...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswerIndex": 2,
    "explanation": "The correct answer is C because... (cite source)",
    "concept": "Lambda cold starts",
    "difficulty": "${difficulty}",
    "sourceCitation": {
      "documentTitle": "AWS Lambda Documentation",
      "section": "Performance",
      "pageNumber": 5
    }
  }
]

Make questions practical and interview-relevant. Avoid trivia.
`;

  try {
    const response = await callMuseWonder(prompt, 0.7);
    
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse quiz questions from Muse response');
    }
    
    const questions: MuseQuizQuestion[] = JSON.parse(jsonMatch[0]);
    
    // Validate and normalize questions
    return questions.slice(0, questionCount).map(q => ({
      question: q.question,
      options: q.options || [],
      correctAnswerIndex: q.correctAnswerIndex ?? 0,
      explanation: q.explanation || '',
      concept: q.concept || topic,
      difficulty: q.difficulty || difficulty,
      sourceCitation: q.sourceCitation,
    }));
  } catch (error) {
    console.error('Error generating quiz with Muse:', error);
    throw error;
  }
}

/**
 * Generate quiz from plain text using Meta Muse Wonder
 */
export async function generateQuizFromTextWithMuse(
  content: string,
  topic: string,
  difficulty: 'easy' | 'medium' | 'hard',
  questionCount: number = 10
): Promise<MuseQuizQuestion[]> {
  return generateQuizWithMuse(
    [{ title: topic, content, id: 'text-1' }],
    topic,
    difficulty,
    questionCount
  );
}

/**
 * Improve question quality using Meta Muse
 */
export async function improveQuestionWithMuse(
  question: string,
  context: string
): Promise<{
  improvedQuestion: string;
  explanation: string;
}> {
  const prompt = `
You are an expert question designer. Improve this quiz question to make it clearer, more specific, and better at testing understanding (not just recall).

ORIGINAL QUESTION:
${question}

CONTEXT:
${context}

Return JSON:
{
  "improvedQuestion": "Improved version of the question",
  "explanation": "Why this version is better"
}
`;

  try {
    const response = await callMuseWonder(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback: return original
    return {
      improvedQuestion: question,
      explanation: 'Original question',
    };
  } catch (error) {
    console.error('Error improving question with Muse:', error);
    return {
      improvedQuestion: question,
      explanation: 'Original question (improvement failed)',
    };
  }
}

/**
 * Check if Meta Muse API is configured
 */
export function isMuseConfigured(): boolean {
  return Boolean(MUSE_API_KEY && MUSE_API_KEY.length > 0);
}

/**
 * Get Muse API status
 */
export async function getMuseStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  if (!isMuseConfigured()) {
    return {
      configured: false,
      connected: false,
      error: 'Meta Muse API key not configured',
    };
  }

  try {
    // Listing models checks the key and endpoint without spending tokens
    const response = await fetch(`${MUSE_API_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${MUSE_API_KEY}` },
    });
    if (!response.ok) {
      throw new Error(`Muse API error ${response.status}`);
    }
    return {
      configured: true,
      connected: true,
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
