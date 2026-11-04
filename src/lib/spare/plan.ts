/**
 * Spare minutes: "I have 5 minutes on the platform, what's the best use of it?"
 *
 * Picks up to three steps that fit the time you have, from your own data:
 *   - review cards FSRS says are due (about 20 s each)
 *   - the concept you score worst on: a 2-minute explanation, or a 6-question quiz
 *   - a job that closes soon
 *   - a 2-minute news brief or a podcast episode that fits, on your goal
 * "Audio only" is for when your eyes or hands are busy (getting dressed,
 * walking, driving as a passenger): only things Ropi can say out loud.
 *
 * Pure: no network, no clock except `now`, so it's easy to test.
 */

export type SpareMode = 'screen' | 'audio';
export const SPARE_OPTIONS = [2, 5, 10, 20] as const;

export type SpareKind = 'reviews' | 'explain' | 'quiz' | 'voice-quiz' | 'news' | 'podcast' | 'apply' | 'resource';

export interface SpareStep {
  id: string;
  kind: SpareKind;
  title: string;
  minutes: number;
  why: string;
  href: string;
  /** How Ropi says it: "a 5-minute quiz on cold starts" */
  say: string;
}

export interface SparePlan {
  minutes: number;
  mode: SpareMode;
  steps: SpareStep[];
  /** Minutes the steps add up to (never more than `minutes`) */
  used: number;
}

export interface SpareInput {
  minutes: number;
  mode: SpareMode;
  dueCards: number;
  weakSpots: { topic: string; concept: string }[];
  jobs: { id: string; company: string; job_title: string; status: string; deadline?: string | null }[];
  goal: string | null;
  /** Free videos, podcasts and reads you saved, with how long they take */
  resources?: SpareResource[];
  now?: Date;
}

export interface SpareResource {
  title: string;
  url: string;
  kind: 'video' | 'podcast' | 'article' | 'course';
  minutes: number;
  topic: string;
}

/** The longest saved resource that still fits, for this mode (audio: podcasts only) */
function bestResource(all: SpareResource[] | undefined, left: number, mode: SpareMode, topic: string | null): SpareResource | null {
  const fits = (all ?? []).filter((r) => r.minutes >= 1 && r.minutes <= left && (mode === 'audio' ? r.kind === 'podcast' : true));
  if (!fits.length) return null;
  const onTopic = topic ? fits.filter((r) => r.topic.toLowerCase() === topic.toLowerCase()) : [];
  return (onTopic.length ? onTopic : fits).sort((a, b) => b.minutes - a.minutes)[0];
}

const RESOURCE_VERB = { video: 'Watch', podcast: 'Listen', article: 'Read', course: 'Start' } as const;

const OPEN_JOB = new Set(['discovered', 'scored', 'tailored', 'reviewed', 'approved']);
const SECONDS_PER_CARD = 20;

/** "Pass AWS Solutions Architect and land a PM role" -> "AWS Solutions Architect" */
export function goalTopic(goal: string | null): string | null {
  if (!goal) return null;
  const first = goal.split(/\s+(?:and|&|then)\s+|[,;]/i)[0] ?? goal;
  const t = first
    .replace(/^(pass|finish|complete|get|land|learn|become|study|start|ace|prepare for|prep for)\s+(an?\s+|the\s+|my\s+)?/i, '')
    .replace(/\s+(exam|certification|course|role|job)$/i, '')
    .trim();
  return t.length >= 2 ? t.slice(0, 60) : null;
}

const q = encodeURIComponent;
const talk = (text: string) => `/talk?q=${q(text)}`;

