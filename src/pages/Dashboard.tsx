/**
 * Today - for someone with a full life and five minutes to spare.
 *
 * Three questions, in the order a busy person asks them:
 *   1. Got a few minutes? What's worth doing right now (the spare-minutes picker).
 *   2. What's my day? Today's plan as one short list, with Start on the first
 *      thing and a line to add something. "Hear my day" reads it out loud.
 *   3. Am I growing? The last 7 days.
 * The week calendar sits below for when you want the whole picture.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Plus, Volume2, Pause, CheckCircle2 } from '@/components/icons';
import DashboardLayout from '../components/DashboardLayout';
import WeekCanvas, { WeekLegend, weekRangeLabel } from '../components/WeekCanvas';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '@/components/Panel';
import { QuickAdd } from '@/components/QuickAdd';
import { SpareMinutes } from '@/components/SpareMinutes';
import { CheckIn } from '@/components/CheckIn';
import { WeekInReview } from '@/components/WeekInReview';
import { WeekItemDialog, type WeekItem } from '@/components/WeekItemDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSchedule } from '@/hooks/useSchedule';
import { useWeek } from '@/hooks/useWeek';
import { usePlan } from '@/hooks/usePlan';
import { useLoop } from '@/hooks/useLoop';
import { useAgenda } from '@/hooks/useAgenda';
import { dayBrief, sayDuration, sayTime, type AgendaDay, type AgendaItem } from '@/lib/coach/brief';
import { speechManager } from '@/lib/voice/speech-manager';
import { scheduledMinutes, weeklyFreeMinutes } from '@/lib/scheduling/plan';
import { cn } from '@/lib/utils';

const hours = (min: number) => Math.round((min / 60) * 10) / 10;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, displayName } = useAuth();
  const userId = user?.id ?? '';
  const week = useWeek();
  const { lastRecalculatedAt } = useSchedule();
  const { plan } = usePlan();
  const agenda = useAgenda();
  const dueCards = useLoop((s) => s.dueCards);
  const [item, setItem] = useState<WeekItem | null>(null);

  const today = agenda.days[0];
  const plannedH = hours(scheduledMinutes(plan.schedule));
  const freeH = hours(weeklyFreeMinutes(week.windows));
  const atRisk = plan.schedule.atRiskTasks.length;

  // Got a few minutes? says when an item is also planned later today, so it reads as a choice, not a repeat
  const plannedAt = useMemo(() => {
    const at = (src: string) => today?.items.find((i) => i.source === src);
    const r = at('reviews');
    const w = at('weak-spot');
    return { reviews: r ? sayTime(r.start) : undefined, weak: w ? sayTime(w.start) : undefined };
  }, [today]);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();
  const daysLeft = week.goal?.targetDate
    ? Math.ceil((new Date(week.goal.targetDate + 'T23:59:59').getTime() - Date.now()) / 86_400_000)
    : null;

  const weekSummary = (
    <>
      <span className="tabular-nums">{plannedH}h</span> planned of <span className="tabular-nums">{freeH}h</span> free
      {atRisk > 0 && (
        <>
          {' · '}
          <button onClick={() => navigate('/tasks')} className="font-medium text-destructive hover:underline">
            {atRisk} doesn’t fit
          </button>
        </>
      )}
    </>
  );

  return (
    <DashboardLayout>
      {week.isSample && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/[0.08] px-4 py-2">
          <p className="text-[13px] text-warning-ink">
            <span className="font-semibold">Sample week.</span> Tasks and free time are made up. Quizzes, reviews and jobs are real.
          </p>
          <Button size="sm" variant="ghost" className="h-7 text-warning-ink hover:bg-warning/10" onClick={() => { week.clear(); navigate('/setup'); }}>
            Set up my own week
          </Button>
        </div>
      )}

      <PageHeader
        title={
          <>
            {greeting}
            {displayName !== 'Guest' ? `, ${displayName}` : ''}
          </>
        }
        description={
          week.goal ? (
            <>
              Working toward <span className="font-medium text-foreground">{week.goal.title}</span>
              {daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}
              {' · '}
              <button onClick={() => navigate('/profile')} className="underline-offset-2 hover:text-foreground hover:underline">
                Change
              </button>
            </>
          ) : undefined
        }
        actions={<HearMyDay days={agenda.days} dueCards={dueCards} deadlines={agenda.deadlines} atRiskTitles={agenda.atRiskTitles} />}
      />

      <div className="mb-6 empty:hidden">
        <CheckIn />
      </div>

      <SpareMinutes className="mb-6" plannedAt={plannedAt} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <YourDay days={agenda.days} hasFreeTime={week.windows.length > 0} />
        <WeekInReview userId={userId} />
      </div>

      {/* The whole week: click empty time to add, a block to see it */}
      <Panel
        id="today-week"
        className="mt-6"
        title="This week"
        meta={weekRangeLabel()}
        summary={weekSummary}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setItem({ kind: 'add', date: new Date() })}>
              <Plus />
              Add
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12.5px] text-muted-foreground">
          <span>
            {weekSummary}
            {lastRecalculatedAt && <> · replanned {formatDistanceToNow(new Date(lastRecalculatedAt), { addSuffix: true })}</>}
          </span>
          <WeekLegend />
        </div>
        <WeekCanvas
          plan={plan}
          compact
          onAdd={(date, minute) => setItem({ kind: 'add', date, minute })}
          onBlockClick={(task, block) => setItem({ kind: 'block', task, block })}
          onEventClick={(event) => setItem({ kind: 'event', event })}
        />
        <p className="mt-3 text-[11.5px] text-muted-foreground">Click empty time to add something.</p>
      </Panel>

      <WeekItemDialog item={item} onClose={() => setItem(null)} />
    </DashboardLayout>
  );
}

