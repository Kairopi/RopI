/**
 * Check-in: after a planned block ends, ask how it went.
 *
 * Super Productivity's end-of-day review (LEARNINGS_FROM_3_SCHEDULING_SYSTEMS #5),
 * done one block at a time so it never piles up:
 *   Done      -> how long it really took (feeds estimate accuracy)
 *   Did some  -> the minutes you did come off; the rest is re-planned
 *   Not yet   -> stays on your list; the plan finds it a new slot
 *   Drop it   -> removed
 * Only shows when there is something to ask about.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock } from '@/components/icons';
import { useWeek, type CheckInAction } from '@/hooks/useWeek';

const time = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  const day = d.toDateString() === today.toDateString() ? 'today' : d.toDateString() === y.toDateString() ? 'yesterday' : d.toLocaleDateString('en-US', { weekday: 'long' });
  return `${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ${day}`;
};

export function CheckIn() {
  const { tasks, slots, checkIn } = useWeek();
  const now = Date.now();
  const due = tasks
    .filter((t) => !t.doneAt && slots[t.id] && new Date(slots[t.id].end).getTime() <= now)
    .sort((a, b) => slots[a.id].end.localeCompare(slots[b.id].end));

  if (!due.length) return null;
  const task = due[0];

  return (
    <Card className="overflow-hidden border-primary/25">
      <div className="flex items-center justify-between gap-3 border-b bg-accent/60 px-5 py-3">
        <span className="eyebrow !text-accent-foreground">Check-in</span>
        {due.length > 1 && <span className="text-[11.5px] tabular-nums text-muted-foreground">1 of {due.length}</span>}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={task.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
          <Row
            title={task.title}
            planned={task.duration}
            when={`${time(slots[task.id].start)}`}
            onAnswer={(action, minutes) => checkIn(task.id, action, minutes)}
          />
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

function Row({ title, planned, when, onAnswer }: { title: string; planned: number; when: string; onAnswer: (a: CheckInAction, minutes?: number) => void }) {
  const [step, setStep] = useState<'ask' | 'took' | 'some'>('ask');
  const tookOptions = [...new Set([Math.max(5, Math.round(planned / 2 / 5) * 5), planned, Math.round((planned * 1.5) / 5) * 5, planned * 2])];
  const someOptions = [10, 15, 30, 45].filter((m) => m < planned);

  return (
    <div className="p-5">
      <p className="text-[13px] text-muted-foreground">
        Planned for {when} · {planned} min
      </p>
      <h3 className="mt-1 font-sans text-[16px] font-semibold tracking-normal">How did "{title}" go?</h3>

      {step === 'ask' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setStep('took')}>
            <CheckCircle2 />
            Done
          </Button>
          {someOptions.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setStep('some')}>
              Did some
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onAnswer('later')}>
            Not yet
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onAnswer('drop')}>
            Drop it
          </Button>
        </div>
      )}

      {step !== 'ask' && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {step === 'took' ? 'How long did it really take?' : 'How much did you do? The rest gets a new slot.'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(step === 'took' ? tookOptions : someOptions).map((m) => (
              <button
                key={m}
                onClick={() => onAnswer(step === 'took' ? 'done' : 'partly', m)}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] tabular-nums transition-colors hover:border-primary/40 hover:bg-accent ${m === planned && step === 'took' ? 'border-primary/40 bg-accent font-medium' : 'bg-card'}`}
              >
                {m} min{m === planned && step === 'took' ? ' (as planned)' : ''}
              </button>
            ))}
            <button onClick={() => setStep('ask')} className="px-2 text-[12.5px] text-muted-foreground hover:text-foreground">
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
