/**
 * usePlan - the week every page shows.
 *
 * Your free time + your tasks + what the loop added, with your LifeShift
 * changes applied. One hook so Today, LifeShift and Tasks always agree.
 */

import { useEffect, useMemo } from 'react';
import { useUserId } from '@/contexts/AuthContext';
import { useSchedule } from '@/hooks/useSchedule';
import { useWeek, openTasks } from '@/hooks/useWeek';
import { useLoop, loopTasks } from '@/hooks/useLoop';
import { buildPlan, type PlanInput } from '@/lib/scheduling/plan';
import type { Adjustment, Constraint } from '@/lib/scheduling/types';

export function usePlanInput(): PlanInput {
  const userId = useUserId();
  const { windows, events, tasks } = useWeek();
  const { dueCards, weakSpots, jobs, sources, loadedFor, refresh } = useLoop();

  useEffect(() => {
    if (userId && loadedFor !== userId) refresh(userId);
  }, [userId, loadedFor, refresh]);

  return useMemo(
    () => ({
      windows,
      events,
      tasks: [...openTasks(tasks), ...loopTasks({ dueCards, weakSpots, jobs, sources })],
    }),
    [windows, events, tasks, dueCards, weakSpots, jobs, sources]
  );
}

export function usePlan() {
  const input = usePlanInput();
  const { constraints, adjustments } = useSchedule();
  const plan = useMemo(() => buildPlan(constraints, input, new Date(), adjustments), [constraints, input, adjustments]);

  // Remember when each of your own tasks was planned, so Today can ask how it went afterwards
  const recordSlots = useWeek((s) => s.recordSlots);
  useEffect(() => {
    const mine = new Set(plan.tasks.filter((t) => t.source === 'you' || t.source === 'sample').map((t) => t.id));
    const slots: Record<string, { start: string; end: string }> = {};
    for (const b of [...plan.schedule.blocks].sort((a, c) => a.startTime.localeCompare(c.startTime))) {
      if (mine.has(b.taskId) && !slots[b.taskId]) slots[b.taskId] = { start: b.startTime, end: b.endTime };
    }
    recordSlots(slots);
  }, [plan, recordSlots]);
  /** Plan with one more constraint (LifeShift what-if preview, nothing is saved) */
  const planWith = (extra: Constraint) => buildPlan([...constraints, extra], input, new Date(), adjustments);
  /** Plan with extra adjustments (conflict suggestion preview) */
  const planWithAdjustments = (extra: Adjustment[]) =>
    buildPlan(constraints, input, new Date(), [...adjustments.filter((a) => !extra.some((e) => e.taskId === a.taskId)), ...extra]);
  return { plan, input, planWith, planWithAdjustments };
}
