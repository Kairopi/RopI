/**
 * ATS Scoring Engine (Resume Matcher Algorithm)
 * 
 * Deterministic scoring (no LLM calls) for instant job-resume matching.
 * Based on Resume Matcher's weighted component approach.
 * 
 * Weights:
 * - keyword_match: 40%
 * - skills_coverage: 20%
 * - title_match: 15%
 * - section_completeness: 15%
 * - date_consistency: 10%
 */

export interface ATSScore {
  overall_score: number; // 0-100
  sub_scores: {
    keyword_match: number;
    skills_coverage: number;
    title_match: number;
    section_completeness: number;
    date_consistency: number;
  };
  evidence: {
    matched_keywords: string[];
    missing_keywords: string[];
    matched_skills: string[];
    missing_skills: string[];
    title_matches: string[];
    recommendations: string[];
  };
}

interface Resume {
  content: string;
  skills?: string[];
  experience?: Array<{
    title: string;
    company: string;
    start_date: string;
    end_date?: string;
  }>;
  sections?: string[];
}

interface Job {
  title: string;
  description: string;
  requirements?: string;
  company: string;
}

// Component weights (total = 100%)
const WEIGHTS = {
  keyword_match: 0.40,
  skills_coverage: 0.20,
  title_match: 0.15,
  section_completeness: 0.15,
  date_consistency: 0.10,
};

// Known skills by category (matched as whole words, so "go" doesn't match "good")
const COMMON_KEYWORDS = {
  languages: ['javascript', 'typescript', 'python', 'java', 'golang', 'rust', 'c++', 'ruby', 'php', 'swift', 'kotlin', 'sql'],
  frameworks: ['react', 'vue', 'angular', 'next.js', 'express', 'django', 'flask', 'spring', 'rails'],
  databases: ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb'],
  cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'cloudformation'],
  tools: ['git', 'ci/cd', 'jenkins', 'github actions', 'jira', 'confluence', 'figma', 'excel', 'tableau', 'looker', 'amplitude', 'mixpanel'],
  methodologies: ['agile', 'scrum', 'kanban', 'tdd', 'microservices', 'rest api', 'graphql', 'okrs'],
  product: ['product management', 'roadmap', 'roadmaps', 'user research', 'a/b testing', 'experimentation', 'discovery', 'analytics', 'stakeholder management', 'go-to-market', 'pricing', 'requirements'],
  domains: ['fintech', 'payments', 'ecommerce', 'saas', 'b2b', 'b2c', 'marketplace', 'healthcare'],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-word, case-insensitive presence (handles "c++", "a/b testing", "next.js") */
const hasTerm = (text: string, term: string) => new RegExp(`(^|[^a-z0-9])${escapeRe(term.toLowerCase())}($|[^a-z0-9])`).test(text.toLowerCase());

// Words that say nothing about fit
const STOP = new Set(
  `a an and are as at be by for from has have in is it its of on or our that the their them they this to was we were will with you your
   about across also any can do does each etc get how if into it's more most must not now only other over per so some such than then these
   those through up use using very what when where which who why within without would able ability across
   role team teams work working join looking hiring candidate candidates company opportunity opportunities position responsibilities
   requirements required preferred plus strong excellent great good proven solid deep clear new well key help make
   experience experienced years year skills skill knowledge understanding including include includes day days time based
   own owning set run running write writing build building drive driving lead leading manage managing support supporting
   every everyone everything need needs needed improve improving improvement share shared sharing experiences decision decisions
   capability capabilities technical systems system world worlds million millions best high quality impact impactful ensure enable
   enabling part take want love thrive passion passionate fast environment way ways thing things many much first like just even
   around together helping global people person ideas idea value values mission vision culture benefits offer offering apply
   drives makes matter matters builds leads owns runs writes
   across closely partner partners partnering collaborate collaborating collaboration cross functional stakeholders business`
    .split(/\s+/)
    .filter(Boolean)
);

const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '');

/**
 * The terms this job's description emphasises: known skills it mentions, plus
 * its most repeated two-word phrases and words (Resume Matcher's keyword idea,
 * done without a model so it is instant and repeatable).
 */
