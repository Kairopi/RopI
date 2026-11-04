/**
 * Moving a job between stages, the same way everywhere (Jobs list and Board).
 *
 * Stages are what you see; statuses are what is stored. Anything from "Applied"
 * on is something you did outside Ropi, so it gets a dated, self-reported
 * entry in History. Ropi never applies for you.
 */

import { recordReceipt } from '@/lib/receipts';
import { updateJobStatus, type JobApplication } from './job-service';

export type Stage = 'saved' | 'ready' | 'applied' | 'interviewing' | 'offer' | 'closed';

export const STAGES: { id: Stage; label: string; dot: string }[] = [
  { id: 'saved', label: 'Saved', dot: 'bg-muted-foreground/60' },
  { id: 'ready', label: 'Ready to apply', dot: 'bg-warning' },
  { id: 'applied', label: 'Applied', dot: 'bg-primary' },
  { id: 'interviewing', label: 'Interviewing', dot: 'bg-primary' },
  { id: 'offer', label: 'Offer', dot: 'bg-success' },
  { id: 'closed', label: 'Closed', dot: 'bg-foreground/40' },
];

export function stageOf(status: JobApplication['status']): Stage {
  switch (status) {
    case 'approved':
      return 'ready';
    case 'applied':
      return 'applied';
    case 'interviewing':
      return 'interviewing';
    case 'offered':
      return 'offer';
    case 'rejected':
      return 'closed';
    default:
      return 'saved';
  }
}

const RECEIPT: Partial<Record<Stage, { kind: string; title: (j: JobApplication) => string }>> = {
  applied: { kind: 'job.applied', title: (j) => `You applied to ${j.company}, ${j.job_title}` },
  interviewing: { kind: 'job.interviewing', title: (j) => `Interview with ${j.company} for ${j.job_title}` },
  offer: { kind: 'job.offer', title: (j) => `Offer from ${j.company} for ${j.job_title}` },
  closed: { kind: 'job.closed', title: (j) => `${j.company}, ${j.job_title}: closed` },
};

/** Move a job to a stage. Returns the status it was stored with. */
export async function moveJobTo(job: JobApplication, to: Stage, opts: { confirmation?: string } = {}): Promise<JobApplication['status']> {
  if (stageOf(job.status) === to) return job.status;
  const now = new Date().toISOString();
  const c = opts.confirmation?.trim().slice(0, 200);

  let status: JobApplication['status'];
  let extra: Partial<JobApplication> = {};
  switch (to) {
    case 'saved':
      // Back to the start keeps any score you already have
      status = job.ats_score != null ? 'scored' : 'discovered';
      break;
    case 'ready':
      status = 'approved';
      break;
    case 'applied':
      status = 'applied';
      extra = { applied_at: job.applied_at ?? now, ...(c ? { confirmation_id: c } : {}) };
      break;
    case 'interviewing':
      status = 'interviewing';
      extra = { interview_date: now, ...(job.applied_at ? {} : { applied_at: now }) };
      break;
    case 'offer':
      status = 'offered';
      extra = { outcome: 'offer' } as Partial<JobApplication>;
      break;
    case 'closed':
      status = 'rejected';
      extra = { outcome: 'no' } as Partial<JobApplication>;
      break;
  }

  await updateJobStatus(job.id, status, extra);

  const r = RECEIPT[to];
  if (r) {
    void recordReceipt({
      domain: 'job',
      kind: r.kind,
      actor: 'user',
      verification: 'self_reported',
      title: r.title(job),
      detail: to === 'applied' ? (c ? `Confirmation: ${c}` : 'No confirmation added') : 'You moved it on your job board',
      subject_id: job.id,
      evidence: { company: job.company, role: job.job_title, url: job.job_url ?? null, from: stageOf(job.status), to, ...(c ? { confirmation: c } : {}) },
    });
  }
  return status;
}
