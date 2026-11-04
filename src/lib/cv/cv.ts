/**
 * Your CV as structured data: edit it, pick a design, download PDF or Word.
 *
 * Muse turns an existing resume into these fields (cvFromText) and tailors the
 * wording to a job (tailorCv). Neither may invent anything: only the summary,
 * bullet wording/order and skill order change; names, companies, dates and
 * schools always come from what you wrote.
 */
import { callMuse, isMuseConfigured, MUSE_MODELS } from '@/lib/api/muse';

export interface CvExperience {
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
}
export interface CvEducation {
  school: string;
  degree: string;
  start: string;
  end: string;
  detail: string;
}
export interface CvProject {
  name: string;
  detail: string;
  link: string;
}
export interface CV {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  summary: string;
  experience: CvExperience[];
  education: CvEducation[];
  skills: string[];
  certifications: string[];
  projects: CvProject[];
}

export type CvTemplate = 'classic' | 'modern' | 'sidebar';
export const TEMPLATES: { id: CvTemplate; name: string; note: string }[] = [
  { id: 'classic', name: 'Classic', note: 'One column, centred name. Reads cleanly in any application system.' },
  { id: 'modern', name: 'Modern', note: 'One column with a colour accent. Also safe for application systems.' },
  { id: 'sidebar', name: 'Sidebar', note: 'Two columns. Looks great printed; some application systems read it less well.' },
];
export const ACCENTS = ['#2747d6', '#0f766e', '#7c3aed', '#be123c', '#1f2937'] as const;

export const emptyExperience = (): CvExperience => ({ role: '', company: '', location: '', start: '', end: '', bullets: [''] });
export const emptyEducation = (): CvEducation => ({ school: '', degree: '', start: '', end: '', detail: '' });
export const emptyProject = (): CvProject => ({ name: '', detail: '', link: '' });

export function emptyCv(name = ''): CV {
  return { name, headline: '', email: '', phone: '', location: '', links: [], summary: '', experience: [emptyExperience()], education: [emptyEducation()], skills: [], certifications: [], projects: [] };
}

const str = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strs = (v: unknown, max = 40, len = 300) => (Array.isArray(v) ? v.map((x) => str(x, len)).filter(Boolean).slice(0, max) : []);

/** Any object -> a valid CV (missing fields become empty) */
export function normalizeCv(raw: unknown): CV {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]).filter((x) => x && typeof x === 'object') : []);
  return {
    name: str(o.name, 120),
    headline: str(o.headline, 160),
    email: str(o.email, 160),
    phone: str(o.phone, 60),
    location: str(o.location, 120),
    links: strs(o.links, 5, 200),
    summary: str(o.summary, 1200),
    experience: arr(o.experience).slice(0, 12).map((e) => ({
      role: str(e.role, 160),
      company: str(e.company, 160),
      location: str(e.location, 120),
      start: str(e.start, 30),
      end: str(e.end, 30),
      bullets: strs(e.bullets, 10, 400),
    })),
    education: arr(o.education).slice(0, 6).map((e) => ({ school: str(e.school, 160), degree: str(e.degree, 200), start: str(e.start, 30), end: str(e.end, 30), detail: str(e.detail, 300) })),
    skills: strs(o.skills, 40, 60),
    certifications: strs(o.certifications, 12, 160),
    projects: arr(o.projects).slice(0, 6).map((p) => ({ name: str(p.name, 160), detail: str(p.detail, 400), link: str(p.link, 200) })),
  };
}