function jobTerms(text: string, limit = 20, exclude: string[] = []): string[] {
  // The company's own name isn't something to put on your resume ("add spotify")
  const banned = new Set(exclude.flatMap((e) => e.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length > 2));
  const known = Object.values(COMMON_KEYWORDS).flat().filter((k) => hasTerm(text, k) && !banned.has(k.toLowerCase()));
  const keep = (w: string) => w.length > 2 && !STOP.has(w) && !banned.has(w) && !/^\d+\+?$/.test(w);
  const counts = new Map<string, number>();
  // Phrases never cross punctuation: "testing, SQL" is two terms, not "testing sql"
  for (const clause of text.toLowerCase().split(/[.,;:!?()\n•|]+|\s-\s|\s(?:and|or)\s/)) {
    const words = clause.replace(/[^a-z0-9+#/\s-]/g, ' ').split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      if (!keep(words[i])) continue;
      counts.set(words[i], (counts.get(words[i]) ?? 0) + 1);
      if (i + 1 < words.length && keep(words[i + 1])) {
        const bi = `${words[i]} ${words[i + 1]}`;
        counts.set(bi, (counts.get(bi) ?? 0) + 1.5);
      }
    }
  }
  const ranked = [...counts.entries()]
    // A single word has to come up at least twice to count as something the job emphasises
    .filter(([t, n]) => (t.includes(' ') ? n >= 1.5 : n >= 2))
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
  const out: string[] = [];
  for (const t of [...known, ...ranked]) {
    if (out.length >= limit) break;
    // skip a word already covered by a chosen phrase, and duplicates
    if (out.some((o) => o === t || (o.includes(' ') && o.split(' ').map(stem).includes(stem(t))))) continue;
    out.push(t);
  }
  return out;
}

/** Is the term in the resume? Whole words, ignoring plural/-ing/-ed endings */
function resumeHas(resume: string, term: string): boolean {
  if (hasTerm(resume, term)) return true;
  const tokens = resume.toLowerCase().replace(/[^a-z0-9+#/\s-]/g, ' ').split(/\s+/).map(stem);
  const parts = term.split(' ').map(stem);
  if (parts.length === 1) return tokens.includes(parts[0]);
  return tokens.some((_, i) => parts.every((p, j) => tokens[i + j] === p));
}

/**
 * Calculate keyword match score (0-100): share of the job's key terms your resume uses
 */
function calculateKeywordMatch(resume: Resume, job: Job): { score: number; matched: string[]; missing: string[] } {
  const terms = jobTerms(`${job.description} ${job.requirements || ''}`, 20, [job.company]);
  if (terms.length === 0) return { score: 50, matched: [], missing: [] }; // no description to compare against

  const matched = terms.filter((t) => resumeHas(resume.content, t));
  const missing = terms.filter((t) => !resumeHas(resume.content, t));
  return { score: (matched.length / terms.length) * 100, matched, missing };
}

/**
 * Calculate skills coverage score (0-100)
 */
function calculateSkillsCoverage(resume: Resume, job: Job): { score: number; matched: string[]; missing: string[] } {
  // Extract required skills from job description
  const jobSkills = extractSkillsFromDescription(job.description + ' ' + (job.requirements || ''));
  const resumeSkills = resume.skills || extractSkillsFromDescription(resume.content);
  
  if (jobSkills.length === 0) {
    return { score: 50, matched: [], missing: [] };
  }
  
  const matched = jobSkills.filter(skill => 
    resumeSkills.some(rSkill => 
      rSkill.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(rSkill.toLowerCase())
    )
  );
  
  const missing = jobSkills.filter(skill => 
    !resumeSkills.some(rSkill => 
      rSkill.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(rSkill.toLowerCase())
    )
  );
  
  const score = (matched.length / jobSkills.length) * 100;
  
  return { score, matched, missing };
}

/**
 * Extract skills from job description
 */
function extractSkillsFromDescription(text: string): string[] {
  return [...new Set(Object.values(COMMON_KEYWORDS).flat().filter((k) => hasTerm(text, k)))];
}

/**
 * Calculate title match score (0-100)
 */
function calculateTitleMatch(resume: Resume, job: Job): { score: number; matches: string[] } {
  const jobTitle = job.title.toLowerCase();
  const resumeContent = resume.content.toLowerCase();
  
  // Extract titles from resume experience
  const resumeTitles: string[] = [];
  if (resume.experience) {
    resumeTitles.push(...resume.experience.map(exp => exp.title.toLowerCase()));
  }
  
  // Common title keywords
  const titleKeywords = ['engineer', 'developer', 'manager', 'lead', 'senior', 'junior', 'architect', 'designer'];
  
  let score = 0;
  const matches: string[] = [];
  
  // Base title without seniority/team suffix: "Senior Product Manager - Spotify Connect" -> "product manager"
  const coreTitle = jobTitle
    .split(/\s[-–|,(]\s?|\s@\s/)[0]
    .replace(/\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|head of|associate|ii|iii)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Exact title match in resume
  if (resumeTitles.some(title => title === jobTitle) || (resumeTitles.length === 0 && hasTerm(resumeContent, jobTitle))) {
    score = 100;
    matches.push(jobTitle);
  } 
  // Partial title match
  else if (
    resumeTitles.some(title => title.includes(jobTitle) || jobTitle.includes(title)) ||
    (coreTitle.length > 3 && hasTerm(resumeContent, coreTitle))
  ) {
    score = 75;
    matches.push(jobTitle);
  }
  // Similar keywords
  else {
    const jobTitleKeywords = titleKeywords.filter(kw => jobTitle.includes(kw));
    const resumeTitleKeywords = titleKeywords.filter(kw => resumeContent.includes(kw));
    const commonKeywords = jobTitleKeywords.filter(kw => resumeTitleKeywords.includes(kw));
    
    if (commonKeywords.length > 0) {
      score = (commonKeywords.length / jobTitleKeywords.length) * 60;
      matches.push(...commonKeywords);
    } else {
      score = 30; // No match, but not zero (they're both in same field)
    }
  }
  
  return { score: Math.min(score, 100), matches };
}

/**
 * Calculate section completeness score (0-100)
 */
function calculateSectionCompleteness(resume: Resume): { score: number; present: string[]; missing: string[] } {
  const requiredSections = ['experience', 'skills', 'education'];
  const optionalSections = ['projects', 'certifications', 'achievements'];
  
  const lowerContent = resume.content.toLowerCase();
  
  const presentRequired = requiredSections.filter(section => 
    lowerContent.includes(section) || (resume.sections && resume.sections.includes(section))
  );
  
  const presentOptional = optionalSections.filter(section => 
    lowerContent.includes(section) || (resume.sections && resume.sections.includes(section))
  );
  
  const missingRequired = requiredSections.filter(section => !presentRequired.includes(section));
  
  // Required sections: 80% weight, Optional: 20%
  const requiredScore = (presentRequired.length / requiredSections.length) * 80;
  const optionalScore = (presentOptional.length / optionalSections.length) * 20;
  
  const score = requiredScore + optionalScore;
  
  return { 
    score, 
    present: [...presentRequired, ...presentOptional],
    missing: missingRequired
  };
}

/**
 * Calculate date consistency score (0-100)
 */
function calculateDateConsistency(resume: Resume): { score: number; gaps: string[] } {
  if (!resume.experience || resume.experience.length === 0) {
    // Plain-text resume: read "2021 - 2026" / "2019 – Present" ranges from the text
    const now = new Date().getFullYear();
    const ranges = [...resume.content.matchAll(/\b((?:19|20)\d{2})\s*[-–—to]+\s*((?:19|20)\d{2}|present|current|now)\b/gi)].map((m) => ({
      start: Number(m[1]),
      end: /\d/.test(m[2]) ? Number(m[2]) : now,
    }));
    if (ranges.length === 0) return { score: 50, gaps: [] }; // no dates to check
    ranges.sort((a, b) => a.start - b.start);
    const gaps: string[] = [];
    let gapYears = 0;
    for (let i = 1; i < ranges.length; i++) {
      const prevEnd = Math.max(...ranges.slice(0, i).map((r) => r.end));
      const gap = ranges[i].start - prevEnd;
      if (gap >= 1) {
        gapYears += gap;
        gaps.push(`${prevEnd} to ${ranges[i].start}`);
      }
    }
    return { score: Math.max(0, 100 - gapYears * 50), gaps };
  }
  
  // Sort by start date
  const sortedExp = [...resume.experience].sort((a, b) => 
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  
  const gaps: string[] = [];
  let totalGapMonths = 0;
  
  for (let i = 0; i < sortedExp.length - 1; i++) {
    const current = sortedExp[i];
    const next = sortedExp[i + 1];
    
    const currentEnd = current.end_date ? new Date(current.end_date) : new Date();
    const nextStart = new Date(next.start_date);
    
    const gapMonths = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (gapMonths > 6) { // Gap > 6 months
      totalGapMonths += gapMonths;
      gaps.push(
        `${currentEnd.toLocaleDateString()} to ${nextStart.toLocaleDateString()} (${Math.floor(gapMonths)} months)`
      );
    }
  }
  
  // Score decreases with larger gaps
  // 0 gaps = 100, 12 months gap = 50, 24+ months = 0
  const score = Math.max(0, 100 - (totalGapMonths / 24) * 100);
  
  return { score, gaps };
}

/**
 * Generate recommendations based on score components
 */
function generateRecommendations(
  keywordResult: { score: number; missing: string[] },
  skillsResult: { score: number; missing: string[] },
  titleResult: { score: number; matches: string[] },
  completenessResult: { score: number; missing: string[] },
  consistencyResult: { score: number; gaps: string[] }
): string[] {
  const recommendations: string[] = [];
  
  // Keyword recommendations
  if (keywordResult.score < 70 && keywordResult.missing.length > 0) {
    recommendations.push(`Add relevant keywords: ${keywordResult.missing.slice(0, 5).join(', ')}`);
  }
  
  // Skills recommendations
  if (skillsResult.score < 70 && skillsResult.missing.length > 0) {
    recommendations.push(`Highlight these skills if you have them: ${skillsResult.missing.slice(0, 5).join(', ')}`);
  }
  
  // Title recommendations
  if (titleResult.score < 60) {
    recommendations.push('Consider emphasizing relevant role titles in your experience');
  }
  
  // Completeness recommendations
  if (completenessResult.missing.length > 0) {
    recommendations.push(`Add missing sections: ${completenessResult.missing.join(', ')}`);
  }
  
  // Consistency recommendations
  if (consistencyResult.gaps.length > 0) {
    recommendations.push(`Address employment gaps: ${consistencyResult.gaps[0]}`);
  }
  
  return recommendations;
}

/**
 * Calculate overall ATS score
 */
export function calculateATSScore(resume: Resume, job: Job): ATSScore {
  // Calculate all components
  const keywordResult = calculateKeywordMatch(resume, job);
  const skillsResult = calculateSkillsCoverage(resume, job);
  const titleResult = calculateTitleMatch(resume, job);
  const completenessResult = calculateSectionCompleteness(resume);
  const consistencyResult = calculateDateConsistency(resume);
  
  // Calculate weighted overall score
  const overall_score = Math.round(
    keywordResult.score * WEIGHTS.keyword_match +
    skillsResult.score * WEIGHTS.skills_coverage +
    titleResult.score * WEIGHTS.title_match +
    completenessResult.score * WEIGHTS.section_completeness +
    consistencyResult.score * WEIGHTS.date_consistency
  );
  
  // Generate recommendations
  const recommendations = generateRecommendations(
    keywordResult,
    skillsResult,
    titleResult,
    completenessResult,
    consistencyResult
  );
  
  return {
    overall_score,
    sub_scores: {
      keyword_match: Math.round(keywordResult.score),
      skills_coverage: Math.round(skillsResult.score),
      title_match: Math.round(titleResult.score),
      section_completeness: Math.round(completenessResult.score),
      date_consistency: Math.round(consistencyResult.score),
    },
    evidence: {
      matched_keywords: keywordResult.matched,
      missing_keywords: keywordResult.missing,
      matched_skills: skillsResult.matched,
      missing_skills: skillsResult.missing,
      title_matches: titleResult.matches,
      recommendations,
    },
  };
}

/**
 * Quick match score (simplified, for filtering)
 */
export function quickMatchScore(resumeSkills: string[], jobDescription: string): number {
  const jobKeywords = extractSkillsFromDescription(jobDescription);
  const resumeKeywords = resumeSkills.map(s => s.toLowerCase());
  
  const matched = jobKeywords.filter(kw => 
    resumeKeywords.some(rk => rk.includes(kw) || kw.includes(rk))
  );
  
  if (jobKeywords.length === 0) return 50;
  
  return Math.round((matched.length / jobKeywords.length) * 100);
}