/** "Hear my day": Ropi reads today out loud, right here. */
function HearMyDay({
  days,
  dueCards,
  deadlines,
  atRiskTitles,
}: {
  days: AgendaDay[];
  dueCards: number;
  deadlines: { title: string; at: string }[];
  atRiskTitles: string[];
}) {
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = speechManager.getSupport().tts;
  useEffect(() => () => speechManager.stopSpeaking(), []);

  const toggle = async () => {
    if (speaking) {
      speechManager.stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    const { text } = dayBrief(days, { dueCards, deadlines, atRiskTitles });
    let pref: { voice?: string; rate?: number } = {};
    try {
      pref = JSON.parse(localStorage.getItem('ropi-voice-v1') ?? '{}');
    } catch {
      // defaults
    }
    const voice = (await speechManager.getVoices()).find((v) => v.name === pref.voice);
    try {
      await speechManager.speak(text, { rate: pref.rate ?? 1, ...(voice ? { voice } : {}) });
    } catch {
      // no voice output: nothing else to do, the day is on screen
    }
    setSpeaking(false);
  };

  return (
    <>
      {canSpeak && (
        <Button variant="outline" onClick={toggle} aria-pressed={speaking}>
          {speaking ? <Pause /> : <Volume2 />}
          {speaking ? 'Stop' : 'Hear my day'}
        </Button>
      )}
    </>
  );
}

/** Today's plan as one short list: time, what, how long. Start on the first; add a line at the bottom. */
function YourDay({ days, hasFreeTime }: { days: AgendaDay[]; hasFreeTime: boolean }) {
  const navigate = useNavigate();
  const checkIn = useWeek((s) => s.checkIn);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = days[0];
  const items = today?.items ?? [];
  const tasks = items.filter((i) => i.kind === 'task');
  const next = days.slice(1).find((d) => d.items.some((i) => i.kind === 'task'));
  const firstTask = tasks[0];
  const part = firstTask ? (new Date(firstTask.start).getHours() >= 17 ? 'Tonight' : 'Today') : 'Today';

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Your day</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {tasks.length
              ? `${part} · ${tasks.length} thing${tasks.length === 1 ? '' : 's'} · ${sayDuration(today.plannedMinutes).replace(/ minutes?/, ' min').replace(/ hours?/, 'h')}`
              : hasFreeTime
                ? 'Nothing else planned today'
                : 'Ropi plans inside your free time'}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => navigate('/schedule')}>
          Something changed?
        </Button>
      </div>

      {items.length > 0 ? (
        <ol className="px-2 pb-2 sm:px-3" aria-label="Today's plan">
          {items.map((i) => (
            <DayRow
              key={i.id}
              item={i}
              live={now >= new Date(i.start).getTime() && now < new Date(i.end).getTime()}
              first={i === firstTask}
              onOpen={() => i.href && navigate(i.href)}
              onDone={() => i.taskId && checkIn(i.taskId, 'done')}
            />
          ))}
        </ol>
      ) : (
        <div className="mx-5 mb-4 rounded-xl border border-dashed px-4 py-4 text-[13px] text-muted-foreground sm:mx-6">
          {!hasFreeTime ? (
            <>
              Tell Ropi when you’re usually free and it plans around it.{' '}
              <button className="font-medium text-primary hover:underline" onClick={() => navigate('/setup')}>
                Set my free time
              </button>
            </>
          ) : next ? (
            <>
              <span className="font-medium text-foreground">{next.name}:</span> {next.items.find((x) => x.kind === 'task')!.title} at{' '}
              {sayTime(next.items.find((x) => x.kind === 'task')!.start)}.
            </>
          ) : (
            'Your week is clear. Add something below, or take a quiz so Ropi knows what to practise.'
          )}
        </div>
      )}

      <div className="border-t px-5 py-4 sm:px-6">
        <QuickAdd title={null} className="border-0 bg-transparent p-0" />
      </div>
    </Card>
  );
}

function DayRow({ item, live, first, onOpen, onDone }: { item: AgendaItem; live: boolean; first: boolean; onOpen: () => void; onDone: () => void }) {
  const busy = item.kind === 'busy';
  const dot = busy ? 'bg-muted-foreground/40' : item.category === 'career' ? 'bg-foreground' : item.category === 'learning' ? 'bg-primary' : 'bg-muted-foreground/60';
  return (
    <li>
      <div className={cn('group flex items-center gap-3 rounded-lg px-3 py-2.5', first && 'bg-muted/50', !busy && !first && 'hover:bg-muted/40')}>
        <span className={cn('w-[58px] shrink-0 text-[12.5px] tabular-nums sm:w-[68px]', first ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
          {live ? 'Now' : sayTime(item.start)}
        </span>
        <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
        <button
          className={cn('min-w-0 flex-1 text-left', busy && 'cursor-default')}
          onClick={busy ? undefined : onOpen}
          disabled={busy || !item.href}
        >
          <span className={cn('block truncate', first ? 'text-[14.5px] font-semibold' : 'text-[13.5px]', busy && 'text-muted-foreground')}>
            {item.title}
            {busy && <span className="ml-1.5 text-[11.5px]">· busy</span>}
          </span>
          {first && item.why && <span className="mt-0.5 block line-clamp-1 text-[12px] text-muted-foreground">{item.why}</span>}
        </button>
        <span className={cn('shrink-0 text-[12px] tabular-nums text-muted-foreground', first && 'hidden sm:inline')}>{item.minutes} min</span>
        {first &&
          (item.href ? (
            <Button size="sm" className="shrink-0" onClick={onOpen}>
              Start
              <ArrowRight />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="shrink-0" onClick={onDone}>
              <CheckCircle2 />
              Mark done
            </Button>
          ))}
      </div>
    </li>
  );
}
