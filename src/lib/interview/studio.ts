/**
 * Practice studio: speak to a real scenario on camera, watch it back, get a review.
 *
 * Pipeline for one answer:
 *  1. Muse Spark writes scenario prompts for your role (interview, presenting,
 *     onboarding someone, a hard stakeholder conversation).
 *  2. You answer on camera. The video stays on this device. Ropi keeps the
 *     audio and up to 6 still frames.
 *  3. Muse Voice Transcribe turns the audio into text.
 *  4. Ropi measures delivery itself (pace, filler words, long pauses): numbers
 *     from your recording, not opinions.
 *  5. Muse Spark reads the transcript, the numbers and the frames (vision) and
 *     writes the review. Quotes it uses must be in your transcript, or they're
 *     dropped. Camera notes stick to what can be seen (looking at the camera,
 *     posture, framing, light, expression), never guesses about feelings.
 */
import { callMuse, isMuseConfigured, MUSE_MODELS } from '@/lib/api/muse';
import { transcribeRecording } from '@/lib/voice/muse-listen';
import { profileForPrompt } from '@/hooks/useProfile';

import { MUSE_BASE as BASE, museAuth, museReady } from '@/lib/api/config';

export type Kind = 'interview' | 'present' | 'onboard' | 'stakeholder';
export const KINDS: { id: Kind; label: string; note: string }[] = [
  { id: 'interview', label: 'Interview questions', note: 'Scenario and behaviour questions for the role.' },
  { id: 'present', label: 'Present an idea', note: 'A two-minute pitch or update to a room.' },
  { id: 'onboard', label: 'Onboard someone', note: 'Walk a new teammate through how things work.' },
  { id: 'stakeholder', label: 'Hard conversation', note: 'Push back, say no, or deliver bad news well.' },
];

export interface Scenario {
  id: string;
  title: string;
  /** What Ropi says to you */
  prompt: string;
  /** What a strong answer covers, shown after */
  lookFor: string[];
  /** Suggested length */
  seconds: number;
}

export interface Stats {
  seconds: number;
  words: number;
  wpm: number;
  fillers: { word: string; count: number }[];
  fillerTotal: number;
  /** Pauses longer than 2.5 s after you'd started */
  longPauses: number;
  longestPause: number;
}

export interface Review {
  headline: string;
  scores: { structure: number; clarity: number; relevance: number; delivery: number; presence: number };
  strengths: { point: string; quote?: string }[];
  improve: { point: string; quote?: string; better: string }[];
  presence: { frame: number; note: string }[];
  stronger: string;
  drill: string;
}

const parse = <T,>(s: string): T => JSON.parse(s.match(/\{[\s\S]*\}/)?.[0] ?? s);

const FALLBACK: Record<Kind, (role: string) => Scenario[]> = {
  interview: (role) => [
    { id: 'i1', title: 'A project going off track', prompt: `You're a ${role}. Two weeks before launch, a key engineer leaves and the client won't move the date. Walk me through what you do in the first 48 hours.`, lookFor: ['Clarify impact and options first', 'Talk to the client early with choices', 'Re-plan scope, people or date', 'Say what you’d measure'], seconds: 120 },
    { id: 'i2', title: 'Tell me about a conflict', prompt: 'Tell me about a time two people on your team disagreed on how to do something. What did you do, and how did it end?', lookFor: ['Situation and stakes in one line', 'What you did, not the team', 'A clear result', 'What you learned'], seconds: 120 },
    { id: 'i3', title: 'Why this role', prompt: `Why do you want to be a ${role}, and what from your past work will help you most?`, lookFor: ['A real reason, not a slogan', 'Two transferable strengths with examples', 'What you’re doing to close gaps'], seconds: 90 },
  ],
  present: (role) => [
    { id: 'p1', title: 'Pitch a change', prompt: `As a ${role}, pitch one change to how your team works, to your manager, in under two minutes. Say the problem, the change, and how you'll know it worked.`, lookFor: ['Problem first, with a number', 'One clear ask', 'How success is measured', 'A strong close'], seconds: 120 },
    { id: 'p2', title: 'Weekly update', prompt: 'Give a 60-second status update: what got done, what’s at risk, and what you need from the room.', lookFor: ['Done / at risk / need', 'Plain words', 'A specific ask'], seconds: 60 },
    { id: 'p3', title: 'Explain it simply', prompt: 'Explain a technical or complex idea from your field to someone with no background, with one everyday example.', lookFor: ['One idea at a time', 'An everyday example', 'Check they followed'], seconds: 90 },
  ],
  onboard: (role) => [
    { id: 'o1', title: 'First-day walkthrough', prompt: `A new teammate joins your team today. As the ${role}, give them a two-minute walkthrough: what the team does, how work flows, and what they should do this week.`, lookFor: ['Big picture first', 'How work moves', 'Three things for week one', 'Who to ask'], seconds: 120 },
    { id: 'o2', title: 'Explain a process', prompt: 'Explain how a piece of work goes from idea to done on your team, as if to a new hire.', lookFor: ['Clear stages', 'Who owns each', 'A tip that saves them time'], seconds: 90 },
    { id: 'o3', title: 'Set expectations', prompt: 'Tell a new hire what good looks like in their first 30 days, kindly and clearly.', lookFor: ['Specific goals', 'How you’ll support them', 'When you’ll check in'], seconds: 90 },
  ],
  stakeholder: () => [
    { id: 's1', title: 'Saying no to a request', prompt: 'A senior stakeholder wants a new feature added this sprint. It would put the launch at risk. Tell them no, and offer a way forward.', lookFor: ['Acknowledge the need', 'Say no clearly, with the reason', 'Offer options', 'Agree a next step'], seconds: 90 },
    { id: 's2', title: 'Delivering bad news', prompt: 'You have to tell the client the project will be two weeks late. Tell them.', lookFor: ['Lead with the news', 'Why, briefly', 'The new plan', 'What you’re doing so it doesn’t happen again'], seconds: 90 },
    { id: 's3', title: 'An upset teammate', prompt: 'A teammate is upset their idea wasn’t picked. Talk to them.', lookFor: ['Listen first', 'Be honest about why', 'Find what they can own next'], seconds: 90 },
  ],
};

