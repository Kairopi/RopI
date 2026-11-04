/**
 * Your CV: start from the resume you already have (Muse splits it into
 * fields, word for word), edit, pick a design, tailor it to a saved job, and
 * download it free as a PDF or a Word file.
 *
 * /cv  (?job=<id> opens with that job ready to tailor)
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { CvPreview } from '@/components/cv/CvPreview';
import { ResumeUploadDialog } from '@/components/jobs/ResumeUploadDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, ChevronDown, Download, FileText, Loader2, Plus, RotateCcw, Trash2, Upload } from '@/components/icons';
import { useAuth, useUserId } from '@/contexts/AuthContext';
import { getBaseResume, getTailoredResume, getUserJobs, saveBaseResume, type JobApplication } from '@/lib/jobs/job-service';
import {
  ACCENTS,
  TEMPLATES,
  cvFromText,
  cvToText,
  downloadBlob,
  emptyCv,
  emptyEducation,
  emptyExperience,
  emptyProject,
  fileBase,
  loadCv,
  saveCv,
  tailorCv,
  writeSummary,
  type CV as CvData,
  type CvTemplate,
  type TailorChange,
} from '@/lib/cv/cv';
import { cn } from '@/lib/utils';

type Busy = null | 'fill' | 'tailor' | 'pdf' | 'docx' | 'use' | 'summary';

export default function CV() {
  const userId = useUserId();
  const { displayName } = useAuth();
  const [params] = useSearchParams();
  const saved = useMemo(() => (userId ? loadCv(userId) : null), [userId]);
  const [cv, setCv] = useState<CvData>(() => saved?.cv ?? emptyCv(displayName === 'Guest' ? '' : displayName));
  const [template, setTemplate] = useState<CvTemplate>(saved?.template ?? 'modern');
  const [accent, setAccent] = useState<string>(saved?.accent ?? ACCENTS[0]);
  const [busy, setBusy] = useState<Busy>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [jobId, setJobId] = useState<string>(params.get('job') ?? '');
  const [tailored, setTailored] = useState<{ before: CvData; changes: TailorChange[]; job: string } | null>(null);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');

  // Remember every edit in this browser
  useEffect(() => {
    if (userId) saveCv(userId, { cv, template, accent });
  }, [userId, cv, template, accent]);

  useEffect(() => {
    if (!userId) return;
    getBaseResume(userId).then((r) => setHasResume(!!r)).catch(() => setHasResume(false));
    getUserJobs(userId)
      .then((all) => setJobs(all.filter((j) => (j.description ?? '').trim().length > 40)))
      .catch(() => undefined);
    // Opened from a job: offer the resume already tailored for it
    const jid = params.get('job');
    if (jid) getTailoredResume(userId, jid).then((r) => r && setFromJob(typeof r.content === 'string' ? r.content : JSON.stringify(r.content))).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const [fromJob, setFromJob] = useState<string | null>(null);
  const jobName = jobs.find((j) => j.id === params.get('job'));
  const loadTailored = () =>
    run('fill', async () => {
      if (!fromJob) return;
      setCv(await cvFromText(fromJob));
      setTailored(null);
      setFromJob(null);
      return `Loaded the resume tailored for ${jobName?.company ?? 'that job'}. Pick a design and download.`;
    });

  const empty = !cv.summary && cv.experience.every((e) => !e.role && !e.company);

  const run = async (kind: NonNullable<Busy>, fn: () => Promise<string | void>) => {
    setBusy(kind);
    setMsg(null);
    try {
      const ok = await fn();
      if (ok) setMsg({ tone: 'ok', text: ok });
    } catch (e) {
      setMsg({ tone: 'err', text: e instanceof Error ? e.message : 'Something went wrong' });
    } finally {
      setBusy(null);
    }
  };

  const fillFromResume = () =>
    run('fill', async () => {
      const base = await getBaseResume(userId);
      if (!base) {
        setUploadOpen(true);
        return;
      }
      const text = typeof base.content === 'string' ? base.content : JSON.stringify(base.content);
      const next = await cvFromText(text);
      setCv(next);
      setTailored(null);
      return 'Filled in from your resume, word for word. Check it, then pick a design.';
    });

  const doTailor = () =>
    run('tailor', async () => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) throw new Error('Pick a saved job with a description first.');
      const r = await tailorCv(cv, { title: job.job_title, company: job.company, description: job.description });
      setTailored({ before: cv, changes: r.changes, job: `${job.job_title} at ${job.company}` });
      setCv(r.cv);
      return `Tailored for ${job.company}. Only wording and order changed; your jobs, dates and numbers are as you wrote them.`;
    });

  const download = (kind: 'pdf' | 'docx') =>
    run(kind, async () => {
      if (kind === 'pdf') {
        const { cvPdfBlob } = await import('@/lib/cv/pdf');
        downloadBlob(await cvPdfBlob(cv, template, accent), `${fileBase(cv)}.pdf`);
      } else {
        const { cvDocxBlob } = await import('@/lib/cv/docx');
        downloadBlob(await cvDocxBlob(cv, template, accent), `${fileBase(cv)}.docx`);
      }
      return `Downloaded ${fileBase(cv)}.${kind}`;
    });

  const useForJobs = () =>
    run('use', async () => {
      await saveBaseResume(userId, cvToText(cv));
      setHasResume(true);
      return 'Saved as your resume. Jobs now scores and tailors with this version.';
    });

  const set = <K extends keyof CvData>(k: K, v: CvData[K]) => setCv((c) => ({ ...c, [k]: v }));
  const setItem = <K extends 'experience' | 'education' | 'projects'>(k: K, i: number, patch: Partial<CvData[K][number]>) =>
    setCv((c) => ({ ...c, [k]: (c[k] as CvData[K][number][]).map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const removeItem = (k: 'experience' | 'education' | 'projects', i: number) => setCv((c) => ({ ...c, [k]: (c[k] as unknown[]).filter((_, j) => j !== i) }));
  const moveItem = (k: 'experience' | 'education' | 'projects', i: number, d: -1 | 1) =>
    setCv((c) => {
      const list = [...(c[k] as unknown[])];
      const j = i + d;
      if (j < 0 || j >= list.length) return c;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...c, [k]: list };
    });

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Grow"
        title="Your CV"
        description="Start from the resume you have, tailor it to a job in seconds, and download it free as PDF or Word."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => download('docx')} disabled={!!busy}>
              {busy === 'docx' ? <Loader2 className="animate-spin" /> : <FileText />}
              Word
            </Button>
            <Button onClick={() => download('pdf')} disabled={!!busy}>
              {busy === 'pdf' ? <Loader2 className="animate-spin" /> : <Download />}
              Download PDF
            </Button>
          </div>
        }
      />

      {/* Start, tailor */}
      <Card className="mb-5 grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
        <div>
          <div className="text-[13.5px] font-semibold">{empty ? 'Start from your resume' : 'Your resume'}</div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {hasResume ? 'Ropi splits the resume you saved in Jobs into these fields, copying your words.' : 'Upload a PDF or Word resume, or start typing below.'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {hasResume ? (
              <Button size="sm" variant={empty ? 'default' : 'outline'} onClick={fillFromResume} disabled={!!busy}>
                {busy === 'fill' && <Loader2 className="animate-spin" />}
                {busy === 'fill' ? 'Reading it' : empty ? 'Fill in from my resume' : 'Refill from my resume'}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)} disabled={!!busy}>
              <Upload />
              Upload a resume
            </Button>
            {!empty && (
              <Button size="sm" variant="ghost" onClick={useForJobs} disabled={!!busy} title="Jobs scores and tailors against this text">
                {busy === 'use' ? <Loader2 className="animate-spin" /> : <Check />}
                Use for job matching
              </Button>
            )}
          </div>
        </div>
        <div className="lg:border-l lg:pl-5">
          <div className="text-[13.5px] font-semibold">Tailor it to a job</div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Uses the job’s own words where your experience already shows it. Never adds jobs, dates or numbers.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <select
              aria-label="Job to tailor for"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-[13px]"
            >
              <option value="">{jobs.length ? 'Pick a saved job' : 'Save a job with a description in Jobs first'}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_title} · {j.company}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={doTailor} disabled={!!busy || !jobId || empty}>
              {busy === 'tailor' && <Loader2 className="animate-spin" />}
              {busy === 'tailor' ? 'Tailoring' : 'Tailor'}
            </Button>
          </div>
        </div>
      </Card>

      {fromJob && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-accent/60 px-4 py-3">
          <span className="flex-1 text-[13.5px]">
            You have a resume tailored for <span className="font-medium">{jobName ? `${jobName.job_title} at ${jobName.company}` : 'this job'}</span>. Put it in the designer?
          </span>
          <Button size="sm" onClick={loadTailored} disabled={!!busy}>
            {busy === 'fill' && <Loader2 className="animate-spin" />}
            Use the tailored version
          </Button>
        </div>
      )}
      {msg && (
        <p role="status" className={cn('mb-4 rounded-lg px-3.5 py-2.5 text-[13px]', msg.tone === 'ok' ? 'bg-success/[0.07] text-success' : 'bg-destructive/[0.07] text-destructive')}>
          {msg.text}
        </p>
      )}
      {tailored && (
        <div className="mb-4 rounded-xl border border-primary/25 bg-accent/60 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-1 text-[13.5px] font-medium">Tailored for {tailored.job}</span>
            <Button size="sm" variant="ghost" onClick={() => (setCv(tailored.before), setTailored(null), setMsg(null))}>
              <RotateCcw />
              Undo tailoring
            </Button>
          </div>
          {tailored.changes.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12.5px] text-muted-foreground">
              {tailored.changes.map((c, i) => (
                <li key={i}>
                  <span className="font-medium text-foreground">{c.where}:</span> {c.what}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Phones: switch between editing and the preview */}
      <div className="mb-3 inline-flex rounded-lg bg-muted p-0.5 xl:hidden" role="tablist">
        {(['edit', 'preview'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={mobileView === v}
            onClick={() => setMobileView(v)}
            className={cn('rounded-md px-3 py-1 text-[12.5px] font-medium', mobileView === v ? 'bg-card shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground')}
          >
            {v === 'edit' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:items-start">
        {/* Editor */}
        <div className={cn('space-y-4', mobileView === 'preview' && 'hidden xl:block')}>
          <Section title="About you">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Full name" value={cv.name} onChange={(v) => set('name', v)} />
              <Field label="Job title you want" value={cv.headline} onChange={(v) => set('headline', v)} placeholder="Product Manager" />
              <Field label="Email" value={cv.email} onChange={(v) => set('email', v)} type="email" />
              <Field label="Phone" value={cv.phone} onChange={(v) => set('phone', v)} />
              <Field label="City, country" value={cv.location} onChange={(v) => set('location', v)} />
              <Field label="Links (comma between)" value={cv.links.join(', ')} onChange={(v) => set('links', v.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="linkedin.com/in/you, github.com/you" />
            </div>
            <div className="mt-3 text-[12px] font-medium text-muted-foreground">
              <div className="flex items-center justify-between">
                <label htmlFor="cv-summary">Summary</label>
                {cv.experience.some((e) => e.role || e.bullets.some(Boolean)) && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      void run('summary', async () => {
                        set('summary', await writeSummary(cv));
                        return 'Summary written from your own experience. Edit it to sound like you.';
                      });
                    }}
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {busy === 'summary' && <Loader2 className="h-3 w-3 animate-spin" />}
                    {cv.summary ? 'Rewrite it for me' : 'Write it for me'}
                  </button>
                )}
              </div>
              <Textarea id="cv-summary" value={cv.summary} onChange={(e) => set('summary', e.target.value)} rows={3} className="mt-1 text-[13px]" placeholder="Two or three sentences: who you are, what you’re great at, what you want next." />
            </div>
          </Section>

          <Section title="Experience" onAdd={() => set('experience', [...cv.experience, emptyExperience()])} addLabel="Add a job">
            {cv.experience.map((e, i) => (
              <Item key={i} title={[e.role, e.company].filter(Boolean).join(' · ') || `Job ${i + 1}`} onRemove={() => removeItem('experience', i)} onUp={i > 0 ? () => moveItem('experience', i, -1) : undefined}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Role" value={e.role} onChange={(v) => setItem('experience', i, { role: v })} />
                  <Field label="Company" value={e.company} onChange={(v) => setItem('experience', i, { company: v })} />
                  <Field label="Location" value={e.location} onChange={(v) => setItem('experience', i, { location: v })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="From" value={e.start} onChange={(v) => setItem('experience', i, { start: v })} placeholder="Jan 2022" />
                    <Field label="To" value={e.end} onChange={(v) => setItem('experience', i, { end: v })} placeholder="Present" />
                  </div>
                </div>
                <label className="mt-2 block text-[12px] font-medium text-muted-foreground">
                  What you did (one per line)
                  <Textarea
                    value={e.bullets.join('\n')}
                    onChange={(ev) => setItem('experience', i, { bullets: ev.target.value.split('\n') })}
                    rows={Math.min(8, Math.max(3, e.bullets.length + 1))}
                    className="mt-1 text-[13px]"
                    placeholder="Cut onboarding time from 5 days to 2 by rewriting the setup guide"
                  />
                </label>
              </Item>
            ))}
          </Section>

          <Section title="Education" onAdd={() => set('education', [...cv.education, emptyEducation()])} addLabel="Add">
            {cv.education.map((e, i) => (
              <Item key={i} title={[e.degree, e.school].filter(Boolean).join(' · ') || `Education ${i + 1}`} onRemove={() => removeItem('education', i)} onUp={i > 0 ? () => moveItem('education', i, -1) : undefined}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Degree or course" value={e.degree} onChange={(v) => setItem('education', i, { degree: v })} />
                  <Field label="School" value={e.school} onChange={(v) => setItem('education', i, { school: v })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="From" value={e.start} onChange={(v) => setItem('education', i, { start: v })} />
                    <Field label="To" value={e.end} onChange={(v) => setItem('education', i, { end: v })} />
                  </div>
                  <Field label="Detail (optional)" value={e.detail} onChange={(v) => setItem('education', i, { detail: v })} placeholder="First class honours" />
                </div>
              </Item>
            ))}
          </Section>

          <Section title="Skills and certifications">
            <Field label="Skills (comma between)" value={cv.skills.join(', ')} onChange={(v) => set('skills', v.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="SQL, A/B testing, Stakeholder management" />
            <label className="mt-2 block text-[12px] font-medium text-muted-foreground">
              Certifications (one per line)
              <Textarea value={cv.certifications.join('\n')} onChange={(e) => set('certifications', e.target.value.split('\n'))} rows={2} className="mt-1 text-[13px]" placeholder="AWS Certified Cloud Practitioner (2025)" />
            </label>
          </Section>

          <Section title="Projects" onAdd={() => set('projects', [...cv.projects, emptyProject()])} addLabel="Add a project" defaultOpen={cv.projects.length > 0}>
            {cv.projects.length === 0 && <p className="text-[12.5px] text-muted-foreground">Side projects, a portfolio or a repo. Great for career changers.</p>}
            {cv.projects.map((p, i) => (
              <Item key={i} title={p.name || `Project ${i + 1}`} onRemove={() => removeItem('projects', i)}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Name" value={p.name} onChange={(v) => setItem('projects', i, { name: v })} />
                  <Field label="Link" value={p.link} onChange={(v) => setItem('projects', i, { link: v })} placeholder="github.com/you/project" />
                </div>
                <Field label="What it is" value={p.detail} onChange={(v) => setItem('projects', i, { detail: v })} />
              </Item>
            ))}
          </Section>
        </div>

        {/* Design + preview */}
        <div className={cn('space-y-3 xl:sticky xl:top-6', mobileView === 'edit' && 'hidden xl:block')}>
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Design">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={template === t.id}
                    onClick={() => setTemplate(t.id)}
                    title={t.note}
                    className={cn('rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors', template === t.id ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              {template !== 'classic' && (
                <div className="ml-auto flex items-center gap-1.5" role="radiogroup" aria-label="Colour">
                  {ACCENTS.map((a) => (
                    <button
                      key={a}
                      role="radio"
                      aria-checked={accent === a}
                      aria-label={`Colour ${a}`}
                      onClick={() => setAccent(a)}
                      className={cn('h-5 w-5 rounded-full border-2 transition-transform', accent === a ? 'scale-110 border-foreground' : 'border-transparent')}
                      style={{ background: a }}
                    />
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 px-1 text-[11.5px] text-muted-foreground">{TEMPLATES.find((t) => t.id === template)?.note}</p>
          </Card>
          <CvPreview cv={cv} template={template} accent={accent} />
          <p className="text-center text-[11.5px] text-muted-foreground">The PDF keeps real text, so application systems can read it. Word stays editable. Both are free.</p>
        </div>
      </div>

      <ResumeUploadDialog
        userId={userId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => {
          setHasResume(true);
          setUploadOpen(false);
          void fillFromResume();
        }}
      />
    </DashboardLayout>
  );
}

function Section({ title, children, onAdd, addLabel, defaultOpen = true }: { title: string; children: React.ReactNode; onAdd?: () => void; addLabel?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex flex-1 items-center gap-2 text-left">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />
        </button>
        {onAdd && open && (
          <Button size="sm" variant="ghost" onClick={onAdd}>
            <Plus />
            {addLabel}
          </Button>
        )}
      </div>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </Card>
  );
}

function Item({ title, children, onRemove, onUp }: { title: string; children: React.ReactNode; onRemove: () => void; onUp?: () => void }) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-muted-foreground">{title}</span>
        {onUp && (
          <button onClick={onUp} className="rounded px-1.5 text-[11.5px] text-muted-foreground hover:bg-muted hover:text-foreground" title="Move up">
            Move up
          </button>
        )}
        <button onClick={onRemove} aria-label={`Remove ${title}`} className="rounded p-1 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block text-[12px] font-medium text-muted-foreground">
      {label}
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} className="mt-1 h-9 text-[13px] text-foreground" />
    </label>
  );
}
