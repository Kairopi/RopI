/**
 * Practice studio: interview, present, onboard, or a hard conversation, on camera.
 * Pick your role, get three real scenarios, answer out loud, watch it back,
 * and get a review: what worked (in your words), what to change and how,
 * your delivery in numbers, what the camera shows, and a stronger version.
 *
 * /interview  (?role=Project%20Manager&job=<id>)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle2, ChevronDown, Loader2, Mic, Play, RotateCcw, ArrowRight, Volume2, X } from '@/components/icons';
import { useUserId } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useWeek } from '@/hooks/useWeek';
import { getUserJobs, type JobApplication } from '@/lib/jobs/job-service';
import { recordReceipt } from '@/lib/receipts';
import { speechManager } from '@/lib/voice/speech-manager';
import { listenWithMuse, museListenAvailable, stopMuseListening } from '@/lib/voice/muse-listen';
import { museViaProxy } from '@/lib/api/config';
import {
  KINDS,
  average,
  deliveryStats,
  loadPractice,
  makeScenarios,
  readAudio,
  reviewAnswer,
  savePractice,
  statNotes,
  transcribe,
  type Kind,
  type Review,
  type Scenario,
  type Stats,
} from '@/lib/interview/studio';
import { cn } from '@/lib/utils';

type Phase = 'setup' | 'ready' | 'recording' | 'working' | 'review';
const STEPS = ['Listening back to your answer', 'Measuring pace, fillers and pauses', 'Looking at your camera frames', 'Writing your review'];

const pickType = (types: string[]) => types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));

export default function Interview() {
  const userId = useUserId();
  const [params] = useSearchParams();
  const profile = useProfile((s) => s.profile);
  const setProfile = useProfile((s) => s.set);
  const goal = useWeek((s) => s.goal?.title ?? '');
  const [role, setRole] = useState(() => params.get('role') || profile.targetRole || '');
  const [kind, setKind] = useState<Kind>('interview');
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [jobId, setJobId] = useState(params.get('job') ?? '');
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera + recording
  const live = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [audioOnly, setAudioOnly] = useState(false);
  const recs = useRef<{ video?: MediaRecorder; audio: MediaRecorder; chunksV: Blob[]; chunksA: Blob[] } | null>(null);
  const frames = useRef<string[]>([]);
  const frameTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const liveText = useRef<Promise<string> | null>(null);

  // Result
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [past, setPast] = useState(loadPractice);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showLook, setShowLook] = useState(false);

  useEffect(() => {
    if (!userId) return;
    getUserJobs(userId)
      .then((all) => setJobs(all.filter((j) => (j.description ?? '').trim().length > 40)))
      .catch(() => undefined);
  }, [userId]);
  useEffect(() => () => stopCamera(), []);

  const scenario = scenarios?.[current] ?? null;
  const job = jobs.find((j) => j.id === jobId) ?? null;

  const start = async () => {
    setBusy(true);
    setError(null);
    if (role.trim() && !profile.targetRole) setProfile({ targetRole: role.trim() });
    try {
      const list = await makeScenarios(role || goal || 'Project Manager', kind, job ? { title: job.job_title, company: job.company, description: job.description } : null);
      setScenarios(list);
      setCurrent(0);
      setPhase('ready');
      await startCamera();
    } finally {
      setBusy(false);
    }
  };

  async function startCamera() {
    if (stream.current) return;
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: audioOnly ? false : { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setCamOn(!audioOnly);
      if (live.current && !audioOnly) {
        live.current.srcObject = stream.current;
        await live.current.play().catch(() => undefined);
      }
    } catch {
      setError('Ropi couldn’t open your camera or microphone. Allow them in the address bar, or try "Microphone only".');
    }
  }
  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamOn(false);
  }
  useEffect(() => {
    if (live.current && stream.current && camOn) {
      live.current.srcObject = stream.current;
      void live.current.play().catch(() => undefined);
    }
  }, [camOn, phase]);

  const grab = () => {
    const v = live.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    // Small frames upload and read fast; a face and posture are clear at 320 px
    c.width = 320;
    c.height = Math.round((v.videoHeight / v.videoWidth) * 320);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    frames.current.push(c.toDataURL('image/jpeg', 0.7));
  };

  const hear = () => scenario && void speechManager.speak(scenario.prompt);

  const record = async () => {
    if (!scenario) return;
    await startCamera();
    if (!stream.current) return;
    speechManager.stopSpeaking();
    for (const n of [3, 2, 1]) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCountdown(null);
    const s = stream.current;
    const audioType = pickType(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']);
    const videoType = pickType(['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']);
    const audio = new MediaRecorder(new MediaStream(s.getAudioTracks()), audioType ? { mimeType: audioType } : undefined);
    const video = camOn ? new MediaRecorder(s, videoType ? { mimeType: videoType, videoBitsPerSecond: 1_200_000 } : undefined) : undefined;
    const r = { audio, video, chunksA: [] as Blob[], chunksV: [] as Blob[] };
    audio.ondataavailable = (e) => e.data.size && r.chunksA.push(e.data);
    if (video) video.ondataavailable = (e) => e.data.size && r.chunksV.push(e.data);
    recs.current = r;
    frames.current = [];
    // Transcribe while you speak, so the words are ready the moment you stop
    liveText.current = museListenAvailable()
      ? listenWithMuse({ manual: true, maxMs: 200000, noSpeechMs: 190000, keywords: [role, 'stakeholder', 'scope', 'roadmap', 'sprint'].filter(Boolean) })
          .then((h) => h.transcript)
          .catch(() => '')
      : null;
    audio.start(500);
    video?.start(500);
    setElapsed(0);
    setPhase('recording');
    const t0 = Date.now();
    frameTimer.current = setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      setElapsed(sec);
      if (sec > 0 && sec % 3 === 0) grab();
      // Deployed, the recording is uploaded for transcription (about 4 MB max): stop just under 2 minutes
      if (sec >= (museViaProxy ? 115 : 180)) void finish();
    }, 1000);
    setTimeout(grab, 1500);
  };

  const finish = async () => {
    const r = recs.current;
    if (!r || !scenario) return;
    clearInterval(frameTimer.current);
    grab();
    const stopped = (m?: MediaRecorder) => new Promise<void>((res) => (!m || m.state === 'inactive' ? res() : ((m.onstop = () => res()), m.stop())));
    await Promise.all([stopped(r.audio), stopped(r.video)]);
    recs.current = null;
    const audioBlob = new Blob(r.chunksA, { type: r.audio.mimeType || 'audio/webm' });
    if (r.video) setVideoUrl(URL.createObjectURL(new Blob(r.chunksV, { type: r.video.mimeType || 'video/webm' })));
    // Six frames spread over the answer
    const all = frames.current;
    const pick = all.length <= 6 ? all : Array.from({ length: 6 }, (_, i) => all[Math.round((i * (all.length - 1)) / 5)]);
    setShots(pick);
    setPhase('working');
    setStep(0);
    setError(null);
    try {
      const t0 = performance.now();
      stopMuseListening();
      const [audio, heardLive] = await Promise.all([
        readAudio(audioBlob),
        liveText.current ? Promise.race([liveText.current, new Promise<string>((r) => setTimeout(() => r(''), 4000))]) : Promise.resolve(''),
      ]);
      liveText.current = null;
      // The live transcript if it caught the answer; otherwise transcribe the recording
      const text = heardLive.trim().split(/\s+/).length >= 5 ? heardLive : await transcribe(audio, [role, ...role.split(/\s+/), 'stakeholder', 'scope', 'roadmap', 'sprint'].filter(Boolean));
      console.info(`[studio] transcript in ${Math.round(performance.now() - t0)} ms`);
      if (!text.trim()) throw new Error('Ropi didn’t hear anything in that recording. Check your microphone and try again.');
      setTranscript(text);
      setStep(1);
      const st = deliveryStats(text, audio);
      setStats(st);
      setStep(pick.length ? 2 : 3);
      const rv = await reviewAnswer({ role: role || 'Project Manager', kind, scenario, transcript: text, stats: st, frames: pick });
      console.info(`[studio] review done ${Math.round(performance.now() - t0)} ms after you stopped`);
      setStep(4);
      setReview(rv);
      setPhase('review');
      const entry = { at: new Date().toISOString(), role: role || 'Project Manager', kind, title: scenario.title, scores: rv.scores, wpm: st.wpm, fillers: st.fillerTotal };
      savePractice(entry);
      setPast(loadPractice());
      void recordReceipt({
        domain: 'job',
        kind: 'job.practice_answer',
        actor: 'user',
        verification: 'system_recorded',
        title: `Practised: ${scenario.title}`,
        detail: `${KINDS.find((k) => k.id === kind)!.label} for ${entry.role}. ${average(rv.scores)}/5 overall, ${st.wpm} words a minute, ${st.fillerTotal} filler words.`,
        evidence: { scores: rv.scores, seconds: st.seconds, wpm: st.wpm, fillers: st.fillerTotal },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The review failed. Try again.');
      setPhase('ready');
    }
  };

  const again = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setReview(null);
    setStats(null);
    setTranscript('');
    setShowLook(false);
    setPhase('ready');
  };
  const next = () => {
    again();
    setCurrent((c) => Math.min((scenarios?.length ?? 1) - 1, c + 1));
  };

  const trend = useMemo(() => past.slice(0, 8).reverse(), [past]);

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Grow"
        title="Practice studio"
        description="Answer real scenarios for your role out loud, on camera. Watch it back and see exactly what to keep and what to change."
      />

      {phase === 'setup' && (
        <Card className="p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <label className="block text-[13px] font-medium">
                The role you’re going for
                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Project Manager" className="mt-1.5" />
              </label>
              <div className="mt-4 text-[13px] font-medium">What to practise</div>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="What to practise">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    role="radio"
                    aria-checked={kind === k.id}
                    onClick={() => setKind(k.id)}
                    className={cn('rounded-xl border bg-card px-3.5 py-2.5 text-left transition-colors', kind === k.id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40')}
                  >
                    <span className="block text-[13.5px] font-semibold">{k.label}</span>
                    <span className="block text-[12px] text-muted-foreground">{k.note}</span>
                  </button>
                ))}
              </div>
              {jobs.length > 0 && (
                <label className="mt-4 block text-[13px] font-medium">
                  For a job you saved (optional)
                  <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border bg-background px-2 text-[13px]">
                    <option value="">Any company</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.job_title} · {j.company}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button onClick={start} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Play />}
                  {busy ? 'Writing your scenarios' : 'Get my scenarios'}
                </Button>
                <label className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <input type="checkbox" checked={audioOnly} onChange={(e) => setAudioOnly(e.target.checked)} />
                  Microphone only (no camera)
                </label>
              </div>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-[13px] leading-relaxed">
              <div className="font-semibold">How it works</div>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
                <li>Ropi gives you three real situations this role faces.</li>
                <li>Hear the question, take a breath, and answer out loud. About two minutes.</li>
                <li>Watch it back. Your review shows what worked in your own words, what to change and how, your pace and filler words, and what the camera shows.</li>
                <li>Try again. Your scores are kept so you can see yourself improve.</li>
              </ol>
              <p className="mt-3 text-[12px] text-muted-foreground">Your video stays on this device. Only the sound and six still frames are sent for the review.</p>
            </div>
          </div>
        </Card>
      )}

      {phase !== 'setup' && scenario && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:items-start">
          {/* Left: the scenario and the camera */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {scenarios!.map((s, i) => (
                  <button
                    key={s.id}
                    disabled={phase === 'recording' || phase === 'working'}
                    onClick={() => (again(), setCurrent(i))}
                    className={cn('rounded-full border px-2.5 py-0.5 text-[12px]', i === current ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {i + 1}. {s.title}
                  </button>
                ))}
                <button onClick={() => (stopCamera(), again(), setPhase('setup'), setScenarios(null))} className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                  Change role
                </button>
              </div>
              <p className="text-[17px] font-medium leading-snug">{scenario.prompt}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <Button size="sm" variant="ghost" onClick={hear}>
                  <Volume2 />
                  Hear it
                </Button>
                <span>Aim for about {Math.round(scenario.seconds / 60) || 1} to {Math.ceil(scenario.seconds / 60) + 1} minutes.</span>
                <button onClick={() => setShowLook((v) => !v)} className="ml-auto font-medium text-primary hover:underline">
                  {showLook ? 'Hide' : 'Show'} what a strong answer covers
                </button>
              </div>
              {showLook && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] text-muted-foreground">
                  {scenario.lookFor.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="relative aspect-video bg-[hsl(225_15%_10%)]">
                {phase === 'review' && videoUrl ? (
                  <video src={videoUrl} controls className="h-full w-full -scale-x-100 object-cover" aria-label="Your answer, played back" />
                ) : camOn ? (
                  <video ref={live} muted playsInline className="h-full w-full -scale-x-100 object-cover" aria-label="Your camera" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[13px] text-white/70">
                    <Mic className="mr-2 h-5 w-5" />
                    {audioOnly ? 'Microphone only' : 'Camera off'}
                  </div>
                )}
                {countdown !== null && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[64px] font-semibold text-white">{countdown}</div>}
                {phase === 'recording' && (
                  <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-[12.5px] font-medium text-white">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                  </div>
                )}
                {phase === 'recording' && camOn && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11.5px] text-white/85">Look at the camera, not the screen</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2 p-3">
                {phase === 'ready' && (
                  <Button onClick={record}>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    Start answering
                  </Button>
                )}
                {phase === 'recording' && (
                  <Button onClick={finish} variant="destructive">
                    I’m done
                  </Button>
                )}
                {phase === 'working' && (
                  <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {STEPS[Math.min(step, STEPS.length - 1)]}
                  </span>
                )}
                {phase === 'review' && (
                  <>
                    <Button variant="outline" onClick={again}>
                      <RotateCcw />
                      Try this one again
                    </Button>
                    {current < (scenarios?.length ?? 1) - 1 && (
                      <Button onClick={next}>
                        Next scenario
                        <ArrowRight />
                      </Button>
                    )}
                  </>
                )}
              </div>
              {error && <p className="px-3 pb-3 text-[12.5px] text-destructive">{error}</p>}
            </Card>

            {trend.length > 1 && (
              <Card className="p-4">
                <div className="text-[13px] font-semibold">Your practice so far</div>
                <div className="mt-2 flex items-end gap-1.5" aria-label="Overall score for each practice, oldest first">
                  {trend.map((p, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${p.title}: ${average(p.scores)}/5`}>
                      <div className="w-full rounded-t bg-primary/80" style={{ height: `${average(p.scores) * 12}px` }} />
                      <span className="num text-[10.5px] text-muted-foreground">{average(p.scores)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">Overall score out of 5, oldest first. Practise a few times a week and watch it climb.</p>
              </Card>
            )}
          </div>

          {/* Right: the review */}
          <div className="space-y-4">
            {phase === 'working' && (
              <Card className="p-5">
                <ul className="space-y-2.5">
                  {STEPS.map((s, i) => (
                    <li key={s} className={cn('flex items-center gap-2 text-[13.5px]', i > step && 'text-muted-foreground')}>
                      {i < step ? <CheckCircle2 className="h-4 w-4 text-success" /> : i === step ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="h-4 w-4 rounded-full border" />}
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {phase !== 'review' && phase !== 'working' && (
              <Card className="p-5 text-[13.5px] leading-relaxed text-muted-foreground">
                <div className="font-semibold text-foreground">Before you start</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Sit facing a window or a lamp, camera at eye level.</li>
                  <li>Start with one sentence that answers the question, then your example, then the result.</li>
                  <li>A short silent pause sounds more confident than “um”.</li>
                </ul>
              </Card>
            )}

            {phase === 'review' && review && stats && (
              <>
                <Card className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent">
                      <span className="num text-[22px] font-semibold leading-none text-primary">{average(review.scores)}</span>
                      <span className="text-[10.5px] text-muted-foreground">out of 5</span>
                    </div>
                    <p className="text-[15px] font-medium leading-snug">{review.headline}</p>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-5">
                    {(
                      [
                        ['structure', 'Structure'],
                        ['clarity', 'Clarity'],
                        ['relevance', 'On the point'],
                        ['delivery', 'Delivery'],
                        ['presence', 'On camera'],
                      ] as const
                    ).map(([k, label]) => (
                      <div key={k}>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="num font-semibold">{review.scores[k]}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn('h-full rounded-full', review.scores[k] >= 4 ? 'bg-success' : review.scores[k] >= 3 ? 'bg-primary' : 'bg-warning')} style={{ width: `${review.scores[k] * 20}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <h2 className="text-[15px] font-semibold">How you sounded</h2>
                  <p className="text-[12px] text-muted-foreground">Measured from your recording.</p>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    {statNotes(stats).map((n) => (
                      <div key={n.label} className="rounded-xl border p-3">
                        <dt className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <span className={cn('h-2 w-2 rounded-full', n.tone === 'good' ? 'bg-success' : n.tone === 'ok' ? 'bg-warning' : 'bg-destructive')} />
                          {n.label}
                        </dt>
                        <dd className="mt-0.5 text-[14px] font-semibold">{n.value}</dd>
                        <dd className="text-[12px] text-muted-foreground">{n.note}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>

                <Card className="p-5">
                  <h2 className="text-[15px] font-semibold text-success">What worked</h2>
                  <ul className="mt-2 space-y-2.5">
                    {review.strengths.map((s, i) => (
                      <li key={i} className="text-[13.5px]">
                        {s.point}
                        {s.quote && <blockquote className="mt-1 border-l-2 border-success/50 pl-3 text-[13px] italic text-muted-foreground">“{s.quote}”</blockquote>}
                      </li>
                    ))}
                  </ul>
                  <h2 className="mt-5 text-[15px] font-semibold">What to change</h2>
                  <ul className="mt-2 space-y-3">
                    {review.improve.map((s, i) => (
                      <li key={i} className="text-[13.5px]">
                        <span className="font-medium">{s.point}</span>
                        {s.quote && <blockquote className="mt-1 border-l-2 border-warning/60 pl-3 text-[13px] italic text-muted-foreground">You said: “{s.quote}”</blockquote>}
                        {s.better && <p className="mt-1 rounded-lg bg-success/[0.06] px-3 py-2 text-[13px]">Try: {s.better}</p>}
                      </li>
                    ))}
                  </ul>
                </Card>

                {shots.length > 0 && (
                  <Card className="p-5">
                    <h2 className="text-[15px] font-semibold">What the camera shows</h2>
                    <p className="text-[12px] text-muted-foreground">Six moments from your answer. Notes are only about what can be seen.</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {shots.map((src, i) => {
                        const note = review.presence.find((p) => p.frame === i + 1)?.note;
                        return (
                          <figure key={i} className="text-[11.5px]">
                            <img src={src} alt={`Frame ${i + 1}`} className="aspect-video w-full -scale-x-100 rounded-lg object-cover" />
                            {note && <figcaption className="mt-1 leading-snug text-muted-foreground">{note}</figcaption>}
                          </figure>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {review.stronger && (
                  <Card className="p-5">
                    <h2 className="text-[15px] font-semibold">A stronger version, in your words</h2>
                    <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed">{review.stronger}</p>
                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => void speechManager.speak(review.stronger.replace(/\[your example\]/gi, 'your example'))}>
                      <Volume2 />
                      Hear it
                    </Button>
                    {review.drill && <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-[13px]"><span className="font-semibold">Next time: </span>{review.drill}</p>}
                  </Card>
                )}

                <Card className="p-4">
                  <button onClick={() => setShowTranscript((v) => !v)} className="flex w-full items-center justify-between text-[13.5px] font-semibold" aria-expanded={showTranscript}>
                    What you said
                    <ChevronDown className={cn('h-4 w-4 transition-transform', showTranscript && 'rotate-180')} />
                  </button>
                  {showTranscript && <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{transcript}</p>}
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
