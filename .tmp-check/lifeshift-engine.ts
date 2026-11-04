// LifeShift engine checks: stable replans, transitive ordering, engine-derived reasons, conflict suggestions
import { buildPlan, changedTaskIds, explainChanges, suggestFixes, stableReplan } from '/src/lib/scheduling/plan.ts';
import { orderKey } from '/src/lib/scheduling/scheduler.ts';
import type { Constraint, Task } from '/src/lib/scheduling/types.ts';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(detail)}`);
}

const at = (days: number, hh: number, mm = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hh, mm, 0, 0);
  return d;
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default async function () {
  // Evenings 19-21 every day, 7 tasks
  const windows = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, startTime: '19:00', endTime: '21:00' }));
  const t = (id: string, duration: number, priority: Task['priority'], deadlineDays?: number, category = 'learning'): Task => ({
    id, title: id, duration, priority, flexible: true, category,
    deadline: deadlineDays === undefined ? undefined : at(deadlineDays, 22),
  });
  const tasks: Task[] = [
    t('quiz', 15, 'P1', 2),
    t('apply', 30, 'P1', 3, 'career'),
    t('tailor', 20, 'P2', 3, 'career'),
    t('vpc', 45, 'P2', 5),
    t('interview', 30, 'P3', undefined, 'career'),
    t('read', 60, 'P3', 6),
    t('call', 30, 'P4'),
  ];
  const input = { windows, events: [], tasks };

  // 1. Ordering is a total order (no cycles): sort is stable under shuffling
  const now = new Date();
  const keys = tasks.map((x) => orderKey(x, now));
  const sorted1 = [...tasks].sort((a, b) => orderKey(a, now) - orderKey(b, now)).map((x) => x.id).join();
  const sorted2 = [...tasks].reverse().sort((a, b) => orderKey(a, now) - orderKey(b, now)).map((x) => x.id).join();
  check('ordering independent of input order', sorted1 === sorted2, { sorted1, sorted2 });
  check('every key is finite or -inf', keys.every((k) => Number.isFinite(k) || k === -Infinity));

  // 2. Same input -> identical plan (deterministic ids)
  const p0 = buildPlan([], input);
  const p0b = buildPlan([], input);
  check('deterministic block ids', JSON.stringify(p0.schedule.blocks.map((b) => b.id)) === JSON.stringify(p0b.schedule.blocks.map((b) => b.id)));
  check('baseline fits everything', p0.schedule.atRiskTasks.length === 0, p0.schedule.atRiskTasks);

  // 3. Stability: a busy evening 3 days out moves ONLY tasks that were in that evening
  const day3 = at(3, 0);
  const shift: Constraint = {
    type: 'shift_conflict', description: 'Extra shift Thursday 6-10pm', parsedBy: 'rules',
    conflictingShift: { start: at(3, 18).toISOString(), end: at(3, 22).toISOString() },
  };
  const p1 = buildPlan([shift], input);
  const onDay3Before = new Set(p0.schedule.blocks.filter((b) => b.date === ymd(day3)).map((b) => b.taskId));
  const moved = changedTaskIds(p0.schedule, p1.schedule);
  const unrelatedMoved = moved.filter((id) => !onDay3Before.has(id));
  console.log(`      day-3 tasks before: [${[...onDay3Before].join(', ')}], moved: [${moved.join(', ')}], strategy=${p1.strategy}`);
  check('stable strategy used', p1.strategy === 'stable', p1.strategy);
  check('only tasks from the lost evening moved', unrelatedMoved.length === 0, unrelatedMoved);
  check('nothing scheduled inside the shift', !p1.schedule.blocks.some((b) => b.date === ymd(day3)), p1.schedule.blocks.filter((b) => b.date === ymd(day3)));

  // 4. Reasons come from engine data and name the trigger + times
  const changes = explainChanges(p0, p1, shift.description);
  check('one explanation per moved task', changes.length === moved.length, { changes: changes.length, moved: moved.length });
  check('slot_removed reason quotes the trigger', changes.every((c) => c.cause !== 'slot_removed' || c.reason.includes('Extra shift')), changes.map((c) => c.reason));
  changes.forEach((c) => console.log(`      [${c.cause}] ${c.task.title}: ${c.reason}`));

  // 5. Squeeze until something doesn't fit, then check suggestions
  const tonight: Constraint = { type: 'time_reduced', description: 'Only 20 min tonight', parsedBy: 'rules', date: ymd(now), availableMinutes: 20 };
  // Only 20 min tonight + 2h tomorrow before the deadline, but 150 min of exam prep and other P2/P3 work competing
  const heavy = { ...input, tasks: [...tasks, t('exam', 150, 'P1', 1), t('notes', 60, 'P3', 1)] };
  const p2 = buildPlan([tonight], heavy);
  const fixes = suggestFixes(p2);
  console.log(`      at risk: ${p2.schedule.atRiskTasks.map((r) => `${r.taskId} (${r.reason})`).join('; ') || 'none'}, strategy=${p2.strategy}`);
  check('a heavy week produces at-risk tasks', p2.schedule.atRiskTasks.length > 0);
  // The urgent P1 must get all the time available before its deadline (20 min tonight + 120 tomorrow, minus buffers)
  const examMin = p2.schedule.blocks.filter((b) => b.taskId === 'exam').reduce((s, b) => s + (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000, 0);
  console.log(`      exam placed: ${examMin} of 150 min`);
  check('urgent P1 is not starved to protect lower-priority slots', examMin >= 120, examMin);
  for (const [id, list] of fixes) {
    console.log(`      fixes for ${id}: ${list.map((s) => s.label).join(' | ')}`);
    check(`suggestions for ${id} never skip a P1 due sooner`, list.every((s) => s.adjustments.every((a) => {
      const other = heavy.tasks.find((x) => x.id === a.taskId)!;
      const me = heavy.tasks.find((x) => x.id === id)!;
      return a.taskId === id || !(other.priority < me.priority);
    })));
  }
  // Applying the first non-trivial fix must reduce or keep the at-risk count, never increase it
  const [firstId, firstList] = [...fixes.entries()][0] ?? [];
  if (firstId && firstList) {
    const p3 = buildPlan([tonight], heavy, new Date(), firstList[0].adjustments);
    check(`applying "${firstList[0].label}" does not add new at-risk tasks`, p3.schedule.atRiskTasks.length <= p2.schedule.atRiskTasks.length, {
      before: p2.schedule.atRiskTasks.length, after: p3.schedule.atRiskTasks.length,
    });
  }

  // 6. No overlaps, nothing outside free time, nothing after a deadline (property over all plans)
  for (const [name, plan] of [['baseline', p0], ['shift', p1], ['squeezed', p2]] as const) {
    const bs = [...plan.schedule.blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const overlap = bs.some((b, i) => i > 0 && b.startTime < bs[i - 1].endTime);
    const late = bs.some((b) => {
      const task = plan.tasks.find((x) => x.id === b.taskId);
      return task?.deadline && new Date(b.endTime) > task.deadline;
    });
    check(`${name}: no overlapping blocks`, !overlap);
    check(`${name}: no block after its deadline`, !late);
  }

  // 7. Speed with 60 tasks and 3 constraints
  const many = Array.from({ length: 60 }, (_, i) => t(`t${i}`, 15 + (i % 4) * 15, (['P1', 'P2', 'P3', 'P4'] as const)[i % 4], (i % 6) + 1));
  const t0 = performance.now();
  buildPlan([shift, tonight, shift], { windows, events: [], tasks: many });
  const took = performance.now() - t0;
  console.log(`      60 tasks x 3 stable replans: ${took.toFixed(1)} ms`);
  check('60 tasks, 3 replans under 200 ms', took < 200, took);

  void stableReplan;
  console.log(`\n${pass}/${pass + fail} engine checks pass`);
  if (fail) process.exitCode = 1;
}
