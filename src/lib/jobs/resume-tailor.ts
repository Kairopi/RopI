/**
 * Resume Tailoring Engine (Meta Muse AI)
 * 
 * Based on ApplyPilot's approach with validation modes.
 * Uses Meta Muse Wonder for intelligent resume rewriting.
 */

import { museWonder } from '../muse/client';
import type { ATSScore } from './ats-scorer';

export interface TailorRequest {
  original_resume: string;
  job_title: string;
  company: string;
  job_description: string;
  ats_score?: ATSScore;
  validation_mode?: 'strict' | 'normal' | 'lenient';
}

export interface TailorResult {
  tailored_resume: string;
  changes_made: string[];
  keywords_added: string[];
  validation_passed: boolean;
  warnings: string[];
}

// Banned words (ApplyPilot's fabrication watchlist)
const BANNED_WORDS = [
  'revolutionized',
  'spearheaded',
  'groundbreaking',
  'disruptive',
  'synergy',
  'leverage',
  'paradigm shift',
  'game-changer',
  'best-in-class',
  'world-class',
  'cutting-edge',
  'bleeding-edge',
  'guru',
  'ninja',
  'rockstar',
  'thought leader',
  'visionary',
];

/**
 * Validate tailored resume for fabrication and banned words
 */
function validateTailoredResume(
  tailored: string,
  mode: 'strict' | 'normal' | 'lenient'
): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const lowerTailored = tailored.toLowerCase();
  
  // Check for banned words
  const foundBanned = BANNED_WORDS.filter(word => 
    lowerTailored.includes(word.toLowerCase())
  );
  
  if (foundBanned.length > 0) {
    warnings.push(`Banned words found: ${foundBanned.join(', ')}`);
    
    if (mode === 'strict') {
      return { passed: false, warnings };
    }
  }
  
  // Check for overly generic claims
  const genericPhrases = [
    'increased efficiency',
    'improved performance',
    'enhanced productivity',
    'reduced costs',
  ];
  
  const foundGeneric = genericPhrases.filter(phrase => 
    lowerTailored.includes(phrase)
  );
  
  if (foundGeneric.length > 2) {
    warnings.push('Too many generic claims without specific metrics');
    
    if (mode === 'strict') {
      return { passed: false, warnings };
    }
  }
  
  return { 
    passed: mode !== 'strict' || warnings.length === 0,
    warnings 
  };
}

/**
 * Extract changes made during tailoring
 */
function extractChanges(original: string, tailored: string): string[] {
  const changes: string[] = [];
  
  // Simple diff detection
  const originalLines = original.split('\n').filter(l => l.trim());
  const tailoredLines = tailored.split('\n').filter(l => l.trim());
  
  // Check for reordering
  if (originalLines.length === tailoredLines.length) {
    let reorderedCount = 0;
    for (let i = 0; i < originalLines.length; i++) {
      if (originalLines[i] !== tailoredLines[i]) {
        reorderedCount++;
      }
    }
    if (reorderedCount > 0) {
      changes.push(`Reordered ${reorderedCount} sections for relevance`);
    }
  }
  
  // Check for keyword additions
  const originalWords = original.toLowerCase().split(/\s+/);
  const tailoredWords = tailored.toLowerCase().split(/\s+/);
  const newWords = tailoredWords.filter(w => !originalWords.includes(w) && w.length > 3);
  
  if (newWords.length > 0) {
    changes.push(`Added ${newWords.length} relevant keywords`);
  }
  
  return changes;
}

/**
 * Tailor resume for specific job
 */
