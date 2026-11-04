/**
 * ShiftDemo: a tiny looping version of LifeShift for the login screen.
 * A 5-day week; every few seconds "something changes" and blocks slide to new
 * slots, the same motion the real product uses. Static if reduced motion is on.
 */

import { useEffect, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

type Block = { id: string; label: string; kind: 'learn' | 'career' };
const BLOCKS: Block[] = [
  { id: 'quiz', label: 'Lambda quiz', kind: 'learn' },
  { id: 'apply', label: 'Apply: Monzo', kind: 'career' },
  { id: 'cards', label: 'Review cards', kind: 'learn' },
  { id: 'resume', label: 'Tailor resume', kind: 'career' },
  { id: 'vpc', label: 'Study VPC', kind: 'learn' },
];

// Two plans: before and after "only 20 min tonight" (Mon shrinks, work moves on)
const PLANS: { change: string; days: string[][] }[] = [
  {
    change: 'Planned around your free time',
    days: [['quiz', 'apply'], ['cards'], ['resume'], [], ['vpc']],
  },
  {
    change: '“Manager added a shift, only 20 min tonight”',
    days: [['cards'], ['quiz', 'apply'], ['resume'], ['vpc'], []],
  },
];

export function ShiftDemo() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setStep((s) => (s + 1) % PLANS.length), 3200);
    return () => clearInterval(t);
  }, [reduce]);

  const plan = PLANS[step];
  const byId = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));

  return (
    <div className="w-full max-w-[440px]">
      <div className="mb-3 flex items-center gap-2 text-[12px] text-white/75 h-5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${step ? 'bg-warning' : 'bg-white/60'}`} />
        <motion.span key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {plan.change}
        </motion.span>
      </div>

      <LayoutGroup id="shift-demo">
        <div className="grid grid-cols-5 gap-2 rounded-2xl border border-white/15 bg-white/[0.06] p-3 backdrop-blur-sm">
          {DAYS.map((d, i) => (
            <div key={d} className="min-w-0">
              <div className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/55">{d}</div>
              <div className="flex min-h-[132px] flex-col gap-1.5 rounded-lg bg-white/[0.05] p-1.5">
                {plan.days[i].map((id) => {
                  const b = byId[id];
                  return (
                    <motion.div
                      key={id}
                      layoutId={`demo-${id}`}
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 22 }}
                      className={`rounded-md px-1.5 py-1.5 text-[10.5px] font-medium leading-tight shadow-sm ${
                        b.kind === 'learn' ? 'bg-white text-primary' : 'bg-foreground text-white'
                      }`}
                    >
                      {b.label}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
