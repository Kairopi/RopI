/**
 * Job Application Service
 * 
 * Handles job discovery, scoring, tailoring, and tracking.
 * Integrates ATS scoring, resume tailoring, and Supabase storage.
 */

import { supabase } from '../supabase';
import { calculateATSScore, type ATSScore } from './ats-scorer';
import { tailorResume, type TailorRequest, type TailorResult } from './resume-tailor';

export interface JobApplication {
  id: string;
  user_id: string;
  
  // Job details
  job_title: string;
  company: string;
  /** Company logo URL from the job source (20261104c migration) */
  company_logo?: string | null;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  job_url?: string;
  description: string;
  requirements?: string;
  
  // Scoring
  match_score?: number; // 0-100
  ats_score?: number; // 0-100
  match_reasons?: string[];
  
  // Status
  status: 'discovered' | 'scored' | 'tailored' | 'reviewed' | 'approved' | 'applied' | 'interviewing' | 'offered' | 'rejected';
  applied_at?: string;
  interview_date?: string;
  outcome?: string;
  
  // Tracking
  source?: string;
  deadline?: string;
  notes?: string;
  
  // Evidence
  confirmation_id?: string;
  evidence_screenshot?: string;
  
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  version: string;
  content: string; // JSON or plain text
  file_url?: string;
  tailored_for?: string; // job_application_id
  is_base: boolean;
  created_at: string;
}

/**
 * Create new job application
 */
export async function createJobApplication(
  userId: string,
  jobData: {
    job_title: string;
    company: string;
    description: string;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    job_url?: string;
    requirements?: string;
    source?: string;
    /** ISO timestamp the posting closes */
    deadline?: string;
    company_logo?: string;
  }
): Promise<JobApplication> {
  const { company_logo, ...rest } = jobData;
  if (company_logo) rememberLogo(jobData.job_url, jobData.company, company_logo);
  const insert = (row: Record<string, unknown>) => supabase.from('job_applications').insert(row).select().single();
  let { data, error } = await insert({ user_id: userId, ...rest, ...(company_logo ? { company_logo } : {}), status: 'discovered' });
  // Before the company_logo column exists, save without it (the logo is kept in this browser)
  if (error && company_logo && /company_logo/.test(error.message)) {
    ({ data, error } = await insert({ user_id: userId, ...rest, status: 'discovered' }));
  }

  if (error) {
    console.error('Failed to create job application:', error);
    throw new Error(`Failed to create job application: ${error.message}`);
  }

  return data;
}

const LOGOS_KEY = 'ropi-job-logos-v1';
const logoKey = (url: string | undefined, company: string) => (url || company).trim().toLowerCase();