export function planSpareTime(input: SpareInput): SparePlan {
  const budget = Math.max(1, Math.round(input.minutes));
  const now = input.now ?? new Date();
  const weak = input.weakSpots[0];
  const topic = weak?.topic ?? goalTopic(input.goal);
  const steps: SpareStep[] = [];
  let left = budget;
  const add = (s: SpareStep) => {
    if (s.minutes <= left && steps.length < 3) {
      steps.push(s);
      left -= s.minutes;
    }
  };

  if (input.mode === 'screen') {
    // 1. Cards that are due: the cheapest win, and they're due today for a reason
    if (input.dueCards > 0) {
      const fit = Math.max(1, Math.floor((Math.min(left, 10) * 60) / SECONDS_PER_CARD));
      const n = Math.min(input.dueCards, fit);
      add({
        id: 'reviews',
        kind: 'reviews',
        title: `Review ${n} card${n === 1 ? '' : 's'}`,
        minutes: Math.max(1, Math.ceil((n * SECONDS_PER_CARD) / 60)),
        why: `${input.dueCards === n ? '' : `${n} of `}${input.dueCards} due today. Recalling them right before you'd forget is what makes them stick.`,
        href: '/reviews',
        say: `review ${n} card${n === 1 ? '' : 's'} that ${n === 1 ? 'is' : 'are'} due`,
      });
    }
    // 2. Your weakest concept
    if (weak) {
      if (left >= 5)
        add({
          id: 'quiz-weak',
          kind: 'quiz',
          title: `Quiz: ${weak.concept}`,
          minutes: 5,
          why: `You got it wrong more than half the time. Six questions on just that.`,
          href: `/quiz/new?topic=${q(weak.topic)}&focus=${q(weak.concept)}`,
          say: `a 6-question quiz on ${weak.concept}`,
        });
      else
        add({
          id: 'explain-weak',
          kind: 'explain',
          title: `${weak.concept}, explained`,
          minutes: 2,
          why: 'You missed it in a quiz. One plain idea, one example, one question to check.',
          href: talk(`Explain ${weak.concept} simply`),
          say: `a quick explanation of ${weak.concept}`,
        });
    } else if (left >= 5) {
      add({
        id: 'quiz-start',
        kind: 'quiz',
        title: topic ? `Quiz: ${topic}` : 'Quiz: AWS Lambda',
        minutes: 5,
        why: 'Six questions show what you already know, so Ropi knows what to practise.',
        href: topic ? `/quiz/new?topic=${q(topic)}` : '/quiz/quiz-1',
        say: `a 6-question quiz on ${topic ?? 'AWS Lambda'}`,
      });
    }
    // 3. A job that closes in the next 3 days
    const closing = input.jobs
      .filter((j) => OPEN_JOB.has(j.status) && j.deadline)
      .map((j) => ({ j, at: new Date(j.deadline!).getTime() }))
      .filter(({ at }) => at > now.getTime() && at - now.getTime() < 3 * 86_400_000)
      .sort((a, b) => a.at - b.at)[0];
    if (closing && left >= 10) {
      const day = new Date(closing.at).toLocaleDateString('en-US', { weekday: 'long' });
      add({
        id: `apply-${closing.j.id}`,
        kind: 'apply',
        title: `Start the ${closing.j.company} application`,
        minutes: Math.min(left, 15),
        why: `${closing.j.job_title}, closes ${day}. Get the first questions done now.`,
        href: '/jobs',
        say: `start your ${closing.j.company} application, it closes ${day}`,
      });
    }
    // 4. Something you saved that fits the time left
    const res = bestResource(input.resources, left, 'screen', topic);
    if (res) add(resourceStep(res));
    // 5. Fill what's left with a short brief
    if (topic && left >= 2)
      add({
        id: 'news',
        kind: 'news',
        title: `What's new in ${topic}`,
        minutes: 2,
        why: 'A short brief from a live web search, with the sources.',
        href: talk(`Latest news on ${topic}`),
        say: `a short news brief on ${topic}`,
      });
  } else {
    // Audio only: things Ropi can say, you answer out loud or just listen
    if (weak && left >= 2)
      add({
        id: 'explain-weak',
        kind: 'explain',
        title: `${weak.concept}, explained`,
        minutes: 2,
        why: 'You missed it in a quiz. Ropi explains it out loud, then asks one question.',
        href: talk(`Explain ${weak.concept} simply`),
        say: `I'll explain ${weak.concept}, the one you missed`,
      });
    if (left >= 5)
      add({
        id: 'voice-quiz',
        kind: 'voice-quiz',
        title: weak ? `Voice quiz: ${weak.concept}` : topic ? `Voice quiz: ${topic}` : 'Voice quiz: AWS Lambda',
        minutes: 5,
        why: 'Ropi reads six questions. Say the letter, no need to look.',
        href: weak
          ? `/voice-quiz?quiz=new&topic=${q(weak.topic)}&focus=${q(weak.concept)}&start=1`
          : topic
          ? `/voice-quiz?quiz=new&topic=${q(topic)}&start=1`
          : '/voice-quiz?quiz=quiz-1&start=1',
        say: `a voice quiz on ${weak?.concept ?? topic ?? 'AWS Lambda'}`,
      });
    // A podcast episode you saved that fits beats searching for one
    const pod = bestResource(input.resources, left, 'audio', topic);
    if (pod) add(resourceStep(pod));
    if (topic && left >= 10 && !pod)
      add({
        id: 'podcast',
        kind: 'podcast',
        title: `A podcast episode on ${topic}`,
        minutes: left,
        why: `Ropi looks for an episode under ${left} minutes, so it ends when your time does.`,
        href: talk(`A podcast on ${topic} under ${left} minutes`),
        say: `a podcast episode on ${topic} that fits the rest`,
      });
    if (topic && left >= 2)
      add({
        id: 'news',
        kind: 'news',
        title: `What's new in ${topic}`,
        minutes: 2,
        why: 'Ropi reads you a short brief from a live web search.',
        href: talk(`Latest news on ${topic}`),
        say: `a short news brief on ${topic}`,
      });
  }

  // Nothing to go on yet (no goal, no quizzes): one question answered is still growth
  if (!steps.length && left >= 2)
    add({
      id: 'explain-start',
      kind: 'explain',
      title: 'One idea, explained',
      minutes: 2,
      why: 'Ask Ropi about anything you came across today.',
      href: '/talk',
      say: 'ask me about anything you came across today',
    });

  return { minutes: budget, mode: input.mode, steps, used: budget - left };
}