/** Plain text, one standard section after another: what application systems read best */
export function cvToText(cv: CV): string {
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);
  push(cv.name);
  if (cv.headline) push(cv.headline);
  const contact = [cv.email, cv.phone, cv.location, ...cv.links].filter(Boolean).join(' | ');
  if (contact) push(contact);
  if (cv.summary) push('', 'SUMMARY', cv.summary);
  const exp = cv.experience.filter((e) => e.role || e.company);
  if (exp.length) {
    push('', 'EXPERIENCE');
    for (const e of exp) {
      push('', [e.role, e.company].filter(Boolean).join(', ') + (e.location ? ` (${e.location})` : ''));
      if (e.start || e.end) push([e.start, e.end].filter(Boolean).join(' – '));
      for (const b of e.bullets.filter(Boolean)) push(`- ${b}`);
    }
  }
  const edu = cv.education.filter((e) => e.school || e.degree);
  if (edu.length) {
    push('', 'EDUCATION');
    for (const e of edu) push([e.degree, e.school].filter(Boolean).join(', ') + (e.start || e.end ? ` (${[e.start, e.end].filter(Boolean).join(' – ')})` : '') + (e.detail ? `. ${e.detail}` : ''));
  }
  if (cv.skills.length) push('', 'SKILLS', cv.skills.join(', '));
  if (cv.certifications.length) push('', 'CERTIFICATIONS', ...cv.certifications.map((c) => `- ${c}`));
  const proj = cv.projects.filter((p) => p.name);
  if (proj.length) push('', 'PROJECTS', ...proj.map((p) => `- ${p.name}${p.detail ? `: ${p.detail}` : ''}${p.link ? ` (${p.link})` : ''}`));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const SHAPE = `{"name":"","headline":"","email":"","phone":"","location":"","links":[""],"summary":"","experience":[{"role":"","company":"","location":"","start":"","end":"","bullets":[""]}],"education":[{"school":"","degree":"","start":"","end":"","detail":""}],"skills":[""],"certifications":[""],"projects":[{"name":"","detail":"","link":""}]}`;

function parseJson(out: string): unknown {
  return JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? out);
}

/** An existing resume (any layout, as text) -> CV fields. Copies, never invents. */
export async function cvFromText(text: string): Promise<CV> {
  if (!isMuseConfigured()) throw new Error('Meta Muse is not set up, so Ropi can’t read the resume.');
  const out = await callMuse(
    `Split this resume into fields. Copy the person's own words; do not add, improve or invent anything. Keep dates exactly as written (e.g. "Jan 2022", "Present"). One bullet per achievement or duty line. If a field isn't there, leave it empty.
headline = their current or target job title, if stated.
Return ONLY JSON in this shape:
${SHAPE}

RESUME:
${text.slice(0, 14000)}`,
    { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 8000, timeoutMs: 60000 }
  );
  const cv = normalizeCv(parseJson(out));
  if (!cv.name && !cv.experience.length) throw new Error('Ropi couldn’t find a name or any jobs in that text.');
  if (!cv.experience.length) cv.experience = [emptyExperience()];
  if (!cv.education.length) cv.education = [emptyEducation()];
  return cv;
}

const BANNED = /\b(spearheaded|revolutionized|synergy|leverag\w*|game-changer|world-class|cutting-edge|rockstar|ninja|guru|visionary|thought leader|paradigm)\b/gi;

/** A 2-3 sentence summary from what's already in the CV (no new facts or numbers) */
export async function writeSummary(cv: CV): Promise<string> {
  if (!isMuseConfigured()) throw new Error('Meta Muse is not set up, so Ropi can’t write it.');
  const facts = { headline: cv.headline, experience: cv.experience.map((e) => ({ role: e.role, company: e.company, start: e.start, end: e.end, bullets: e.bullets.filter(Boolean) })), education: cv.education, skills: cv.skills, certifications: cv.certifications };
  const out = await callMuse(
    `Write a CV summary: 2 or 3 short sentences, no "I", plain confident words, for someone ${cv.headline ? `going for ${cv.headline} roles` : 'job hunting'}. Use ONLY facts below; no numbers, tools or employers that aren't there. Never use: passionate, results-driven, leverage, spearheaded, synergy, world-class.
Return ONLY JSON: {"summary": ""}

${JSON.stringify(facts).slice(0, 8000)}`,
    { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 2000, timeoutMs: 30000 }
  );
  const s = str((parseJson(out) as { summary?: unknown }).summary, 900).replace(BANNED, '').replace(/\s{2,}/g, ' ').trim();
  const have = new Set(JSON.stringify(facts).match(/\d[\d,.%]*/g) ?? []);
  if (!s) throw new Error('Muse didn’t write a summary. Try again.');
  if ((s.match(/\d[\d,.%]*/g) ?? []).some((n) => !have.has(n))) throw new Error('That draft had a number that isn’t in your CV, so Ropi dropped it. Try again.');
  return s;
}