function readLogos(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LOGOS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function rememberLogo(url: string | undefined, company: string, logo: string) {
  try {
    const all = readLogos();
    all[logoKey(url, company)] = logo;
    all[`company:${company.trim().toLowerCase()}`] = logo;
    localStorage.setItem(LOGOS_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the initial letter shows instead */
  }
}

/** The company logo for a saved job: from the database, or from when it was saved in this browser */
export function jobLogo(job: Pick<JobApplication, 'company_logo' | 'job_url' | 'company'>): string | null {
  if (job.company_logo) return job.company_logo;
  const all = readLogos();
  return all[logoKey(job.job_url, job.company)] ?? all[`company:${job.company.trim().toLowerCase()}`] ?? null;
}

/**
 * Score job application against resume
 */
export async function scoreJobApplication(
  jobId: string,
  resume: { content: string; skills?: string[]; experience?: any[] }
): Promise<{ job: JobApplication; ats_score: ATSScore }> {
  // Get job application
  const { data: job, error: jobError } = await supabase
    .from('job_applications')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (jobError || !job) {
    throw new Error(`Failed to fetch job application: ${jobError?.message}`);
  }
  
  // Calculate ATS score
  const ats_score = calculateATSScore(resume, {
    title: job.job_title,
    company: job.company,
    description: job.description,
    requirements: job.requirements,
  });
  
  // Update job with scores
  const { data: updatedJob, error: updateError } = await supabase
    .from('job_applications')
    .update({
      ats_score: ats_score.overall_score,
      match_score: ats_score.overall_score, // Same for now
      match_reasons: ats_score.evidence.recommendations,
      status: 'scored',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select()
    .single();
  
  if (updateError) {
    throw new Error(`Failed to update job scores: ${updateError.message}`);
  }
  
  return { job: updatedJob, ats_score };
}

/**
 * Tailor resume for specific job
 */
export async function tailorResumeForJob(
  userId: string,
  jobId: string,
  baseResumeId: string,
  validation_mode: 'strict' | 'normal' | 'lenient' = 'normal'
): Promise<{ resume: Resume; tailorResult: TailorResult }> {
  // Get job application
  const { data: job, error: jobError } = await supabase
    .from('job_applications')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (jobError || !job) {
    throw new Error(`Failed to fetch job application: ${jobError?.message}`);
  }
  
  // Get base resume
  const { data: baseResume, error: resumeError } = await supabase
    .from('resumes')
    .select('*')
    .eq('id', baseResumeId)
    .single();
  
  if (resumeError || !baseResume) {
    throw new Error(`Failed to fetch base resume: ${resumeError?.message}`);
  }
  
  // Parse ATS score if available
  let ats_score: ATSScore | undefined;
  if (job.ats_score) {
    // Fetch full ATS score (simplified - in production, store full score in JSONB)
    ats_score = {
      overall_score: job.ats_score,
      sub_scores: {
        keyword_match: 0,
        skills_coverage: 0,
        title_match: 0,
        section_completeness: 0,
        date_consistency: 0,
      },
      evidence: {
        matched_keywords: [],
        missing_keywords: [],
        matched_skills: [],
        missing_skills: [],
        title_matches: [],
        recommendations: job.match_reasons || [],
      },
    };
  }
  
  // Tailor resume
  const tailorResult = await tailorResume({
    original_resume: typeof baseResume.content === 'string' 
      ? baseResume.content 
      : JSON.stringify(baseResume.content),
    job_title: job.job_title,
    company: job.company,
    job_description: job.description + '\n\n' + (job.requirements || ''),
    ats_score,
    validation_mode,
  });
  
  // Save tailored resume
  const { data: tailoredResume, error: saveError } = await supabase
    .from('resumes')
    .insert({
      user_id: userId,
      version: `${job.company.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      content: tailorResult.tailored_resume,
      tailored_for: jobId,
      is_base: false,
    })
    .select()
    .single();
  
  if (saveError) {
    throw new Error(`Failed to save tailored resume: ${saveError.message}`);
  }
  
  // Update job status
  await supabase
    .from('job_applications')
    .update({
      status: 'tailored',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  
  return { resume: tailoredResume, tailorResult };
}

/**
 * Get all jobs for user
 */
export async function getUserJobs(
  userId: string,
  status?: JobApplication['status']
): Promise<JobApplication[]> {
  let query = supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Failed to fetch user jobs:', error);
    throw new Error(`Failed to fetch user jobs: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: JobApplication['status'],
  additionalData?: Partial<JobApplication>
): Promise<JobApplication> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
    ...additionalData,
  };
  
  // Set timestamp fields based on status
  if (status === 'applied' && !additionalData?.applied_at) {
    updateData.applied_at = new Date().toISOString();
  }
  
  const { data, error } = await supabase
    .from('job_applications')
    .update(updateData)
    .eq('id', jobId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`);
  }
  
  return data;
}

/**
 * Get base resume for user
 */
export async function getBaseResume(userId: string): Promise<Resume | null> {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_base', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle(); // no resume yet is a normal state, not an error

  if (error) throw new Error(`Failed to fetch base resume: ${error.message}`);
  return data;
}

/**
 * Create or update base resume
 */
export async function saveBaseResume(
  userId: string,
  content: string
): Promise<Resume> {
  // Mark all previous base resumes as non-base
  await supabase
    .from('resumes')
    .update({ is_base: false })
    .eq('user_id', userId)
    .eq('is_base', true);
  
  // Create new base resume
  const { data, error } = await supabase
    .from('resumes')
    .insert({
      user_id: userId,
      version: 'base',
      content,
      is_base: true,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to save base resume: ${error.message}`);
  }
  
  return data;
}

/** Edit job fields without changing its stage (e.g. paste the description of a saved search result) */
export async function updateJobDetails(
  jobId: string,
  patch: Partial<Pick<JobApplication, 'description' | 'requirements' | 'deadline' | 'notes' | 'location' | 'job_url'>>
): Promise<void> {
  const { error } = await supabase
    .from('job_applications')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw new Error(`Could not save the job: ${error.message}`);
}

/** The latest tailored resume saved for a job, if any */
export async function getTailoredResume(userId: string, jobId: string): Promise<Resume | null> {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', userId)
    .eq('tailored_for', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load the tailored resume: ${error.message}`);
  return data;
}

/**
 * Delete job application
 */
export async function deleteJobApplication(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('job_applications')
    .delete()
    .eq('id', jobId);
  
  if (error) {
    throw new Error(`Failed to delete job application: ${error.message}`);
  }
}

/**
 * Get job statistics
 */
export async function getJobStats(userId: string): Promise<{
  total: number;
  by_status: Record<string, number>;
  avg_ats_score: number;
  high_fit_jobs: number; // 80+
}> {
  const { data: jobs, error } = await supabase
    .from('job_applications')
    .select('status, ats_score')
    .eq('user_id', userId);
  
  if (error) {
    throw new Error(`Failed to fetch job stats: ${error.message}`);
  }
  
  const stats = {
    total: jobs?.length || 0,
    by_status: {} as Record<string, number>,
    avg_ats_score: 0,
    high_fit_jobs: 0,
  };
  
  if (!jobs || jobs.length === 0) {
    return stats;
  }
  
  // Count by status
  jobs.forEach(job => {
    stats.by_status[job.status] = (stats.by_status[job.status] || 0) + 1;
  });
  
  // Calculate average ATS score
  const scoredJobs = jobs.filter(j => j.ats_score !== null);
  if (scoredJobs.length > 0) {
    stats.avg_ats_score = Math.round(
      scoredJobs.reduce((sum, j) => sum + (j.ats_score || 0), 0) / scoredJobs.length
    );
  }
  
  // Count high-fit jobs
  stats.high_fit_jobs = jobs.filter(j => (j.ats_score || 0) >= 80).length;
  
  return stats;
}
