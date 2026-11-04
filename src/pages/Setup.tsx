/**
 * First run: three questions, about a minute.
 *   1. What are you working toward?   (goal, optional date)
 *   2. When are you usually free?     (one sentence, Meta Muse reads it, or presets)
 *   3. What needs doing this week?    (quick-add line, Super Productivity syntax)
 * Then Ropi plans the week. "Load a sample week" is there for people who just
 * want to look around, and it stays labelled as a sample.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ArrowRight, Check, Loader2, X, Plus } from '@/components/icons';
import { useWeek } from '@/hooks/useWeek';
import { parseAvailability, mergeWindows } from '@/lib/week/parse-availability';
import { parseQuickAdd } from '@/lib/week/quick-add';
import { weeklyFreeMinutes } from '@/lib/scheduling/plan';
import type { AvailabilityWindow } from '@/lib/scheduling/types';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const PRESETS: { label: string; windows: AvailabilityWindow[] }[] = [
  { label: 'Weeknights 7–9pm', windows: [1, 2, 3, 4, 5].map((day) => ({ day, startTime: '19:00', endTime: '21:00' })) },
  { label: 'Lunch breaks', windows: [1, 2, 3, 4, 5].map((day) => ({ day, startTime: '12:00', endTime: '13:00' })) },
  { label: 'Saturday morning', windows: [{ day: 6, startTime: '09:00', endTime: '12:00' }] },
  { label: 'Sunday afternoon', windows: [{ day: 0, startTime: '14:00', endTime: '17:00' }] },
];

const GOAL_EXAMPLES = ['Pass AWS Solutions Architect', 'Land a product manager role', 'Finish my data science course'];

const fmt = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const hr = h % 12 || 12;
  return `${hr}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
};

export default function Setup() {
  const navigate = useNavigate();
  const week = useWeek();
  const [step, setStep] = useState(0);

  // Step 1
  const [goal, setGoal] = useState(week.goal?.title ?? '');
  const [goalDate, setGoalDate] = useState(week.goal?.targetDate ?? '');

  // Step 2
  const [windows, setWindows] = useState<AvailabilityWindow[]>(week.windows);
  const [sentence, setSentence] = useState('');
  const [reading, setReading] = useState(false);
  const [parsedBy, setParsedBy] = useState<'muse' | 'rules' | null>(null);
  const [freeError, setFreeError] = useState<string | null>(null);

  // Step 3
  const [line, setLine] = useState('');
  const preview = useMemo(() => (line.trim() ? parseQuickAdd(line) : null), [line]);
  const myTasks = week.tasks.filter((t) => t.source === 'you');

  const freeHours = Math.round((weeklyFreeMinutes(windows) / 60) * 10) / 10;

  const readSentence = async () => {
    if (!sentence.trim()) return;
    setReading(true);
    setFreeError(null);
    const result = await parseAvailability(sentence);
    setReading(false);
    if (!result.windows.length) {
      setFreeError('I couldn’t find days and times in that. Try “weeknights 7 to 9, Saturday morning”.');
      return;
    }
    setWindows((w) => mergeWindows([...w, ...result.windows]));
    setParsedBy(result.parsedBy);
    setSentence('');
  };

  const togglePreset = (p: (typeof PRESETS)[number]) => {
    const has = p.windows.every((pw) => windows.some((w) => w.day === pw.day && w.startTime === pw.startTime && w.endTime === pw.endTime));
    setWindows((w) =>
      has
        ? w.filter((x) => !p.windows.some((pw) => pw.day === x.day && pw.startTime === x.startTime && pw.endTime === x.endTime))
        : mergeWindows([...w, ...p.windows])
    );
  };

  const addLine = () => {
    if (!preview) return;
    week.addTask({
      title: preview.title,
      duration: preview.duration,
      priority: preview.priority,
      deadline: preview.deadline?.toISOString(),
      category: preview.category,
      tags: preview.category === 'learning' ? ['study'] : undefined,
    });
    setLine('');
  };

  const finish = () => {
    week.setGoal(goal.trim() ? { title: goal.trim(), targetDate: goalDate || undefined } : null);
    week.setWindows(windows);
    week.finishSetup();
    navigate('/dashboard', { replace: true });
  };

  const sample = () => {
    week.loadSample();
    navigate('/dashboard', { replace: true });
  };

  const canNext = step === 0 ? true : step === 1 ? windows.length > 0 : true;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[640px] flex-col px-5 py-8 sm:py-12">
        <div className="mb-10 flex items-center justify-between">
          <Logo size={26} />
          <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-border'}`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.section
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            className="flex-1"
          >
            {step === 0 && (
              <>
                <div className="eyebrow mb-3">Step 1 of 3</div>
                <h1 className="text-[32px] font-semibold leading-[1.1]">What are you working toward?</h1>
                <p className="mt-3 text-[15px] text-muted-foreground">
                  One goal is enough. Ropi uses it to decide what matters when your week gets squeezed.
                </p>
                <div className="mt-8 space-y-3">
                  <Input
                    autoFocus
                    aria-label="Your goal"
                    placeholder="Pass AWS Solutions Architect"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setStep(1)}
                    className="h-12 text-[15px]"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {GOAL_EXAMPLES.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGoal(g)}
                        className="rounded-full border bg-card px-3 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-3 pt-3 text-[13.5px] text-muted-foreground">
                    By
                    <Input
                      type="date"
                      aria-label="Target date"
                      value={goalDate}
                      onChange={(e) => setGoalDate(e.target.value)}
                      className="h-10 w-auto"
                    />
                    <span className="text-[12px]">(optional)</span>
                  </label>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="eyebrow mb-3">Step 2 of 3</div>
                <h1 className="text-[32px] font-semibold leading-[1.1]">When are you usually free?</h1>
                <p className="mt-3 text-[15px] text-muted-foreground">
                  Your normal week, outside work. When a shift or plan changes, you tell LifeShift and only that day moves.
                </p>

                <div className="mt-8 rounded-xl border bg-card transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                  <input
                    autoFocus
                    aria-label="Describe when you are free"
                    value={sentence}
                    onChange={(e) => setSentence(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && readSentence()}
                    placeholder="Weeknights after 7, Saturday morning"
                    disabled={reading}
                    className="block h-12 w-full rounded-xl bg-transparent px-4 text-[15px] placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none"
                  />
                  <div className="flex items-center justify-between px-3 pb-2.5">
                    <span className="text-[11.5px] text-muted-foreground">
                      {parsedBy ? (parsedBy === 'muse' ? 'Read by Meta Muse' : 'Read by built-in rules') : 'Say it however you like'}
                    </span>
                    <Button size="sm" onClick={readSentence} disabled={reading || !sentence.trim()}>
                      {reading ? <Loader2 className="animate-spin" /> : <Plus />}
                      {reading ? 'Reading' : 'Add'}
                    </Button>
                  </div>
                </div>
                {freeError && <p className="mt-2 text-[12.5px] text-destructive">{freeError}</p>}

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => {
                    const on = p.windows.every((pw) => windows.some((w) => w.day === pw.day && w.startTime === pw.startTime && w.endTime === pw.endTime));
                    return (
                      <button
                        key={p.label}
                        onClick={() => togglePreset(p)}
                        aria-pressed={on}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                          on ? 'border-primary bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* The week as Ropi understood it */}
                <div className="mt-6 overflow-hidden rounded-xl border bg-card">
                  <div className="flex items-center justify-between border-b px-4 py-2.5">
                    <span className="text-[12.5px] font-medium">Your free time</span>
                    <span className="text-[12px] tabular-nums text-muted-foreground">{freeHours} h a week</span>
                  </div>
                  <div className="grid grid-cols-7 divide-x">
                    {DAY_ORDER.map((day) => {
                      const list = windows.filter((w) => w.day === day);
                      return (
                        <div key={day} className="min-h-[92px] p-1.5">
                          <div className="mb-1.5 text-center text-[11px] font-medium text-muted-foreground">{DAY_SHORT[day]}</div>
                          <div className="space-y-1">
                            {list.map((w) => (
                              <button
                                key={`${w.startTime}-${w.endTime}`}
                                title="Remove"
                                onClick={() => setWindows((all) => all.filter((x) => x !== w))}
                                className="group relative block w-full rounded-md bg-accent px-1 py-1 text-center text-[10.5px] leading-tight text-accent-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                {fmt(w.startTime)}
                                <br />
                                {fmt(w.endTime)}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="eyebrow mb-3">Step 3 of 3</div>
                <h1 className="text-[32px] font-semibold leading-[1.1]">What needs doing this week?</h1>
                <p className="mt-3 text-[15px] text-muted-foreground">
                  Type it the way you'd jot it down. Ropi adds review cards, weak spots from your quizzes and job deadlines on its own.
                </p>

                <div className="mt-8 rounded-xl border bg-card transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                  <input
                    autoFocus
                    aria-label="Add a task"
                    value={line}
                    onChange={(e) => setLine(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addLine()}
                    placeholder="Finish practice exam 45m @fri !1"
                    className="block h-12 w-full rounded-xl bg-transparent px-4 text-[15px] placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none"
                  />
                  <div className="flex min-h-[40px] flex-wrap items-center gap-1.5 px-3 pb-2.5">
                    {preview ? (
                      <>
                        <Chip>{preview.duration} min</Chip>
                        <Chip>{preview.category[0].toUpperCase() + preview.category.slice(1)}</Chip>
                        {preview.deadline && (
                          <Chip>Due {preview.deadline.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</Chip>
                        )}
                        {preview.priority === 'P1' && <Chip tone="warning">Urgent</Chip>}
                        <Button size="sm" className="ml-auto" onClick={addLine}>
                          <Plus />
                          Add
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11.5px] text-muted-foreground">
                        <span className="num">30m</span> length · <span className="num">@fri 5pm</span> due · <span className="num">!1</span> urgent ·{' '}
                        <span className="num">#career</span> area
                      </span>
                    )}
                  </div>
                </div>

                {myTasks.length > 0 && (
                  <ul className="mt-4 divide-y overflow-hidden rounded-xl border bg-card">
                    {myTasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${t.category === 'learning' ? 'bg-primary' : t.category === 'career' ? 'bg-foreground' : 'bg-muted-foreground/40'}`} />
                        <span className="min-w-0 flex-1 truncate text-[14px]">{t.title}</span>
                        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                          {t.duration} min
                          {t.deadline ? ` · ${new Date(t.deadline).toLocaleDateString('en-US', { weekday: 'short' })}` : ''}
                        </span>
                        <button aria-label={`Remove ${t.title}`} onClick={() => week.removeTask(t.id)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </motion.section>
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-between gap-3 border-t pt-5">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft />
              Back
            </Button>
          ) : !week.setupDone ? (
            <button onClick={sample} className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Just looking? Load a sample week
            </button>
          ) : (
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft />
              Cancel
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              {step === 0 && !goal.trim() ? 'Skip' : 'Continue'}
              <ArrowRight />
            </Button>
          ) : (
            <Button onClick={finish}>
              Plan my week
              <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'warning' }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ${tone === 'warning' ? 'bg-warning/15 text-warning-ink' : 'bg-accent text-accent-foreground'}`}
    >
      {children}
    </span>
  );
}