export interface TailorChange {
  where: string;
  what: string;
}

/**
 * Tailor the wording to one job. Only the summary, the order and wording of
 * bullets, and the order of skills can change. Facts stay yours: a bullet that
 * brings in a number that wasn't in the original is put back.
 */
export async function tailorCv(cv: CV, job: { title: string; company: string; description: string }): Promise<{ cv: CV; changes: TailorChange[] }> {
  if (!isMuseConfigured()) throw new Error('Meta Muse is not set up, so Ropi can’t tailor it.');
  const input = {
    summary: cv.summary,
    skills: cv.skills,
    experience: cv.experience.map((e, i) => ({ i, role: e.role, company: e.company, bullets: e.bullets.filter(Boolean) })),
  };
  const out = await callMuse(
    `Tailor this CV to the job below, honestly.
You may: rewrite the summary (2-3 sentences, first person implied, no "I"), reorder and lightly reword bullets to use the job's own words where the bullet already shows that skill, and reorder skills so the most relevant come first.
You may NOT: add jobs, employers, dates, degrees, tools, numbers or results that aren't in the CV. Never use: spearheaded, leverage, synergy, world-class, cutting-edge.
Return ONLY JSON: {"summary": "", "skills": [""], "experience": [{"i": 0, "bullets": [""]}], "changes": [{"where": "Summary", "what": "max 14 words"}]}

JOB: ${job.title} at ${job.company}
${job.description.slice(0, 6000)}

CV:
${JSON.stringify(input)}`,
    { model: MUSE_MODELS.fast, reasoningEffort: 'low', json: true, maxTokens: 8000, timeoutMs: 60000 }
  );
  const j = parseJson(out) as { summary?: unknown; skills?: unknown; experience?: { i?: number; bullets?: unknown }[]; changes?: { where?: unknown; what?: unknown }[] };

  const numbers = (s: string) => new Set(s.match(/\d[\d,.%]*/g) ?? []);
  const next: CV = structuredClone(cv);
  const summary = str(j.summary, 1200).replace(BANNED, '').replace(/\s{2,}/g, ' ');
  const allNumbers = numbers(JSON.stringify(cv));
  if (summary && [...numbers(summary)].every((n) => allNumbers.has(n))) next.summary = summary;

  // Skills: the same skills in a better order (anything new is dropped)
  const have = new Map(cv.skills.map((s) => [s.toLowerCase(), s]));
  const ordered = strs(j.skills, 40, 60).map((s) => have.get(s.toLowerCase())).filter((s): s is string => !!s);
  if (ordered.length) next.skills = [...new Set([...ordered, ...cv.skills])];

  for (const e of j.experience ?? []) {
    const i = Number(e.i);
    const orig = cv.experience[i];
    if (!orig) continue;
    const origNums = numbers(orig.bullets.join(' '));
    const bullets = strs(e.bullets, 10, 400)
      .map((b) => b.replace(BANNED, '').replace(/\s{2,}/g, ' ').trim())
      .filter((b) => [...numbers(b)].every((n) => origNums.has(n)));
    if (bullets.length >= Math.min(orig.bullets.filter(Boolean).length, 1)) next.experience[i] = { ...orig, bullets };
  }
  const changes = (j.changes ?? []).map((c) => ({ where: str(c.where, 60), what: str(c.what, 160) })).filter((c) => c.what).slice(0, 8);
  return { cv: next, changes };
}

// ---- saved in this browser, per account

const KEY = (userId: string) => `ropi-cv-v1:${userId}`;
export interface SavedCv {
  cv: CV;
  template: CvTemplate;
  accent: string;
  updatedAt: string;
}
export function loadCv(userId: string): SavedCv | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(userId)) ?? 'null');
    return raw ? { ...raw, cv: normalizeCv(raw.cv) } : null;
  } catch {
    return null;
  }
}
export function saveCv(userId: string, s: Omit<SavedCv, 'updatedAt'>) {
  try {
    localStorage.setItem(KEY(userId), JSON.stringify({ ...s, updatedAt: new Date().toISOString() }));
  } catch {
    /* storage full: the editor still works, it just won't be remembered */
  }
}

export const fileBase = (cv: CV) => (cv.name.trim() || 'CV').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_') + '_CV';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
