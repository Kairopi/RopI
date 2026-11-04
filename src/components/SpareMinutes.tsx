/**
 * "Got a few minutes?" - the dead-time starter on Today.
 *
 * Pick how long you have (2, 5, 10, 20 min) and whether you can look at the
 * screen. Ropi lists up to three things that fit, from your own data, and the
 * first one starts with one tap. The choice is remembered.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Headphones, Phone } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useLoop } from '@/hooks/useLoop';
import { useWeek } from '@/hooks/useWeek';
import { planSpareTime, SPARE_OPTIONS, type SpareMode } from '@/lib/spare/plan';
import { cn } from '@/lib/utils';

const PREF = 'ropi-spare-v1';
const load = (): { minutes: number; mode: SpareMode } => {
  try {
    const p = JSON.parse(localStorage.getItem(PREF) ?? '{}');
    return { minutes: SPARE_OPTIONS.includes(p.minutes) ? p.minutes : 5, mode: p.mode === 'audio' ? 'audio' : 'screen' };
  } catch {
    return { minutes: 5, mode: 'screen' };
  }
};

export function SpareMinutes({ className, plannedAt }: { className?: string; plannedAt?: { reviews?: string; weak?: string } }) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [params, setParams] = useSearchParams();
  // Opened from a home-screen shortcut (?spare=5&mode=audio): use that, and remember it
  const [pref, setPref] = useState(() => {
    const saved = load();
    const m = Number(params.get('spare'));
    const mode = params.get('mode');
    return {
      minutes: (SPARE_OPTIONS as readonly number[]).includes(m) ? m : saved.minutes,
      mode: mode === 'audio' || mode === 'screen' ? (mode as SpareMode) : saved.mode,
    };
  });
  useEffect(() => {
    if (params.has('spare') || params.has('mode')) {
      const next = new URLSearchParams(params);
      next.delete('spare');
      next.delete('mode');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const goal = useWeek((s) => s.goal?.title ?? null);
  const dueCards = useLoop((s) => s.dueCards);
  const weakSpots = useLoop((s) => s.weakSpots);
  const jobs = useLoop((s) => s.jobs);
  const loading = useLoop((s) => s.loadedFor === null);

  useEffect(() => {
    localStorage.setItem(PREF, JSON.stringify(pref));
  }, [pref]);

  const plan = useMemo(() => {
    const p = planSpareTime({ minutes: pref.minutes, mode: pref.mode, dueCards, weakSpots, jobs, goal });
    // Also on today's plan? Say so: doing it now is a choice that frees that time, not a repeat
    const why = (id: string) =>
      id === 'reviews' && plannedAt?.reviews
        ? `Planned for ${plannedAt.reviews}. Do it now and that time frees up.`
        : /weak|voice-quiz/.test(id) && weakSpots.length && plannedAt?.weak
          ? `You practise it at ${plannedAt.weak}. This is a head start.`
          : null;
    return { ...p, steps: p.steps.map((s) => (why(s.id) ? { ...s, why: why(s.id)! } : s)) };
  }, [pref, dueCards, weakSpots, jobs, goal, plannedAt]);

  return (
    <section aria-labelledby="spare-title" className={cn('rounded-2xl border bg-card p-5 sm:p-6', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <h2 id="spare-title" className="text-[19px] font-semibold leading-tight tracking-[-0.01em]">
            Got a few minutes?
          </h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            On the train, in a queue, getting ready. Say how long you have and Ropi picks what's worth it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="How long you have" className="inline-flex rounded-lg bg-muted p-0.5">
            {SPARE_OPTIONS.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={pref.minutes === m}
                onClick={() => setPref((p) => ({ ...p, minutes: m }))}
                className={cn(
                  'h-8 rounded-md px-3 text-[13px] tabular-nums transition-colors',
                  pref.minutes === m ? 'bg-card font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m} min
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Can you look at your screen?" className="inline-flex rounded-lg bg-muted p-0.5">
            {(
              [
                ['screen', 'I can look', Phone],
                ['audio', 'Audio only', Headphones],
              ] as const
            ).map(([mode, label, Icon]) => (
              <button
                key={mode}
                role="radio"
                aria-checked={pref.mode === mode}
                onClick={() => setPref((p) => ({ ...p, mode }))}
                title={mode === 'audio' ? 'For when your eyes or hands are busy: Ropi talks, you answer out loud' : 'Reviews, quizzes and applications on screen'}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors',
                  pref.mode === mode ? 'bg-card font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t pt-4">
        {loading ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/70" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={`${pref.minutes}-${pref.mode}`}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="-mx-2"
              aria-label={`What to do in ${plan.minutes} minutes`}
            >
              {plan.steps.map((s, i) => (
                <li key={s.id}>
                  <div className={cn('flex items-center gap-3 rounded-xl px-2 py-2.5', i > 0 && 'hover:bg-muted/50')}>
                    <span className={cn('w-12 shrink-0 text-[12.5px] tabular-nums', i === 0 ? 'font-semibold text-primary' : 'text-muted-foreground')}>{s.minutes} min</span>
                    <button onClick={() => navigate(s.href)} className="min-w-0 flex-1 text-left">
                      <span className={cn('block truncate', i === 0 ? 'text-[15px] font-semibold' : 'text-[13.5px] font-medium')}>{s.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{s.why}</span>
                    </button>
                    {i === 0 ? (
                      <Button size="sm" onClick={() => navigate(s.href)} className="shrink-0">
                        Start
                        <ArrowRight />
                      </Button>
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </li>
              ))}
            </motion.ol>
          </AnimatePresence>
        )}
        {!loading && plan.steps.length > 1 && (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            {plan.used} of {plan.minutes} minutes. Do them in order, or pick one.
          </p>
        )}
      </div>
    </section>
  );
}