export async function tailorResume(request: TailorRequest): Promise<TailorResult> {
  const {
    original_resume,
    job_title,
    company,
    job_description,
    ats_score,
    validation_mode = 'normal',
  } = request;
  
  // Build evidence context from ATS score
  const evidenceContext = ats_score ? `
SCORING EVIDENCE:
- Overall ATS Score: ${ats_score.overall_score}/100
- Matched Keywords: ${ats_score.evidence.matched_keywords.join(', ')}
- Missing Keywords: ${ats_score.evidence.missing_keywords.slice(0, 10).join(', ')}
- Matched Skills: ${ats_score.evidence.matched_skills.join(', ')}
- Missing Skills: ${ats_score.evidence.missing_skills.slice(0, 10).join(', ')}
- Recommendations: ${ats_score.evidence.recommendations.join('. ')}
` : '';
  
  // Build tailoring prompt (ApplyPilot-inspired)
  const prompt = `You are a professional resume writer. Tailor this resume for a specific job.

ORIGINAL RESUME:
${original_resume}

TARGET JOB:
Title: ${job_title}
Company: ${company}
Description:
${job_description}

${evidenceContext}

CRITICAL RULES:
1. NEVER FABRICATE - Only rearrange and emphasize existing content
2. Preserve ALL dates, companies, titles, metrics exactly as written
3. Reorder experience sections by relevance to THIS job
4. Emphasize matching keywords naturally in bullet points
5. Keep ATS-friendly formatting (plain text, standard sections)
6. Vary bullet point verbs (Built, Designed, Implemented, Optimized, Led)

BANNED WORDS (do not use):
${BANNED_WORDS.join(', ')}

${validation_mode === 'strict' ? 'STRICT MODE: Any banned word or fabrication will cause rejection.' : ''}

Return ONLY the tailored resume as plain text. Do not add explanations or commentary.
`;
  
  try {
    // Call Meta Muse Wonder API
    const response = await museWonder.complete({
      prompt,
      system: 'You are an expert resume writer. Never fabricate information. Only reorganize and emphasize existing achievements.',
      temperature: 0.5, // Some creativity for phrasing, but not too much
      max_tokens: 2000,
    });
    
    const tailored_resume = response.content.trim();
    
    // Validate result
    const validation = validateTailoredResume(tailored_resume, validation_mode);
    
    // Extract changes
    const changes_made = extractChanges(original_resume, tailored_resume);
    
    // Extract new keywords
    const originalWords = new Set(original_resume.toLowerCase().split(/\s+/));
    const tailoredWords = tailored_resume.toLowerCase().split(/\s+/);
    const keywords_added = [...new Set(
      tailoredWords.filter(w => !originalWords.has(w) && w.length > 4)
    )].slice(0, 20); // Top 20 new keywords
    
    return {
      tailored_resume,
      changes_made,
      keywords_added,
      validation_passed: validation.passed,
      warnings: validation.warnings,
    };
  } catch (error) {
    console.error('Resume tailoring failed:', error);
    throw new Error(`Failed to tailor resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch tailor resume (for multiple jobs)
 */
export async function batchTailorResume(
  original_resume: string,
  jobs: Array<{ job_title: string; company: string; job_description: string; ats_score?: ATSScore }>,
  validation_mode: 'strict' | 'normal' | 'lenient' = 'normal'
): Promise<Array<{ job: typeof jobs[0]; result: TailorResult }>> {
  const results: Array<{ job: typeof jobs[0]; result: TailorResult }> = [];
  
  for (const job of jobs) {
    try {
      const result = await tailorResume({
        original_resume,
        job_title: job.job_title,
        company: job.company,
        job_description: job.job_description,
        ats_score: job.ats_score,
        validation_mode,
      });
      
      results.push({ job, result });
    } catch (error) {
      console.error(`Failed to tailor resume for ${job.company} - ${job.job_title}:`, error);
      // Continue with other jobs
    }
  }
  
  return results;
}

/**
 * Quick bullet point rewrite (for individual bullets)
 */
export async function rewriteBulletPoint(
  bullet: string,
  jobRequirements: string
): Promise<string> {
  const prompt = `Rewrite this resume bullet point to emphasize relevance to the job requirements.
NEVER fabricate facts, dates, or metrics.
Only reorder emphasis and highlight matching keywords.

ORIGINAL BULLET:
${bullet}

JOB REQUIREMENTS:
${jobRequirements}

Return ONLY the rewritten bullet point.`;
  
  const response = await museWonder.complete({
    prompt,
    system: 'You are a professional resume writer. Never fabricate information.',
    temperature: 0.5,
    max_tokens: 200,
  });
  
  return response.content.trim();
}
