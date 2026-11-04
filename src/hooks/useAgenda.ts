/**
 * useAgenda - the next 7 days as an agenda (blocks + busy time, in order),
 * plus what's worth saying about them: deadlines in the next 3 days and
 * anything that doesn't fit. Shared by Today and Talk so they read the same day.
 */
import { useMemo } from 'react';
import { usePlan } from '@/hooks/usePlan';
import { weeklyFreeMinutes } from '@/lib/scheduling/plan';
import { buildAgenda, type AgendaDay } from '@/lib/coach/brief';

export interface Agenda {
  days: AgendaDay[];
  freeMinutes: number;
  atRiskTitles: string[];
  deadlines: { title: string; at: string }[];
}

export function useAgenda(): Agenda {
  const { plan, input } = usePlan();
  return useMemo(() => {
    const now = new Date();
    const days = buildAgenda({ tasks: plan.tasks, blocks: plan.schedule.blocks, events: input.events, atRisk: plan.schedule.atRiskTasks, now });
    const byId = new Map(plan.tasks.map((t) => [t.id, t]));
    const atRiskTitles = plan.schedule.atRiskTasks.map((r) => byId.get(r.taskId)?.title).filter((t): t is string => !!t);
    const seen = new Set<string>();
    const deadlines = plan.tasks
      .filter((t) => t.category === 'career' && t.deadline && t.deadline.getTime() > now.getTime() && t.deadline.getTime() - now.getTime() < 3 * 86_400_000)
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())
      .map((t) => {
        const company = t.title.match(/^Apply:\s*([^,]+)/i)?.[1];
        return { title: company ? `The ${company} application` : t.title, at: t.deadline!.toISOString() };
      })
      .filter((d) => (seen.has(d.title) ? false : (seen.add(d.title), true)));
    return { days, freeMinutes: weeklyFreeMinutes(input.windows), atRiskTitles, deadlines };
  }, [plan, input]);
}
