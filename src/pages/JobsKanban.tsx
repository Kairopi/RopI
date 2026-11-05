/**
 * Board - every job by stage, drag to move it on.
 *
 * Six stages you'd actually use (Saved, Ready to apply, Applied, Interviewing,
 * Offer, Closed), not every internal status. Moving a job to "Applied" asks you
 * to confirm, because Ropi never applies for you; the move is recorded in
 * History as something you reported. Drag-and-drop pattern from Resume Matcher
 * (@dnd-kit), each card keyboard-movable too.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, type DragEndEvent, PointerSensor, KeyboardSensor, closestCorners, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Plus, GripVertical, CalendarClock, ChevronRight } from '@/components/icons';
import { PageHeader } from '@/components/PageHeader';
import DashboardLayout from '@/components/DashboardLayout';
import { useUserId } from '@/contexts/AuthContext';
import { useLoop } from '@/hooks/useLoop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddJobDialog } from '@/components/jobs/AddJobDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getUserJobs, jobLogo, type JobApplication } from '@/lib/jobs/job-service';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import { STAGES, stageOf, moveJobTo, type Stage } from '@/lib/jobs/progress';
import { cn } from '@/lib/utils';

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function JobsKanban() {
  const navigate = useNavigate();
  const userId = useUserId();
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<JobApplication | null>(null);
  const [confirmation, setConfirmation] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const load = async () => {
    try {
      const data = await getUserJobs(userId);
      useLoop.setState({ loadedFor: null });
      setJobs(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your jobs');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (userId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map((s) => [s.id, [] as JobApplication[]])) as Record<Stage, JobApplication[]>;
    for (const j of jobs) m[stageOf(j.status)].push(j);
    return m;
  }, [jobs]);

  const move = async (job: JobApplication, to: Stage, confirmationText?: string) => {
    // Optimistic: show it in the new column straight away
    const prev = jobs;
    setJobs((all) => all.map((j) => (j.id === job.id ? { ...j, status: to === 'saved' ? (j.ats_score != null ? 'scored' : 'discovered') : ({ ready: 'approved', applied: 'applied', interviewing: 'interviewing', offer: 'offered', closed: 'rejected' } as const)[to] } : j)));
    try {
      await moveJobTo(job, to, { confirmation: confirmationText });
      await load();
    } catch (e) {
      setJobs(prev);
      setError(e instanceof Error ? e.message : 'Could not move the job');
    }
  };

  const request = (job: JobApplication, to: Stage) => {
    if (stageOf(job.status) === to) return;
    // Applying happens outside Ropi: ask before recording it
    if (to === 'applied' && !job.applied_at) {
      setConfirmation('');
      setConfirm(job);
      return;
    }
    void move(job, to);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const job = jobs.find((j) => j.id === String(e.active.id));
    const to = e.over?.id ? (String(e.over.id).replace('column:', '') as Stage) : null;
    if (job && to) request(job, to);
  };

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow={
          <button onClick={() => navigate('/jobs')} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Jobs
          </button>
        }
        title="Board"
        description="Drag each job to its stage."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus />
            Add a job
          </Button>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((s) => (
            <div key={s.id} className="h-40 animate-pulse rounded-xl bg-muted/70" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
          <h3 className="text-[17px] font-semibold">No jobs yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-muted-foreground">Save roles on Jobs, or add one here.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => navigate('/jobs')}>
              Find jobs
              <ChevronRight />
            </Button>
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <Plus />
              Add a job
            </Button>
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 xl:grid xl:grid-cols-6 xl:overflow-visible">
            {STAGES.map((s) => (
              <Column key={s.id} stage={s} jobs={byStage[s.id]} onMove={request} onOpen={() => navigate('/jobs')} />
            ))}
          </div>
        </DndContext>
      )}

      {/* Confirm "I applied" */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Did you apply to {confirm?.company}?</DialogTitle>
            <DialogDescription>This records that you applied today. Ropi doesn’t send anything.</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Confirmation number or email subject (optional)"
            placeholder="Confirmation number or email subject (optional)"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Not yet
            </Button>
            <Button
              onClick={() => {
                const job = confirm!;
                setConfirm(null);
                void move(job, 'applied', confirmation);
              }}
            >
              Yes, I applied
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddJobDialog userId={userId} open={addOpen} onOpenChange={setAddOpen} onAdded={load} />
    </DashboardLayout>
  );
}

function Column({
  stage,
  jobs,
  onMove,
  onOpen,
}: {
  stage: (typeof STAGES)[number];
  jobs: JobApplication[];
  onMove: (job: JobApplication, to: Stage) => void;
  onOpen: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${stage.id}` });
  return (
    <section
      ref={setNodeRef}
      data-column={stage.id}
      aria-label={`${stage.label}, ${jobs.length} job${jobs.length === 1 ? '' : 's'}`}
      className={cn(
        'flex w-[240px] shrink-0 snap-start flex-col rounded-xl border bg-muted/40 p-2 transition-colors xl:w-auto',
        isOver && 'border-primary/40 bg-accent'
      )}
    >
      <header className="mb-2 flex items-center gap-2 px-1.5 pt-1">
        <span className={cn('h-2 w-2 rounded-full', stage.dot)} />
        <h2 className="flex-1 truncate text-[13px] font-semibold">{stage.label}</h2>
        <span className="text-[12px] tabular-nums text-muted-foreground">{jobs.length}</span>
      </header>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2">
        {jobs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 p-3 text-center text-[11.5px] text-muted-foreground">
            Drop a job here
          </div>
        ) : (
          jobs.map((j) => <JobCard key={j.id} job={j} onMove={onMove} onOpen={onOpen} />)
        )}
      </div>
    </section>
  );
}

function JobCard({ job, onMove, onOpen }: { job: JobApplication; onMove: (job: JobApplication, to: Stage) => void; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const stage = stageOf(job.status);
  const fit = job.ats_score;
  const nextStage = STAGES[STAGES.findIndex((s) => s.id === stage) + 1];

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn('group rounded-lg border bg-card p-3 shadow-[0_1px_2px_hsl(225_20%_8%/0.04)]', isDragging && 'z-10 opacity-80 shadow-float')}
    >
      <div className="flex items-start gap-2">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          <CompanyLogo src={jobLogo(job)} company={job.company} size={28} className="rounded-md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold">{job.company}</span>
            <span className="line-clamp-2 block text-[12px] leading-snug text-muted-foreground">{job.job_title}</span>
          </span>
        </button>
        <button
          {...listeners}
          {...attributes}
          aria-label={`Drag ${job.job_title} at ${job.company}`}
          className="-mr-1 cursor-grab rounded p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
        {fit != null && (
          <span className={cn('num rounded px-1.5 py-px font-semibold', fit >= 80 ? 'bg-success/10 text-success' : fit >= 60 ? 'bg-warning/15 text-warning-ink' : 'bg-destructive/10 text-destructive')}>
            {fit}% fit
          </span>
        )}
        {job.applied_at ? (
          <span>Applied {fmtDay(job.applied_at)}</span>
        ) : job.deadline ? (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            Closes {fmtDay(job.deadline)}
          </span>
        ) : null}
      </div>
      {nextStage && (
        <button
          onClick={() => onMove(job, nextStage.id)}
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground opacity-100 transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          Move to {nextStage.label}
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </article>
  );
}
