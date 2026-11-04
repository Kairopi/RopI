/**
 * Ropi, out loud: turn one thing you said into one useful reply.
 *
 * 1. Route: Meta Muse reads the sentence and returns the intent and its details
 *    (topic, role, place, task). Regex rules take over if Muse is unavailable.
 * 2. Act with real data, never invented:
 *      explain   your own notes first (Ask Ropi retrieval), then Muse explains simply
 *      news      Meta search grounding (live web, cited URLs)
 *      podcast   Apple Podcasts search, with each show's latest episode to play
 *      quiz      starts a hands-free voice quiz on the topic
 *      plan      your plan, quiz history and cards, cited (Ask Ropi)
 *      spare     "I have 10 minutes on the train": the best use of that time, from your data
 *      add       adds a task to your week (Ropi finds the time)
 *      jobs      searches the 5 job sources
 *      cv        tailors your resume for your latest saved job (you review it)
 *      form      drafts an answer to an application question from your resume
 *      apply     says plainly that Ropi doesn't submit applications, and offers to help
 *      chat      short coaching reply
 * 3. Reply in a spoken style (no markdown, no citation brackets), plus cards
 *    for anything you'd want to tap: sources, podcasts, jobs, a quiz to start.
 */

import { callMuse, callMuseWithWebSearch, isMuseConfigured, MUSE_MODELS } from '@/lib/api/muse';
import { askRopi, retrieve, type PlanContext } from '@/lib/knowledge/ask';
import { findPodcasts, type PodcastPick } from './podcasts';
import { searchAllJobs, type JobPosting } from '@/lib/jobs/sources';
import { getBaseResume, getUserJobs, tailorResumeForJob } from '@/lib/jobs/job-service';
import { parseQuickAdd } from '@/lib/week/quick-add';
import type { Turn } from '@/lib/library/store';
import { parseSpareRequest, planSpareTime, speakPlan, type SpareInput, type SpareStep } from '@/lib/spare/plan';

export type Intent = 'explain' | 'news' | 'podcast' | 'quiz' | 'plan' | 'spare' | 'add' | 'jobs' | 'cv' | 'form' | 'apply' | 'chat';

export interface Routed {
  intent: Intent;
  topic: string | null;
  role?: string | null;
  location?: string | null;
  task?: { title: string; minutes: number; due: string | null } | null;
  question?: string | null;
}

export interface Reply {
  intent: Intent;
  /** What Ropi says (and shows) */
  text: string;
  topic: string | null;
  sources?: { title: string; url: string }[];
  podcasts?: PodcastPick[];
  jobs?: JobPosting[];
  /** A page to open, e.g. the voice quiz it just set up */
  open?: { label: string; href: string; auto?: boolean };
  /** A task it added to your week */
  added?: { title: string; minutes: number; due: string | null };
  /** Text you might copy (form answers) */
  draft?: string;
  /** What to do with the minutes you have, in order */
  steps?: SpareStep[];
}

export interface CoachContext {
  userId: string;
  plan: PlanContext;
  goal: string | null;
  history: Turn[];
  /** What the learning and job loops know (due cards, weak spots, jobs) */
  spare?: Pick<SpareInput, 'dueCards' | 'weakSpots' | 'jobs'>;
  addTask: (t: { title: string; duration: number; priority: 'P1' | 'P2' | 'P3'; deadline?: string; category: 'learning' | 'career' | 'life'; tags?: string[] }) => void;
}

