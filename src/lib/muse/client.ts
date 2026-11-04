/**
 * Meta Muse AI API Client
 * 
 * Wrapper for Meta's Muse AI services:
 * - Muse Wonder: Most capable model for complex reasoning
 * - Muse Spark: Multimodal reasoning & orchestration
 * - Muse Voice: Speech-to-text and text-to-speech
 * 
 * Documentation: https://meta.ai/docs/api
 */

import { callMuse } from '@/lib/api/muse';

// API Configuration - Single unified key
const MUSE_API_KEY = import.meta.env.VITE_MUSE_API_KEY;
const META_API_BASE_URL = import.meta.env.VITE_META_API_BASE_URL || 'https://api.meta.ai/v1';

// Type Definitions
export interface MuseWonderRequest {
  prompt: string;
  system?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface MuseWonderResponse {
  id: string;
  model: string;
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MuseSparkRequest {
  task: string;
  context?: Record<string, any>;
  steps?: string[];
  orchestration_mode?: 'sequential' | 'parallel' | 'adaptive';
}

export interface MuseSparkResponse {
  id: string;
  result: any;
  steps_executed: string[];
  reasoning: string;
}

export interface MuseVoiceTranscribeRequest {
  audio: Blob | string; // Audio file or base64
  language?: string;
}

export interface MuseVoiceTranscribeResponse {
  id: string;
  text: string;
  language: string;
  confidence: number;
}

export interface MuseVoiceSynthesizeRequest {
  text: string;
  voice?: 'default' | 'male' | 'female' | 'neutral';
  speed?: number;
  pitch?: number;
}

export interface MuseVoiceSynthesizeResponse {
  id: string;
  audio_url: string;
  duration_seconds: number;
}

/**
 * Muse Wonder API Client
 * Use for: Complex reasoning, job matching, resume tailoring, skill analysis
 */
export class MuseWonderClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || MUSE_API_KEY || '';
    this.baseUrl = baseUrl || META_API_BASE_URL;
  }

  /**
   * Text completion via Meta Model API chat completions (OpenAI-compatible).
   * The old /wonder/complete endpoint does not exist (returns 404).
   */
  async complete(request: MuseWonderRequest): Promise<MuseWonderResponse> {
    const content = await callMuse(request.prompt, {
      developer: request.system,
      temperature: request.temperature,
      // max_tokens includes reasoning tokens on Muse models, so never go below 4000
      maxTokens: Math.max(request.max_tokens ?? 0, 4000),
    });

    return {
      id: '',
      model: 'muse-spark-1.3',
      content,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
  }

  /**
   * Calculate job match score
   */
  async calculateJobMatch(
    jobDescription: string,
    resume: string
  ): Promise<{ score: number; reasoning: string; matched_skills: string[] }> {
    const prompt = `
Analyze this job description and resume to calculate a match score (0-100).

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resume}

Return a JSON object with:
- score: number (0-100)
- reasoning: string (why this score)
- matched_skills: string[] (skills that match)
- missing_skills: string[] (skills required but missing)
`;

    const response = await this.complete({
      prompt,
      system: 'You are an expert recruiter analyzing job-resume fit.',
      temperature: 0.3,
    });

    return JSON.parse(response.content);
  }

  /**
   * Generate tailored resume bullet points
   */
  async tailorResume(
    originalBullet: string,
    jobRequirements: string
  ): Promise<string> {
    const prompt = `
Rewrite this resume bullet point to emphasize relevance to the job requirements.
NEVER fabricate facts, dates, or metrics.
Only reorder emphasis and highlight matching keywords.

ORIGINAL:
${originalBullet}

JOB REQUIREMENTS:
${jobRequirements}

Return the rewritten bullet point.
`;

    const response = await this.complete({
      prompt,
      system: 'You are a professional resume writer. Never fabricate information.',
      temperature: 0.5,
    });

    return response.content.trim();
  }
}

/**
 * Muse Spark API Client
 * Use for: Multi-step workflows, agent orchestration, LifeShift coordination
 */
export class MuseSparkClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || MUSE_API_KEY || '';
    this.baseUrl = baseUrl || META_API_BASE_URL;
  }

  async orchestrate(request: MuseSparkRequest): Promise<MuseSparkResponse> {
    if (!this.apiKey) {
      throw new Error('Muse API key not configured. Set VITE_MUSE_API_KEY in .env');
    }

    const response = await fetch(`${this.baseUrl}/spark/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'muse-spark',
        ...request,
      }),
    });

    if (!response.ok) {
      throw new Error(`Muse Spark API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Coordinate LifeShift recalculation
   */
  async coordinateLifeShift(
    currentSchedule: any,
    newConstraint: string,
    userContext: any
  ): Promise<{ new_schedule: any; reasoning: string; changes: string[] }> {
    const response = await this.orchestrate({
      task: 'recalculate_schedule',
      context: {
        current_schedule: currentSchedule,
        new_constraint: newConstraint,
        user_context: userContext,
      },
      orchestration_mode: 'adaptive',
    });

    return response.result;
  }
}

/**
 * Muse Voice API Client
 * Use for: Voice quiz interface, hands-free learning
 */
export class MuseVoiceClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || MUSE_API_KEY || '';
    this.baseUrl = baseUrl || META_API_BASE_URL;
  }

  async transcribe(request: MuseVoiceTranscribeRequest): Promise<MuseVoiceTranscribeResponse> {
    if (!this.apiKey) {
      throw new Error('Muse API key not configured. Set VITE_MUSE_API_KEY in .env');
    }

    const formData = new FormData();
    
    if (typeof request.audio === 'string') {
      // Base64 string
      formData.append('audio', request.audio);
    } else {
      // Blob
      formData.append('audio', request.audio);
    }
    
    if (request.language) {
      formData.append('language', request.language);
    }

    const response = await fetch(`${this.baseUrl}/voice/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Muse Voice API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async synthesize(request: MuseVoiceSynthesizeRequest): Promise<MuseVoiceSynthesizeResponse> {
    if (!this.apiKey) {
      throw new Error('Muse API key not configured. Set VITE_MUSE_API_KEY in .env');
    }

    const response = await fetch(`${this.baseUrl}/voice/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Muse Voice API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

// Export singleton instances
export const museWonder = new MuseWonderClient();
export const museSpark = new MuseSparkClient();
export const museVoice = new MuseVoiceClient();

// Export default client object
export default {
  wonder: museWonder,
  spark: museSpark,
  voice: museVoice,
};
