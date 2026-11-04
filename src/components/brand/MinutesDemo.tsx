/**
 * MinutesDemo: the "Got a few minutes?" card from Today, looping on the login
 * screen. Three real moments (getting dressed, on the platform, on the bus)
 * and what Ropi picks for each. Static if reduced motion is on.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Headphones } from '@/components/icons';

const MOMENTS = [
  {
    where: 'Getting dressed',
    minutes: 2,
    audio: true,
    steps: [{ m: 2, t: 'Cold starts, explained', w: 'You missed it twice. Ropi says it out loud.' }],
  },
  {
    where: 'On the platform',
    minutes: 5,
    audio: false,
    steps: [
      { m: 3, t: 'Review 9 cards', w: 'Due today, right before you’d forget them.' },
      { m: 2, t: 'What’s new in AWS', w: 'A short brief from a live search.' },
    ],
  },
  {
    where: 'On the bus',
    minutes: 20,
    audio: false,
    steps: [
      { m: 3, t: 'Review 9 cards', w: 'Due today.' },
      { m: 5, t: 'Quiz: Cold starts', w: 'Six questions on the one you keep missing.' },
      { m: 12, t: 'Start the Monzo application', w: 'Closes Friday.' },
    ],
  },
];

export function MinutesDemo() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(1);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((s) => (s + 1) % MOMENTS.length), 3600);
    return () => clearInterval(t);
  }, [reduce]);

  const m = MOMENTS[i];

  return (
    <div className="w-full max-w-[440px]" aria-hidden="true">
      <div className="mb-3 flex h-5 items-center gap-2 text-[12px] text-white/75">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/60" />
        <motion.span key={m.where} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {m.where}
        </motion.span>
      </div>

      <div className="rounded-2xl bg-white p-4 text-foreground shadow-float">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[14px] font-semibold">Got a few minutes?</div>
          {m.audio && (
            <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[10.5px] font-medium text-accent-foreground">
              <Headphones className="h-3 w-3" />
              Audio only
            </span>
          )}
        </div>
        <div className="mt-3 inline-flex rounded-lg bg-muted p-0.5">
          {[2, 5, 10, 20].map((n) => (
            <span
              key={n}
              className={`h-7 rounded-md px-2.5 text-[11.5px] leading-7 tabular-nums transition-colors duration-300 ${
                n === m.minutes ? 'bg-card font-semibold text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {n} min
            </span>
          ))}
        </div>
        <div className="mt-3 min-h-[136px] border-t pt-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.ol
              key={m.where}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {m.steps.map((s, k) => (
                <li key={s.t} className="flex items-start gap-3 py-1.5">
                  <span className={`w-10 shrink-0 pt-px text-[11px] tabular-nums ${k === 0 ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{s.m} min</span>
                  <span className="min-w-0">
                    <span className={`block truncate ${k === 0 ? 'text-[13px] font-semibold' : 'text-[12.5px] font-medium'}`}>{s.t}</span>
                    <span className="block text-[11px] text-muted-foreground">{s.w}</span>
                  </span>
                </li>
              ))}
            </motion.ol>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