function resourceStep(r: SpareResource): SpareStep {
  const verb = RESOURCE_VERB[r.kind];
  return {
    id: `res-${r.url}`,
    kind: 'resource',
    title: `${verb}: ${r.title}`,
    minutes: r.minutes,
    why: `You saved it under ${r.topic}. It takes about ${r.minutes} min, so it fits.`,
    href: r.url,
    say: `${verb.toLowerCase()} "${r.title}", which you saved, about ${r.minutes} minutes`,
  };
}

// ---------- reading it from what someone says ----------

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, 'a few': 5, 'a couple of': 2, 'a couple': 2, couple: 2, few: 5,
};
const PLACE = /\b(on the (train|bus|tube|subway|metro|platform)|commut(e|ing)|in (a|the) queue|in line|waiting|getting (ready|dressed)|dressing up|walking|on my (way|break|lunch)|lunch break|coffee break|spare (time|minutes)|dead time|between (meetings|things|classes))\b/i;
const HANDS_BUSY = /\b(getting (ready|dressed)|dressing( up)?|walking|driving|cooking|in the shower|hands (are )?(full|busy)|can'?t (look|read|see)|eyes (are )?busy|on the (bus|train|tube) standing)\b/i;

/**
 * "I have 10 minutes on the train" -> { minutes: 10, mode: 'screen' }
 * "Getting dressed, got 5 minutes" -> { minutes: 5, mode: 'audio' }
 * Returns null when it isn't about spare time.
 */
export function parseSpareRequest(text: string, fallbackMode: SpareMode = 'audio'): { minutes: number; mode: SpareMode } | null {
  const t = text.toLowerCase();
  const m =
    t.match(/\b(\d{1,3})\s*(?:-|\s)?(?:min(?:ute)?s?|mins?)\b/) ??
    t.match(/\b(a few|a couple of|a couple|couple|few|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty)\s+(?:spare\s+|free\s+)?min(?:ute)?s?\b/);
  const half = /\bhalf an hour\b/.test(t) ? 30 : /\b(an|one) hour\b/.test(t) ? 60 : null;
  const mins = m ? Number(m[1]) || WORD_NUM[m[1]] : half;
  const place = PLACE.test(t);
  // A number of minutes alone ("remind me in 10 minutes", "a 30 min task") isn't spare time
  const free = /\b(i (have|got|'ve got)|i've|got|have|with)\b[^.?!]*\b(min|minutes?|hour)\b/.test(t) || /\bspare|free\b/.test(t);
  if (!place && !(mins && free)) return null;
  if (/\b(remind me|add|task|schedule|book)\b/.test(t) && !place) return null;
  return {
    minutes: Math.min(20, Math.max(2, mins ?? 10)),
    mode: HANDS_BUSY.test(t) ? 'audio' : /\b(read|look|screen|tap)\b/.test(t) ? 'screen' : fallbackMode,
  };
}

/** What Ropi says about a plan */
export function speakPlan(plan: SparePlan): string {
  if (!plan.steps.length) return `You've got ${plan.minutes} minutes. Ask me what something means, or say "quiz me" and I'll test you out loud.`;
  const [first, ...rest] = plan.steps;
  const min = (n: number) => `${n} minute${n === 1 ? '' : 's'}`;
  const then = rest.length ? ` Then ${rest.map((s) => `${s.say}, ${min(s.minutes)}`).join('. After that, ')}.` : '';
  return `You've got ${min(plan.minutes)}. First, ${first.say}, about ${min(first.minutes)}.${then} Say "start" or tap the first one.`;
}