/** Three scenarios for your role and goal (Muse), or good defaults if it's unavailable */
export async function makeScenarios(role: string, kind: Kind, job?: { title: string; company: string; description: string } | null): Promise<Scenario[]> {
  const r = role.trim() || 'Project Manager';
  if (!isMuseConfigured()) return FALLBACK[kind](r);
  try {
    const me = profileForPrompt();
    const out = await callMuse(
      `${me ? me + '\n' : ''}Write 3 speaking-practice scenarios for someone going for: ${r}.
Type: ${KINDS.find((k) => k.id === kind)!.label} (${KINDS.find((k) => k.id === kind)!.note})
${job ? `They're preparing for this job: ${job.title} at ${job.company}.\n${job.description.slice(0, 2500)}\n` : ''}
Make them realistic situations this role really faces, said to them directly as the interviewer or the other person would ("A client calls...", "Walk me through..."). Mix: one scenario-based, one about their own experience, one that tests communication. Each 1-3 sentences. Plain words.
lookFor: 3-4 short things a strong answer covers.
Return ONLY JSON: {"scenarios": [{"title": "max 6 words", "prompt": "...", "lookFor": ["..."], "seconds": 90}]}`,
      { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 3000, timeoutMs: 25000 }
    );
    const list = (parse<{ scenarios?: Partial<Scenario>[] }>(out).scenarios ?? [])
      .filter((s) => s?.prompt)
      .slice(0, 3)
      .map((s, i) => ({
        id: `m${i}-${Date.now().toString(36)}`,
        title: String(s.title ?? `Scenario ${i + 1}`).slice(0, 60),
        prompt: String(s.prompt).slice(0, 600),
        lookFor: (Array.isArray(s.lookFor) ? s.lookFor : []).map(String).slice(0, 4),
        seconds: Math.min(180, Math.max(45, Number(s.seconds) || 90)),
      }));
    return list.length ? list : FALLBACK[kind](r);
  } catch {
    return FALLBACK[kind](r);
  }
}

// ---------- audio: decode, measure, transcribe ----------

/** Mono 16 kHz 16-bit WAV (what Muse Voice Transcribe accepts) */
function wav16k(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([buf], { type: 'audio/wav' });
}

export interface Audio {
  wav: Blob;
  seconds: number;
  longPauses: number;
  longestPause: number;
}

/** Recorded audio -> WAV for transcription, plus pause timing from the waveform */
export async function readAudio(recording: Blob): Promise<Audio> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await recording.arrayBuffer());
  void ctx.close();
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const mono = (await off.startRendering()).getChannelData(0);

  // Pauses: 50 ms windows quieter than a threshold learned from the recording itself
  const win = 800;
  const rms: number[] = [];
  for (let i = 0; i + win <= mono.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += mono[j] * mono[j];
    rms.push(Math.sqrt(s / win));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const loud = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const threshold = floor + (loud - floor) * 0.15;
  let started = false;
  let run = 0;
  let longPauses = 0;
  let longest = 0;
  for (const r of rms) {
    if (r > threshold) {
      if (started && run * 0.05 >= 2.5) longPauses++;
      if (started) longest = Math.max(longest, run * 0.05);
      started = true;
      run = 0;
    } else if (started) run++;
  }
  return { wav: wav16k(mono), seconds: decoded.duration, longPauses, longestPause: Math.round(longest * 10) / 10 };
}

export async function transcribe(audio: Audio, keywords: string[]): Promise<string> {
  return transcribeRecording(audio.wav, keywords.slice(0, 30));
}

const FILLERS = ['um', 'uh', 'erm', 'er', 'like', 'you know', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'i mean', 'right'];

/** Pace and fillers, counted from the transcript (Muse Voice Transcribe keeps "um" and "uh") */
export function deliveryStats(transcript: string, audio: Pick<Audio, 'seconds' | 'longPauses' | 'longestPause'>): Stats {
  const t = ` ${transcript.toLowerCase().replace(/[^a-z'\s]/g, ' ').replace(/\s+/g, ' ')} `;
  const words = t.trim() ? t.trim().split(' ').length : 0;
  const fillers = FILLERS.map((w) => ({ word: w, count: t.split(` ${w} `).length - 1 })).filter((f) => f.count > 0).sort((a, b) => b.count - a.count);
  const minutes = Math.max(audio.seconds, 1) / 60;
  return {
    seconds: Math.round(audio.seconds),
    words,
    wpm: Math.round(words / minutes),
    fillers,
    fillerTotal: fillers.reduce((s, f) => s + f.count, 0),
    longPauses: audio.longPauses,
    longestPause: audio.longestPause,
  };
}

/** Plain-words verdicts on the numbers, so nobody has to know what 170 wpm means */
export function statNotes(s: Stats): { label: string; value: string; tone: 'good' | 'ok' | 'work'; note: string }[] {
  const per100 = s.words ? (s.fillerTotal / s.words) * 100 : 0;
  return [
    {
      label: 'Pace',
      value: `${s.wpm} words a minute`,
      tone: s.wpm >= 120 && s.wpm <= 165 ? 'good' : s.wpm >= 100 && s.wpm <= 185 ? 'ok' : 'work',
      note: s.wpm > 165 ? 'A little fast. Slow down on the key point so it lands.' : s.wpm < 120 ? 'A little slow. Fine for thinking out loud; tighten the middle.' : 'A clear, easy pace to follow.',
    },
    {
      label: 'Filler words',
      value: s.fillerTotal ? `${s.fillerTotal} (${s.fillers.slice(0, 3).map((f) => `“${f.word}” ${f.count}`).join(', ')})` : 'None',
      tone: per100 < 2 ? 'good' : per100 < 5 ? 'ok' : 'work',
      note: per100 < 2 ? 'Clean. Pauses instead of fillers sound confident.' : 'Swap a filler for a short silent pause. It sounds more sure.',
    },
    {
      label: 'Long pauses',
      value: s.longPauses ? `${s.longPauses} over 2.5 s (longest ${s.longestPause} s)` : 'None over 2.5 s',
      tone: s.longPauses <= 1 ? 'good' : s.longPauses <= 3 ? 'ok' : 'work',
      note: s.longPauses > 1 ? 'Plan your first sentence and your example before you start.' : 'You kept it flowing.',
    },
    {
      label: 'Length',
      value: `${Math.floor(s.seconds / 60)}:${String(s.seconds % 60).padStart(2, '0')}`,
      tone: s.seconds >= 45 && s.seconds <= 150 ? 'good' : 'ok',
      note: s.seconds < 45 ? 'Short. Add a specific example.' : s.seconds > 150 ? 'Long. Aim for about two minutes.' : 'A good length.',
    },
  ];
}

// ---------- the review (Muse Spark, with the frames) ----------

const clamp = (n: unknown) => Math.min(5, Math.max(1, Math.round(Number(n) || 3)));
const inTranscript = (quote: string | undefined, transcript: string) => {
  if (!quote) return undefined;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  return norm(transcript).includes(norm(quote)) && norm(quote).length > 6 ? quote : undefined;
};

export async function reviewAnswer(input: { role: string; kind: Kind; scenario: Scenario; transcript: string; stats: Stats; frames: string[] }): Promise<Review> {
  if (!museReady) throw new Error('Ropi’s assistant isn’t set up, so it can’t review this.');
  const me = profileForPrompt();
  const text = `${me ? me + '\n' : ''}You are a warm, honest speaking coach helping someone reach the top 10% in their field. They practised for: ${input.role}.
Type: ${KINDS.find((k) => k.id === input.kind)!.label}.
The scenario they answered: "${input.scenario.prompt}"
A strong answer covers: ${input.scenario.lookFor.join('; ')}

Their answer, transcribed word for word:
"""${input.transcript.slice(0, 6000)}"""

Measured from the recording: ${input.stats.seconds} s, ${input.stats.wpm} words a minute, ${input.stats.fillerTotal} filler words${input.stats.fillers.length ? ` (${input.stats.fillers.map((f) => `${f.word} x${f.count}`).join(', ')})` : ''}, ${input.stats.longPauses} pauses over 2.5 s.
${input.frames.length ? `The ${input.frames.length} images are still frames from their camera, in order (frame 1 first).` : 'There is no video.'}

Review it like a great coach: specific, kind, direct. Use their own words.
- scores 1-5: structure (clear start, example, result), clarity (plain words, easy to follow), relevance (answers this scenario for this role), delivery (pace, fillers, pauses, from the numbers), presence (from the frames: looking at the camera, upright posture, face well lit and framed, open expression). If there are no frames, presence = 3.
- strengths: 2 things that worked; quote = exact words from the transcript.
- improve: 2-3 most useful fixes; quote = the exact words to change; better = how to say it instead.
- presence: one short note per frame worth mentioning (frame number from 1), ONLY about what is visible. Never guess feelings or personality.
- stronger: a stronger version of their answer in first person, about 120 words, using ONLY their facts; write [your example] where a real example is missing. Never invent numbers or employers.
- drill: one 2-minute exercise to do next time.
- headline: one sentence verdict that motivates.
Return ONLY JSON: {"headline":"","scores":{"structure":3,"clarity":3,"relevance":3,"delivery":3,"presence":3},"strengths":[{"point":"","quote":""}],"improve":[{"point":"","quote":"","better":""}],"presence":[{"frame":1,"note":""}],"stronger":"","drill":""}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(await museAuth()) },
      body: JSON.stringify({
        model: MUSE_MODELS.fast,
        reasoning_effort: 'minimal',
        max_tokens: 5000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text }, ...input.frames.slice(0, 6).map((url) => ({ type: 'image_url', image_url: { url } }))] }],
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`The review didn’t come back (${res.status}). Try again.`);
    const j = parse<Omit<Partial<Review>, 'scores'> & { scores?: Record<string, unknown> }>(String(data?.choices?.[0]?.message?.content ?? ''));
    const s: Record<string, unknown> = j.scores ?? {};
    return {
      headline: String(j.headline ?? '').slice(0, 240) || 'Good practice. Here’s how to make it stronger.',
      scores: { structure: clamp(s.structure), clarity: clamp(s.clarity), relevance: clamp(s.relevance), delivery: clamp(s.delivery), presence: input.frames.length ? clamp(s.presence) : 3 },
      strengths: (j.strengths ?? []).slice(0, 3).map((x) => ({ point: String(x.point ?? ''), quote: inTranscript(x.quote, input.transcript) })).filter((x) => x.point),
      improve: (j.improve ?? []).slice(0, 3).map((x) => ({ point: String(x.point ?? ''), quote: inTranscript(x.quote, input.transcript), better: String(x.better ?? '') })).filter((x) => x.point),
      presence: input.frames.length ? (j.presence ?? []).filter((p) => Number(p.frame) >= 1 && Number(p.frame) <= input.frames.length && p.note).slice(0, 6).map((p) => ({ frame: Number(p.frame), note: String(p.note).slice(0, 200) })) : [],
      stronger: String(j.stronger ?? '').slice(0, 1500),
      drill: String(j.drill ?? '').slice(0, 400),
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('The review took too long. Try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- your practice over time (in this browser) ----------

export interface PastSession {
  at: string;
  role: string;
  kind: Kind;
  title: string;
  scores: Review['scores'];
  wpm: number;
  fillers: number;
}
const KEY_HISTORY = 'ropi-practice-v1';
export const loadPractice = (): PastSession[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY_HISTORY) ?? '[]');
  } catch {
    return [];
  }
};
export const savePractice = (s: PastSession) => {
  try {
    localStorage.setItem(KEY_HISTORY, JSON.stringify([s, ...loadPractice()].slice(0, 50)));
  } catch {
    /* optional */
  }
};
export const average = (s: Review['scores']) => Math.round(((s.structure + s.clarity + s.relevance + s.delivery + s.presence) / 5) * 10) / 10;
