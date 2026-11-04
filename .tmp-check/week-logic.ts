import { parseQuickAdd } from '/src/lib/week/quick-add.ts';
import { parseAvailabilityWithRules, parseAvailability } from '/src/lib/week/parse-availability.ts';
import { loopTasks } from '/src/hooks/useLoop.ts';
import { buildPlan } from '/src/lib/scheduling/plan.ts';
import { applyConstraintToTasks } from '/src/lib/scheduling/constraints.ts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + JSON.stringify(detail)}`);
}

export default async function () {
  // A Wednesday 14:00 so day maths is deterministic
  const now = new Date(2026, 10, 4, 14, 0);

  // ---- Quick add ----
  const a = parseQuickAdd('Finish practice exam 45m @fri !1', now)!;
  check('title stripped', a.title === 'Finish practice exam', a);
  check('45m', a.duration === 45, a.duration);
  check('@fri -> Friday 22:00', a.deadline?.getDay() === 5 && a.deadline?.getHours() === 22, a.deadline);
  check('!1 -> P1', a.priority === 'P1', a.priority);
  check('exam -> learning', a.category === 'learning', a.category);

  const b = parseQuickAdd('Apply to Stripe 1h30m @tomorrow 5pm #career', now)!;
  check('1h30m = 90', b.duration === 90, b.duration);
  check('@tomorrow 5pm', b.deadline?.getDate() === 5 && b.deadline?.getHours() === 17, b.deadline);
  check('#career', b.category === 'career' && b.title === 'Apply to Stripe', b);

  const c = parseQuickAdd('Call mum', now)!;
  check('defaults 30m, life, no deadline', c.duration === 30 && c.category === 'life' && !c.deadline, c);
  check('@fri on a Friday = next Friday', parseQuickAdd('x @fri', new Date(2026, 10, 6, 9))!.deadline!.getDate() === 13);
  check('empty title -> null', parseQuickAdd('30m @fri') === null);

  // ---- Free-time rules ----
  const w1 = parseAvailabilityWithRules('Weeknights after 7, Saturday morning');
  check('weeknights after 7 = 5 windows 19-21', w1.filter((w) => w.startTime === '19:00' && w.endTime === '21:00').length === 5, w1);
  check('saturday morning 9-12', w1.some((w) => w.day === 6 && w.startTime === '09:00' && w.endTime === '12:00'), w1);
  const w2 = parseAvailabilityWithRules('every day 7am-11pm');
  check('every day 7am-11pm', w2.length === 7 && w2.every((w) => w.startTime === '07:00' && w.endTime === '23:00'), w2);
  const w3 = parseAvailabilityWithRules('Tue and Thu 6-8pm, Sunday 2-5');
  check('tue/thu 18-20', w3.filter((w) => (w.day === 2 || w.day === 4) && w.startTime === '18:00' && w.endTime === '20:00').length === 2, w3);
  check('sunday 2-5 -> 14-17', w3.some((w) => w.day === 0 && w.startTime === '14:00' && w.endTime === '17:00'), w3);

  // ---- Free-time via Meta Muse (live) ----
  const t0 = Date.now();
  const live = await parseAvailability('I get home around 6:30 on weekdays and can do an hour and a half, plus Sunday mornings');
  console.log(`      Muse availability: parsedBy=${live.parsedBy} in ${Date.now() - t0}ms ->`, JSON.stringify(live.windows));
  check('Muse/rules returns windows', live.windows.length >= 5, live);

  // ---- Loop -> tasks ----
  const jobDeadline = new Date(2026, 10, 6, 17).toISOString();
  const lt = loopTasks(
    {
      dueCards: 7,
      weakSpots: [{ topic: 'AWS Lambda', concept: 'Lambda cold starts' }],
      jobs: [
        { id: 'j1', company: 'Monzo', job_title: 'PM', status: 'scored', deadline: jobDeadline, ats_score: 64 },
        { id: 'j2', company: 'Old', job_title: 'PM', status: 'discovered', deadline: new Date(2026, 10, 1).toISOString() },
        { id: 'j3', company: 'Done', job_title: 'PM', status: 'applied', deadline: jobDeadline },
      ],
    },
    now
  );
  check('review task 7 cards = 5 min', lt.some((t) => t.id === 'loop-reviews' && t.duration === 5 && t.href === '/reviews'), lt);
  check('weak-spot practice task with Muse quiz link', lt.some((t) => t.title === 'Practice: Lambda cold starts' && t.href?.includes('focus=Lambda')), lt);
  check('job with deadline -> Apply task P1', lt.some((t) => t.id === 'loop-job-j1' && t.priority === 'P1'), lt);
  check('past deadline skipped, applied skipped', !lt.some((t) => t.id === 'loop-job-j2' || t.id === 'loop-job-j3'), lt);

  // ---- Plan uses only the user's data ----
  const plan = buildPlan(
    [],
    { windows: w2, events: [], tasks: [...lt, { id: 'u1', title: 'Call mum', duration: 30, priority: 'P2', flexible: true, category: 'life', source: 'you' }] },
    now
  );
  check('everything placed', plan.schedule.atRiskTasks.length === 0 && plan.schedule.blocks.length >= 4, plan.schedule);
  check('no persona tasks', !plan.tasks.some((t) => /Monzo PM|VPC/.test(t.title) && t.source !== 'job'), plan.tasks.map((t) => t.title));
  const empty = buildPlan([], { windows: [], events: [], tasks: [] }, now);
  check('empty week -> empty plan', empty.schedule.blocks.length === 0);

  // ---- Deadline sentence with no application -> new task ----
  const r = applyConstraintToTasks([{ id: 'u1', title: 'Call mum', duration: 30, priority: 'P2', flexible: true, category: 'life' }], {
    type: 'deadline_added',
    description: 'Dream job closes tomorrow at 5PM',
    urgentDeadline: new Date(2026, 10, 5, 17),
  });
  check('creates application task, leaves others alone', r.tasks.length === 2 && r.tasks[0].deadline === undefined && r.tasks[1].category === 'career', r.tasks);

  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail) process.exitCode = 1;
}