/** Spoken style: no markdown, no [H1] markers, no URLs read aloud */
export const speakable = (s: string) =>
  s
    .replace(/\[[A-Z]\d{1,2}(?:,\s*[A-Z]\d{1,2})*\]/g, '')
    .replace(/\(?https?:\/\/\S+\)?/g, '')
    .replace(/[*_#`>]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

// ---------- 1. routing ----------

const RULES: [Intent, RegExp][] = [
  ['apply', /\b(apply (for me|to (it|them|this))|submit (my|the) application|send (my|the) application)\b/i],
  ['form', /\b(form|cover letter|answer (this|the) question|application question|why do you want|tell me about yourself)\b/i],
  ['cv', /\b(cv|resume|résumé)\b.*\b(tailor|create|make|write|update|improve)\b|\b(tailor|create|make|write|update|improve)\b.*\b(cv|resume|résumé)\b/i],
  ['jobs', /\b(jobs?|roles?|openings?|vacanc(y|ies)|positions?)\b/i],
  ['podcast', /\b(podcasts?|listen to|something to listen)\b/i],
  ['news', /\b(news|latest|what'?s new|what is new|recent(ly)?|this week in|updates? on)\b/i],
  ['quiz', /\b(quiz|test me|ask me (some )?questions|practice questions)\b/i],
  ['add', /\b(remind me|add (a )?task|add .* to my (week|plan|list)|i need to|i have to|put .* in my (week|plan))\b/i],
  ['plan', /\b(what should i (do|study)|what'?s next|(what'?s|plan for) (today|tonight)|my (plan|week|day|schedule)|weak(est)?|struggl|getting wrong|how am i doing|progress)\b/i],
  ['explain', /\b(what (does|is|are|do)|what'?s|explain|mean(s|ing)?|i('?m| am) (lost|confused|stuck)|don'?t (get|understand)|how (does|do|is)|why (does|is|do))\b/i],
];

export function routeWithRules(text: string): Routed {
  const ruled = RULES.find(([, re]) => re.test(text))?.[0];
  // "I have 10 minutes" wins over a general "what should I do", not over a specific ask
  const intent: Intent = parseSpareRequest(text) && (!ruled || ruled === 'plan' || ruled === 'add') ? 'spare' : ruled ?? 'chat';
  // Topic: the words after "on/about/for/in/of" or after the trigger
  const m = text.match(/\b(?:on|about|for|regarding|of)\s+(.+?)(?:\s+(?:in|near|for me|please|today|tonight|tomorrow)\b|[?.!]|$)/i);
  const topic = m?.[1]?.replace(/\s+(?:under|less than|up to)\s+\d+\s*min(?:ute)?s?$/i, '').trim() || null;
  const jobs = text.match(/(?:find|search|look for|show)?\s*(?:me\s+)?(.+?)\s+(?:jobs?|roles?)(?:\s+in\s+(.+?))?[?.!]?$/i);
  return {
    intent,
    topic,
    role: intent === 'jobs' ? jobs?.[1]?.replace(/^(some|any|a|the)\s+/i, '').trim() || topic : null,
    location: intent === 'jobs' ? jobs?.[2]?.trim() || null : null,
    task: null,
    question: intent === 'form' ? text : null,
  };
}

async function route(text: string, ctx: CoachContext): Promise<Routed> {
  if (!isMuseConfigured()) return routeWithRules(text);
  const today = new Date();
  const recent = ctx.history.slice(-4).map((t) => `${t.role === 'you' ? 'User' : 'Ropi'}: ${t.text.slice(0, 200)}`).join('\n');
  try {
    const raw = await callMuse(
      `Classify what the user wants from Ropi, a study and career coach. Today is ${today.toDateString()}.
Their goal: ${ctx.goal ?? 'not set'}.
Recent conversation (for "it", "that", "this"):
${recent || '(none)'}

User just said: "${text.replace(/"/g, "'").slice(0, 500)}"

intents:
- explain: they're lost or ask what something means / how it works
- news: latest news or updates on a topic
- podcast: something to listen to
- quiz: they want to be quizzed / tested
- spare: they say how much time they have or where they are (commute, waiting, getting dressed) and want the best use of it, without asking for one specific thing
- plan: what to do today, their progress, what they get wrong
- add: add a task or reminder to their week
- jobs: find jobs (role + optional place)
- cv: create / tailor / improve their CV or resume
- form: help answering a job application form question or cover letter
- apply: they ask Ropi to submit an application for them
- chat: anything else (motivation, small talk)

Return ONLY JSON:
{"intent": "...", "topic": "short topic or null (resolve 'it' from the conversation)", "role": "job title or null", "location": "place or null", "task": {"title": "...", "minutes": 30, "due": "YYYY-MM-DD or null"} or null, "question": "the form question or null"}`,
      { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 1500, timeoutMs: 12000 }
    );
    const j = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
    const intents: Intent[] = ['explain', 'news', 'podcast', 'quiz', 'plan', 'spare', 'add', 'jobs', 'cv', 'form', 'apply', 'chat'];
    if (!intents.includes(j.intent)) return routeWithRules(text);
    if ((j.intent === 'plan' || j.intent === 'chat') && parseSpareRequest(text)) j.intent = 'spare';
    const minutes = Number(j.task?.minutes);
    return {
      intent: j.intent,
      topic: typeof j.topic === 'string' && j.topic.trim() && j.topic !== 'null' ? j.topic.trim().slice(0, 80) : null,
      role: typeof j.role === 'string' && j.role !== 'null' ? j.role.trim().slice(0, 80) : null,
      location: typeof j.location === 'string' && j.location !== 'null' ? j.location.trim().slice(0, 80) : null,
      task: j.task?.title ? { title: String(j.task.title).slice(0, 120), minutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(480, Math.round(minutes)) : 30, due: /^\d{4}-\d{2}-\d{2}$/.test(j.task.due ?? '') ? j.task.due : null } : null,
      question: typeof j.question === 'string' && j.question !== 'null' ? j.question : null,
    };
  } catch {
    return routeWithRules(text);
  }
}

// ---------- 2. acting ----------

const SPOKEN =
  'Write it the way you would say it to them: warm, plain, direct sentences. No greeting like "hey friend", no markdown, no lists, no emojis. Write numbers, dates and codes normally (e.g. "Nov 17", "SAP-C02"), it will be shown as well as read aloud.';

async function explain(text: string, topic: string | null, ctx: CoachContext): Promise<Reply> {
  const evidence = await retrieve(text, null).catch(() => []);
  const notes = evidence.filter((e) => e.kind === 'note' || e.kind === 'card').slice(0, 4);
  const block = notes.map((e) => `[${e.title}] ${e.text.slice(0, 700)}`).join('\n');
  const out = await callMuse(
    `${ctx.history.length ? `Conversation so far:\n${ctx.history.slice(-4).map((t) => `${t.role}: ${t.text.slice(0, 200)}`).join('\n')}\n\n` : ''}The user is studying and said: "${text.slice(0, 500)}"
${block ? `Their own notes and review cards on this (prefer these, and say "from your notes" when you use them):\n${block}\n` : ''}
Explain it simply, like a friendly tutor talking to someone getting dressed or on a train: one plain-English idea, one everyday example, then one short question to check they've got it. At most 90 words. ${SPOKEN}
Return ONLY JSON: {"answer": "..."}`,
    { model: MUSE_MODELS.fast, reasoningEffort: 'low', json: true, maxTokens: 3000, timeoutMs: 30000 }
  );
  const answer = String(JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? out).answer ?? '').trim();
  return {
    intent: 'explain',
    topic,
    text: answer || "I couldn't put that together just now. Try asking it a different way?",
    sources: notes.filter((e) => e.sourceId).map((e) => ({ title: `Your notes: ${e.title}`, url: `/quiz/new?source=${e.sourceId}` })),
    open: topic ? { label: `Quiz me on ${topic}`, href: `/voice-quiz?quiz=new&topic=${encodeURIComponent(topic)}&start=1` } : undefined,
  };
}

async function news(topic: string, ctx: CoachContext): Promise<Reply> {
  const r = await callMuseWithWebSearch(
    `Search the web for the latest news (last few weeks) about exactly this: ${topic}. Start straight with the first update (no preamble). Give the 2 or 3 most useful recent updates, each with its date, in at most 90 words total. ${SPOKEN} Only include things you found in the search results; if you found nothing recent, say so.${ctx.goal ? ` (For context, they are working toward "${ctx.goal}", but stay on the topic asked.)` : ''}`
  );
  return {
    intent: 'news',
    topic,
    text: r.text,
    sources: r.citations.slice(0, 5),
  };
}

async function podcast(topic: string, text = ''): Promise<Reply> {
  // "under 15 minutes": put an episode that fits first
  const max = Number(text.match(/\b(?:under|less than|shorter than|max(?:imum)?|up to)\s+(\d{1,3})\s*min/i)?.[1]) || null;
  const found = await findPodcasts(topic, max ? 6 : 3);
  const fits = (p: PodcastPick) => !!max && !!p.episode && p.episode.minutes > 0 && p.episode.minutes <= max;
  const picks = max ? [...found.filter(fits), ...found.filter((p) => !fits(p)).sort((a, b) => (a.episode?.minutes || 999) - (b.episode?.minutes || 999))].slice(0, 3) : found;
  if (!picks.length) return { intent: 'podcast', topic, text: `I couldn't find a podcast on ${topic}. Try a broader topic?` };
  const top = picks[0];
  if (max && !fits(top) && top.episode)
    return { intent: 'podcast', topic, podcasts: picks, text: `None of the latest episodes on ${topic} are under ${max} minutes. The closest is ${top.show}, "${top.episode.title}", ${top.episode.minutes} minutes. You could listen to the first part and finish it later.` };
  const ep = top.episode;
  return {
    intent: 'podcast',
    topic,
    podcasts: picks,
    text: ep
      ? `Try ${top.show}. The latest episode is "${ep.title}", ${ep.minutes} minutes${ep.minutes <= 30 ? ', good for one commute' : ''}. Say "play it" and I'll start it, or pick another below.`
      : `Try ${top.show} by ${top.author}. I've put two more below.`,
  };
}

async function plan(text: string, ctx: CoachContext): Promise<Reply> {
  const a = await askRopi(text, ctx.plan);
  const next = ctx.plan.upcoming[0];
  return {
    intent: 'plan',
    topic: a.cited.find((e) => e.topic)?.topic ?? null,
    text: speakable(a.text) || (next ? `Next up is ${next.title}, ${next.when}, for ${next.minutes} minutes.` : "Your week is clear. Want me to add something?"),
    open: a.action ? { label: a.action.label, href: a.action.href } : undefined,
  };
}

function add(text: string, r: Routed, ctx: CoachContext): Reply {
  const qa = parseQuickAdd(text);
  const title = r.task?.title ?? qa?.title ?? text;
  const minutes = r.task?.minutes ?? qa?.duration ?? 30;
  const due = r.task?.due ? new Date(`${r.task.due}T22:00`).toISOString() : qa?.deadline?.toISOString();
  const category = qa?.category ?? 'life';
  ctx.addTask({ title, duration: minutes, priority: 'P2', deadline: due, category, tags: category === 'learning' ? ['study'] : undefined });
  const dueWord = due ? ` by ${new Date(due).toLocaleDateString('en-US', { weekday: 'long' })}` : '';
  return {
    intent: 'add',
    topic: null,
    added: { title, minutes, due: due ?? null },
    text: `Added "${title}", ${minutes} minutes${dueWord}. I'll fit it into your free time and you'll see it on Today.`,
  };
}

async function jobs(r: Routed): Promise<Reply> {
  const role = r.role || r.topic;
  if (!role) return { intent: 'jobs', topic: null, text: 'What kind of role, and where? For example: product manager jobs in London.' };
  const found = await searchAllJobs(role, r.location ?? '', ['remote', 'hybrid', 'onsite']);
  const top = found.postings.slice(0, 3);
  if (!top.length) return { intent: 'jobs', topic: role, text: `I didn't find ${role} roles${r.location ? ` in ${r.location}` : ''} right now. Want me to try remote ones?` };
  const answered = found.sources.filter((s) => s.count > 0).length;
  return {
    intent: 'jobs',
    topic: role,
    jobs: found.postings.slice(0, 6),
    text: `I found ${found.postings.length} ${role} roles${r.location ? ` in or near ${r.location}` : ''} across ${answered} job sites. Top ones: ${top.map((p) => `${p.title} at ${p.company}`).join('; ')}. Save any you like and I'll score your resume against it.`,
    open: { label: 'Open Jobs', href: '/jobs' },
  };
}

async function cv(ctx: CoachContext): Promise<Reply> {
  const base = await getBaseResume(ctx.userId);
  if (!base) return { intent: 'cv', topic: null, text: "First I need your resume. Open Jobs and paste it in once, then ask me again and I'll tailor it for a job.", open: { label: 'Add my resume', href: '/jobs' } };
  const saved = (await getUserJobs(ctx.userId)).filter((j) => (j.description ?? '').trim().length > 40 && !['applied', 'interviewing', 'offered', 'rejected'].includes(j.status));
  const job = saved[0];
  if (!job) return { intent: 'cv', topic: null, text: 'Save a job first, then I can tailor your resume for it. Want me to search for roles?', open: { label: 'Find jobs', href: '/jobs' } };
  await tailorResumeForJob(ctx.userId, job.id, base.id, 'normal');
  return {
    intent: 'cv',
    topic: job.job_title,
    text: `Done. I tailored your resume for ${job.job_title} at ${job.company}, using only what's already in it. Have a look in Jobs before you use it.`,
    open: { label: 'Review it in Jobs', href: '/jobs' },
  };
}

async function form(text: string, r: Routed, ctx: CoachContext): Promise<Reply> {
  const base = await getBaseResume(ctx.userId).catch(() => null);
  const resume = base ? (typeof base.content === 'string' ? base.content : JSON.stringify(base.content)).slice(0, 4000) : '';
  const saved = await getUserJobs(ctx.userId).catch(() => []);
  const job = saved.find((j) => !['offered', 'rejected'].includes(j.status));
  const out = await callMuse(
    `Draft an answer to this job application question for the user, in first person.
Question: "${(r.question ?? text).slice(0, 500)}"
${job ? `Job: ${job.job_title} at ${job.company}. ${String(job.description ?? '').slice(0, 1500)}` : ''}
${resume ? `Their resume (use only facts from it, never invent):\n${resume}` : 'No resume on file: keep it general and mark [add your example] where a real example belongs.'}
Under 150 words. Return ONLY JSON: {"draft": "...", "spoken": "one sentence telling them what you wrote and what to check"}`,
    { model: MUSE_MODELS.fast, reasoningEffort: 'low', json: true, maxTokens: 3000, timeoutMs: 30000 }
  );
  const j = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? out);
  return { intent: 'form', topic: job?.job_title ?? null, draft: String(j.draft ?? '').trim(), text: String(j.spoken ?? 'Here is a draft. Check it reads like you before you paste it.') };
}

async function chat(text: string, ctx: CoachContext): Promise<Reply> {
  const next = ctx.plan.upcoming[0];
  const out = await callMuse(
    `You are Ropi, a calm, encouraging study and career coach for people who are changing careers, often after moving abroad, and fit learning into small gaps in their day.
Their goal: ${ctx.goal ?? 'not set yet'}. ${next ? `Their next planned block: ${next.title}, ${next.when}.` : ''}
Recent conversation:\n${ctx.history.slice(-6).map((t) => `${t.role}: ${t.text.slice(0, 200)}`).join('\n') || '(none)'}
They said: "${text.slice(0, 500)}"
Reply in at most 60 words. Be specific and practical; end with one small next step they can do in 10 minutes. ${SPOKEN}
Return ONLY JSON: {"answer": "..."}`,
    { model: MUSE_MODELS.fast, reasoningEffort: 'low', json: true, maxTokens: 2000, timeoutMs: 25000 }
  );
  return { intent: 'chat', topic: null, text: String(JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? out).answer ?? '').trim() || "I'm here. What would help most right now?" };
}

// ---------- 3. one turn ----------

export async function respond(text: string, ctx: CoachContext): Promise<Reply> {
  const r = await route(text, ctx);
  const topic = r.topic ?? ctx.history.slice().reverse().find((t) => t.kind && t.role === 'ropi')?.kind?.split(':')[1] ?? null;
  try {
    switch (r.intent) {
      case 'explain':
        return await explain(text, r.topic, ctx);
      case 'news':
        return topic ? await news(topic, ctx) : { intent: 'news', topic: null, text: 'News on what? For example: latest news on project management.' };
      case 'podcast':
        return await podcast(topic ?? ctx.goal ?? 'career change', text);
      case 'spare': {
        const req = parseSpareRequest(text) ?? { minutes: 10, mode: 'audio' as const };
        const p = planSpareTime({ ...req, dueCards: 0, weakSpots: [], jobs: [], ...ctx.spare, goal: ctx.goal });
        const first = p.steps[0];
        return {
          intent: 'spare',
          topic: null,
          steps: p.steps,
          text: speakPlan(p),
          open: first ? { label: `Start: ${first.title}`, href: first.href } : undefined,
        };
      }
      case 'quiz': {
        const t = topic ?? ctx.goal;
        if (!t) return { intent: 'quiz', topic: null, text: 'Happy to. Which topic should I quiz you on?' };
        return { intent: 'quiz', topic: t, text: `Okay, a quick voice quiz on ${t}. I'll read each question and you just say the letter.`, open: { label: `Start the ${t} quiz`, href: `/voice-quiz?quiz=new&topic=${encodeURIComponent(t)}&start=1`, auto: true } };
      }
      case 'plan':
        return await plan(text, ctx);
      case 'add':
        return add(text, r, ctx);
      case 'jobs':
        return await jobs(r);
      case 'cv':
        return await cv(ctx);
      case 'form':
        return await form(text, r, ctx);
      case 'apply':
        return {
          intent: 'apply',
          topic: null,
          text: "I won't submit applications for you, so nothing goes out that you haven't checked. I can find the role, tailor your resume, and draft answers for the form. Read me a question from it and I'll write a first draft.",
          open: { label: 'Open Jobs', href: '/jobs' },
        };
      default:
        return await chat(text, ctx);
    }
  } catch (e) {
    return { intent: r.intent, topic, text: `Sorry, that didn't work just now (${e instanceof Error ? e.message : 'unknown error'}). Try again in a moment?` };
  }
}
