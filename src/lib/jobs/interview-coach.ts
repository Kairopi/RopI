/**
 * AI Interview Coach
 * 
 * Powered by Meta Muse for conversational practice
 * Realistic interview simulations with instant feedback
 */

import { callMuse, MUSE_MODELS } from '@/lib/api/muse';

/** All interview coaching goes through Meta Muse (muse-spark-1.3) */
async function ask(prompt: string): Promise<string> {
  return callMuse(prompt, { model: MUSE_MODELS.fast, reasoningEffort: 'low', maxTokens: 4000, timeoutMs: 45000 });
}
export interface InterviewQuestion {
  question: string;
  category: 'behavioral' | 'technical' | 'situational' | 'company-specific';
  difficulty: 'easy' | 'medium' | 'hard';
}

interface InterviewSession {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  responses: Array<{
    question: string;
    answer: string;
    feedback: string;
    score: number;
  }>;
  overallScore?: number;
  strengths?: string[];
  improvements?: string[];
  startedAt: string;
  completedAt?: string;
}

/**
 * Generate interview questions tailored to the job
 */
export async function generateInterviewQuestions(
  jobTitle: string,
  company: string,
  description: string,
  apiKey: string
): Promise<InterviewQuestion[]> {
  const prompt = `Generate 8 realistic interview questions for a ${jobTitle} position at ${company}.

Job Description:
${description.substring(0, 500)}

Create a mix of:
- 3 behavioral questions (STAR method)
- 2 technical questions (role-specific)
- 2 situational questions (problem-solving)
- 1 company-specific question

Return ONLY valid JSON array with this exact structure:
[
  {
    "question": "Tell me about a time when...",
    "category": "behavioral",
    "difficulty": "medium"
  }
]`;

  const text = await ask(prompt);

  // Extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || text.match(/(\[[\s\S]*?\])/);
  
  if (!jsonMatch) {
    throw new Error('Failed to parse interview questions from response');
  }

  try {
    const questions = JSON.parse(jsonMatch[1]);
    
    // Validate structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Invalid questions format');
    }

    return questions;
  } catch (error) {
    console.error('Failed to parse questions JSON:', error);
    throw new Error('Failed to generate interview questions');
  }
}

/**
 * Evaluate interview response with AI feedback
 */
export async function evaluateInterviewResponse(
  question: string,
  category: string,
  answer: string,
  jobTitle: string,
  apiKey: string
): Promise<{
  feedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
}> {
  const prompt = `You are an expert technical interviewer evaluating a candidate's response.

Question (${category}): ${question}

Candidate's Answer:
${answer}

Job Role: ${jobTitle}

Provide:
1. A score from 0-100 based on:
   - Clarity and structure (STAR method for behavioral)
   - Relevance to the role
   - Depth of examples
   - Communication skills
2. 2-3 specific strengths in their answer
3. 2-3 areas for improvement
4. Overall constructive feedback

Return ONLY valid JSON:
{
  "score": 75,
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "feedback": "Overall feedback paragraph..."
}`;

  const text = await ask(prompt);

  // Extract JSON
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || text.match(/(\{[\s\S]*?\})/);
  
  if (!jsonMatch) {
    throw new Error('Failed to parse evaluation from response');
  }

  return JSON.parse(jsonMatch[1]);
}

/**
 * Get overall session summary after all questions
 */
export async function generateSessionSummary(
  session: InterviewSession,
  apiKey: string
): Promise<{
  overallScore: number;
  strengths: string[];
  improvements: string[];
  summary: string;
}> {
  const avgScore = session.responses.reduce((sum, r) => sum + r.score, 0) / session.responses.length;
  
  const allStrengths = session.responses.flatMap(r => {
    // Extract strengths from feedback if available
    return [];
  });

  const allImprovements = session.responses.flatMap(r => {
    // Extract improvements from feedback if available
    return [];
  });

  const prompt = `Analyze this interview practice session and provide a comprehensive summary.

Job: ${session.jobTitle} at ${session.company}
Questions Answered: ${session.responses.length}
Average Score: ${avgScore.toFixed(1)}

Individual Responses:
${session.responses.map((r, i) => `
Q${i + 1}: ${r.question}
Score: ${r.score}/100
${r.feedback}
`).join('\n')}

Provide:
1. Overall performance score (0-100)
2. Top 3-5 strengths across all answers
3. Top 3-5 areas for improvement
4. A comprehensive summary paragraph

Return ONLY valid JSON:
{
  "overallScore": 75,
  "strengths": ["strength 1", "strength 2", ...],
  "improvements": ["improvement 1", "improvement 2", ...],
  "summary": "Comprehensive feedback paragraph..."
}`;

  const text = await ask(prompt);

  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || text.match(/(\{[\s\S]*?\})/);
  
  if (!jsonMatch) {
    throw new Error('Failed to parse summary from response');
  }

  return JSON.parse(jsonMatch[1]);
}

/**
 * Generate follow-up questions based on candidate's answer
 */
export async function generateFollowUp(
  originalQuestion: string,
  candidateAnswer: string,
  apiKey: string
): Promise<string> {
  const prompt = `You are an interviewer conducting a follow-up question.

Original Question: ${originalQuestion}

Candidate's Answer: ${candidateAnswer}

Generate ONE natural, probing follow-up question that:
- Digs deeper into their answer
- Clarifies any ambiguities
- Tests their depth of knowledge
- Feels conversational, not scripted

Return ONLY the follow-up question text, no JSON, no markdown.`;

  return (await ask(prompt)).trim();
}

/**
 * Common interview questions database (fallback if API fails)
 */
export const commonInterviewQuestions: Record<string, InterviewQuestion[]> = {
  'product-manager': [
    {
      question: "Tell me about a time when you had to make a difficult product decision with limited data.",
      category: 'behavioral',
      difficulty: 'hard',
    },
    {
      question: "How would you prioritize features for our product roadmap?",
      category: 'technical',
      difficulty: 'medium',
    },
    {
      question: "Walk me through how you would launch a new product feature.",
      category: 'situational',
      difficulty: 'medium',
    },
  ],
  'software-engineer': [
    {
      question: "Describe a challenging bug you encountered and how you resolved it.",
      category: 'behavioral',
      difficulty: 'medium',
    },
    {
      question: "How would you design a scalable URL shortening service?",
      category: 'technical',
      difficulty: 'hard',
    },
    {
      question: "What's your approach to code reviews?",
      category: 'situational',
      difficulty: 'easy',
    },
  ],
  'data-scientist': [
    {
      question: "Tell me about a time when your model didn't perform as expected.",
      category: 'behavioral',
      difficulty: 'medium',
    },
    {
      question: "Explain how you would build a recommendation system.",
      category: 'technical',
      difficulty: 'hard',
    },
    {
      question: "How do you communicate complex technical findings to non-technical stakeholders?",
      category: 'situational',
      difficulty: 'medium',
    },
  ],
};
