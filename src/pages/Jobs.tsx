/**
 * Jobs - one list of the jobs you care about, each with its next step.
 *
 * Saved -> paste the description -> score against your resume (Resume Matcher
 * algorithm) -> tailor with Meta Muse -> approve -> you apply yourself and say so
 * -> interview practice. Ropi never applies for you; "applied" is self-reported
 * and recorded as such in History.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Kanban, Loader2, ExternalLink, FileText, Trash2, ChevronDown, CalendarClock, MapPin, Check, MessageSquare } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import { Panel } from '@/components/Panel';
import { recordReceipt } from '@/lib/receipts';
import DashboardLayout from '../components/DashboardLayout';
import { useUserId } from '../contexts/AuthContext';
import { useLoop } from '@/hooks/useLoop';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AddJobDialog } from '@/components/jobs/AddJobDialog';
import { ATSScoreCard } from '@/components/jobs/ATSScoreCard';
import { ResumeUploadDialog } from '@/components/jobs/ResumeUploadDialog';
import { JobDiscoveryFeed } from '@/components/jobs/JobDiscoveryFeed';
import { InterviewPractice } from '@/components/jobs/InterviewPractice';
import {
  getUserJobs,
  getBaseResume,
  getTailoredResume,
  scoreJobApplication,
  tailorResumeForJob,
  updateJobStatus,
  updateJobDetails,
  deleteJobApplication,
  jobLogo,
  type JobApplication,
  type Resume,
} from '@/lib/jobs/job-service';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import type { ATSScore } from '@/lib/jobs/ats-scorer';
import { fetchJobDescription, postingIdFromUrl } from '@/lib/jobs/jobseek-client';
import { moveJobTo, type Stage } from '@/lib/jobs/progress';
import type { TailorResult } from '@/lib/jobs/resume-tailor';
import { cn } from '@/lib/utils';

type Status = JobApplication['status'];

const STATUS: Record<Status, { label: string; tone: 'outline' | 'secondary' | 'warning' | 'success' | 'default' | 'destructive' }> = {
  discovered: { label: 'Saved', tone: 'outline' },
  scored: { label: 'Scored', tone: 'secondary' },
  tailored: { label: 'Tailored', tone: 'secondary' },
  reviewed: { label: 'Reviewed', tone: 'secondary' },
  approved: { label: 'Ready to apply', tone: 'warning' },
  applied: { label: 'Applied', tone: 'default' },
  interviewing: { label: 'Interviewing', tone: 'default' },
  offered: { label: 'Offer', tone: 'success' },
  rejected: { label: 'Closed', tone: 'outline' },
};

const GROUPS = {
  all: { label: 'All', has: (_: Status) => true },
  todo: { label: 'To do', has: (s: Status) => ['discovered', 'scored', 'tailored', 'reviewed', 'approved'].includes(s) },
  applied: { label: 'Applied', has: (s: Status) => s === 'applied' || s === 'interviewing' },
  done: { label: 'Done', has: (s: Status) => s === 'offered' || s === 'rejected' },
} as const;
type Group = keyof typeof GROUPS;

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function Jobs() {
  const navigate = useNavigate();
  const userId = useUserId();
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [resume, setResume] = useState<Resume | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<Group>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);

  async function load() {
    try {
      const [list, base] = await Promise.all([getUserJobs(userId), getBaseResume(userId).catch(() => null)]);
      useLoop.setState({ loadedFor: null }); // job deadlines feed the week
      setJobs(list);
      setResume(base);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your jobs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const shown = useMemo(() => jobs.filter((j) => GROUPS[group].has(j.status)), [jobs, group]);
  const savedUrls = useMemo(() => new Set(jobs.map((j) => j.job_url).filter(Boolean) as string[]), [jobs]);
  const applied = jobs.filter((j) => GROUPS.applied.has(j.status)).length;
  const scored = jobs.filter((j) => j.ats_score != null);
  const avgFit = scored.length ? Math.round(scored.reduce((s, j) => s + (j.ats_score ?? 0), 0) / scored.length) : null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Jobs"
        description="Save roles, check your fit, apply yourself."
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/jobs/kanban')}>
              <Kanban />
              Board
            </Button>
            <Button variant="ghost" onClick={() => navigate('/cv')}>
              <FileText />
              Design my CV
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus />
              Add a job
            </Button>
          </>
        }
      />

      {/* Resume: needed once, used for every score */}
      {resume !== undefined && (
        <div
          className={cn(
            'mb-6 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3',
            resume ? 'bg-card' : 'border-primary/30 bg-accent/60'
          )}
        >
          <FileText className={cn('h-5 w-5 shrink-0', resume ? 'text-muted-foreground' : 'text-primary')} />
          <p className="min-w-0 flex-1 text-[13px]">
            {resume ? (
              <>
                <span className="font-medium">Resume saved</span>
                <span className="text-muted-foreground"> · {fmtDay(resume.created_at)} · every score uses it</span>
              </>
            ) : (
              <>
                <span className="font-medium">Add your resume once.</span>
                <span className="text-muted-foreground"> Ropi scores every job against it.</span>
              </>
            )}
          </p>
          <Button size="sm" variant={resume ? 'ghost' : 'default'} onClick={() => setResumeOpen(true)}>
            {resume ? 'Update' : 'Add resume'}
          </Button>
        </div>
      )}

      {error && <p className="mb-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive">{error}</p>}

      <Panel
        id="jobs-list"
        title="Your jobs"
        meta={jobs.length ? `${jobs.length} saved · ${applied} applied${avgFit !== null ? ` · average fit ${avgFit}%` : ''}` : undefined}
        summary={jobs.length ? `${jobs.length} saved · ${applied} applied` : 'No jobs yet'}
      >
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/70" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <p className="text-[14px] font-medium">No jobs yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
              Search below or add a role. Give it a closing date and Ropi books time to apply.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 inline-flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Filter jobs">
              {(Object.keys(GROUPS) as Group[]).map((g) => {
                const n = jobs.filter((j) => GROUPS[g].has(j.status)).length;
                return (
                  <button
                    key={g}
                    role="tab"
                    aria-selected={group === g}
                    onClick={() => setGroup(g)}
                    className={cn(
                      'rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors',
                      group === g ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {GROUPS[g].label} <span className="tabular-nums text-muted-foreground">{n}</span>
                  </button>
                );
              })}
            </div>
            {shown.length === 0 ? (
              <p className="rounded-xl border border-dashed p-5 text-[13px] text-muted-foreground">Nothing in this group.</p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border">
                {shown.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    userId={userId}
                    hasResume={!!resume}
                    expanded={open === job.id}
                    onToggle={() => setOpen(open === job.id ? null : job.id)}
                    onChanged={load}
                    onNeedResume={() => setResumeOpen(true)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      <Panel id="jobs-find" className="mt-6" title="Find jobs" meta="5 job sources, one search" summary="Search roles by title and place across 5 job sources">
        <JobDiscoveryFeed userId={userId} onJobAdded={load} savedUrls={savedUrls} />
      </Panel>

      <AddJobDialog userId={userId} open={addOpen} onOpenChange={setAddOpen} onAdded={load} />
      <ResumeUploadDialog userId={userId} open={resumeOpen} onOpenChange={setResumeOpen} onSuccess={load} />
    </DashboardLayout>
  );
}

function JobRow({
  job,
  userId,
  hasResume,
  expanded,
  onToggle,
  onChanged,
  onNeedResume,
}: {
  job: JobApplication;
  userId: string;
  hasResume: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => Promise<void> | void;
  onNeedResume: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | 'score' | 'tailor' | 'save' | 'status'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [desc, setDesc] = useState(job.description ?? '');
  const [score, setScore] = useState<ATSScore | null>(null);
  const [tailor, setTailor] = useState<TailorResult | null>(null);
  const [tailored, setTailored] = useState<Resume | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [applying, setApplying] = useState(false);
  const [practice, setPractice] = useState(false);
  const s = job.status;
  const hasDesc = (job.description ?? '').trim().length > 40;

  // Tailored resume from the database when you open a tailored job later
  useEffect(() => {
    if (!expanded || tailor || !['tailored', 'reviewed', 'approved', 'applied', 'interviewing'].includes(s)) return;
    getTailoredResume(userId, job.id).then(setTailored).catch(() => undefined);
  }, [expanded, s, job.id, userId, tailor]);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<unknown>) => {
    setBusy(kind);
    setErr(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const doScore = () => {
    if (!hasResume) return onNeedResume();
    return run('score', async () => {
      const base = await getBaseResume(userId);
      if (!base) throw new Error('Add your resume first.');
      const content = typeof base.content === 'string' ? base.content : JSON.stringify(base.content);
      const r = await scoreJobApplication(job.id, { content });
      setScore(r.ats_score);
      if (!expanded) onToggle();
    });
  };
  const doTailor = () => {
    if (!hasResume) return onNeedResume();
    return run('tailor', async () => {
      const base = await getBaseResume(userId);
      if (!base) throw new Error('Add your resume first.');
      const r = await tailorResumeForJob(userId, job.id, base.id, 'normal');
      setTailor(r.tailorResult);
      setTailored(r.resume);
      if (!expanded) onToggle();
    });
  };
  const approve = () =>
    run('status', async () => {
      await updateJobStatus(job.id, 'approved');
      void recordReceipt({
        domain: 'job',
        kind: 'job.packet_approved',
        actor: 'user',
        verification: 'system_recorded',
        title: `Approved tailored resume for ${job.company}`,
        detail: 'Nothing was sent. You apply yourself, then mark it applied.',
        subject_id: job.id,
        evidence: { company: job.company, role: job.job_title, atsScore: job.ats_score ?? null, url: job.job_url ?? null },
      });
    });
  const markApplied = () =>
    run('status', async () => {
      await moveJobTo(job, 'applied', { confirmation });
      setApplying(false);
    });
  const move = (to: Stage) => run('status', () => moveJobTo(job, to));

  // Jobs saved from Job Seek can fetch their description instead of pasting it
  const postingId = postingIdFromUrl(job.job_url);
  const fetchDesc = () =>
    run('save', async () => {
      const text = await fetchJobDescription(postingId!);
      if (!text) throw new Error('Job Seek has no description for this posting. Paste it from the posting instead.');
      setDesc(text);
      await updateJobDetails(job.id, { description: text });
    });

  // The one next step for this job
  const next = (() => {
    if (!hasDesc && postingId) return { label: 'Get description', onClick: fetchDesc, busy: busy === 'save' };
    if (!hasDesc) return { label: 'Add description', onClick: onToggle };
    if (s === 'discovered') return { label: 'Score my fit', onClick: doScore, busy: busy === 'score' };
    if (s === 'scored') return { label: 'Tailor resume', onClick: doTailor, busy: busy === 'tailor' };
    if (s === 'tailored' || s === 'reviewed') return { label: 'Review', onClick: onToggle };
    if (s === 'approved') return { label: 'I applied', onClick: () => (expanded ? setApplying(true) : (onToggle(), setApplying(true))) };
    if (s === 'applied' || s === 'interviewing') return { label: 'Practice interview', onClick: () => (expanded || onToggle(), setPractice(true)) };
    return null;
  })();

  const fit = job.ats_score;

  return (
    <li className="bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <CompanyLogo src={jobLogo(job)} company={job.company} size={40} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[14px] font-medium">{job.job_title}</span>
              {fit != null && (
                <span
                  className={cn(
                    'num shrink-0 rounded-full px-1.5 py-px text-[11px] font-semibold',
                    fit >= 80 ? 'bg-success/10 text-success' : fit >= 60 ? 'bg-warning/15 text-warning-ink' : 'bg-destructive/10 text-destructive'
                  )}
                  title={`Resume fit ${fit}%: how much of what this job asks for your resume shows`}
                >
                  {fit}% fit
                </span>
              )}
            </span>
            <span className="flex flex-wrap items-center gap-x-2.5 text-[12px] text-muted-foreground">
              <span className="truncate">{job.company}</span>
              {job.location && (
                <span className="inline-flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3" />
                  {job.location}
                </span>
              )}
              {job.deadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  Closes {fmtDay(job.deadline)}
                </span>
              )}
              {job.applied_at && <span>Applied {fmtDay(job.applied_at)}</span>}
            </span>
          </span>
        </button>
        <Badge variant={STATUS[s].tone} className="hidden shrink-0 sm:inline-flex">
          {STATUS[s].label}
        </Badge>
        {next && (
          <Button size="sm" variant={s === 'approved' ? 'default' : 'outline'} disabled={!!busy} onClick={next.onClick} className="shrink-0">
            {next.busy && <Loader2 className="animate-spin" />}
            {next.label}
          </Button>
        )}
        <button onClick={onToggle} aria-label={expanded ? 'Hide details' : 'Show details'} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {err && <p className="px-4 pb-3 text-[12.5px] text-destructive">{err}</p>}

      {expanded && (
        <div className="space-y-5 border-t border-dashed bg-background/60 px-4 py-4 sm:pl-[68px]">
          {/* Description: needed to score honestly */}
          {(!hasDesc || s === 'discovered') && (
            <div>
              <label htmlFor={`desc-${job.id}`} className="mb-1.5 block text-[12.5px] font-medium">
                Job description
              </label>
              <Textarea
                id={`desc-${job.id}`}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={5}
                placeholder="Paste the job description. Ropi scores your resume against it."
                className="text-[13px]"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy === 'save' || desc.trim() === (job.description ?? '').trim()} onClick={() => run('save', () => updateJobDetails(job.id, { description: desc.trim() }))}>
                  {busy === 'save' ? <Loader2 className="animate-spin" /> : <Check />}
                  Save description
                </Button>
                {postingId && !hasDesc && (
                  <Button size="sm" variant="ghost" disabled={busy === 'save'} onClick={fetchDesc}>
                    Get it from Job Seek
                  </Button>
                )}
                {job.job_url && !postingId && (
                  <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground">
                    Open the posting to copy it
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {score && <ATSScoreCard atsScore={score} />}
          {/* Right under the score: tailor for this job (the next step once you know the gaps) */}
          {fit != null && !tailor && !tailored && hasResume && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/25 bg-accent/50 px-4 py-3">
              <p className="text-[13px]">
                <span className="font-medium">Tailor your resume for {job.company}.</span>{' '}
                <span className="text-muted-foreground">Rewritten for this job from what’s already in your resume. Check it first.</span>
              </p>
              <Button size="sm" disabled={busy === 'tailor'} onClick={doTailor}>
                {busy === 'tailor' && <Loader2 className="animate-spin" />}
                {busy === 'tailor' ? 'Tailoring' : 'Tailor my resume'}
              </Button>
            </div>
          )}
          {!score && fit != null && job.match_reasons?.length ? (
            <div>
              <div className="eyebrow mb-1.5">What would raise your fit</div>
              <ul className="list-disc space-y-1 pl-4 text-[12.5px] text-muted-foreground">
                {job.match_reasons.slice(0, 4).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Tailored resume */}
          {(tailor || tailored) && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="eyebrow">Tailored resume</div>
                {tailor && (
                  <span className={cn('text-[12px]', tailor.validation_passed ? 'text-success' : 'text-warning-ink')}>
                    {tailor.validation_passed ? 'Checks passed' : 'Check it before using'}
                  </span>
                )}
              </div>
              {tailor?.changes_made.length ? (
                <ul className="mb-2 list-disc space-y-0.5 pl-4 text-[12.5px] text-muted-foreground">
                  {tailor.changes_made.slice(0, 5).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : null}
              {tailor?.warnings.length ? (
                <p className="mb-2 rounded-lg bg-warning/10 px-3 py-2 text-[12px] text-warning-ink">{tailor.warnings.join(' ')}</p>
              ) : null}
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-card p-3 font-sans text-[12.5px] leading-relaxed">
                {tailor?.tailored_resume ?? (typeof tailored?.content === 'string' ? tailored.content : JSON.stringify(tailored?.content, null, 2))}
              </pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigator.clipboard.writeText(tailor?.tailored_resume ?? (typeof tailored?.content === 'string' ? tailored.content : ''))}
                >
                  Copy
                </Button>
                {(s === 'tailored' || s === 'reviewed') && (
                  <Button size="sm" disabled={busy === 'status'} onClick={approve}>
                    Approve
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => navigate(`/cv?job=${job.id}`)}>
                  <FileText />
                  Design and download as PDF
                </Button>
              </div>
            </div>
          )}

          {/* You apply; Ropi records that you said so */}
          {s === 'approved' && (
            <div>
              {applying ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="Confirmation number or email subject (optional)"
                    placeholder="Confirmation number or email subject (optional)"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    className="max-w-sm"
                  />
                  <Button size="sm" disabled={busy === 'status'} onClick={markApplied}>
                    {busy === 'status' && <Loader2 className="animate-spin" />}
                    Mark as applied
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setApplying(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">Apply on the company site, then press "I applied".</p>
              )}
            </div>
          )}

          {(s === 'applied' || s === 'interviewing') && (
            <div className="flex flex-wrap gap-2">
              {s === 'applied' && (
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => move('interviewing')}>
                  Got an interview
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => move('offer')}>
                Got an offer
              </Button>
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => move('closed')}>
                Didn’t get it
              </Button>
            </div>
          )}

          {practice && hasDesc && (
            <InterviewPractice jobId={job.id} jobTitle={job.job_title} company={job.company} description={job.description || ''} userId={userId} />
          )}

          <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-[12px] text-muted-foreground">
            <span>Added {fmtDay(job.created_at)}</span>
            {!['applied', 'interviewing', 'offered', 'rejected'].includes(s) && (
              <label className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Closes
                <input
                  type="date"
                  aria-label="Applications close"
                  defaultValue={job.deadline ? job.deadline.slice(0, 10) : ''}
                  onChange={(e) =>
                    void run('save', () => updateJobDetails(job.id, { deadline: e.target.value ? new Date(`${e.target.value}T17:00:00`).toISOString() : (null as unknown as undefined) }))
                  }
                  className="h-7 rounded-md border bg-card px-1.5 text-[12px] text-foreground"
                />
              </label>
            )}
            {hasDesc && !practice && (
              <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setPractice(true)}>
                <MessageSquare className="h-3.5 w-3.5" />
                Practice interview
              </button>
            )}
            {job.job_url && (
              <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                Posting
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {hasDesc && s === 'scored' && (
              <button className="hover:text-foreground" disabled={!!busy} onClick={doScore}>
                Score again
              </button>
            )}
            <button
              className="ml-auto inline-flex items-center gap-1 hover:text-destructive"
              onClick={() => {
                if (window.confirm(`Remove ${job.job_title} at ${job.company}?`)) void run('status', () => deleteJobApplication(job.id));
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
