/**
 * Profile and settings. A few fields about you, so every answer fits you:
 * Talk, explanations, the practice studio and job search all read them.
 * Fill them from your CV in one tap, or let Ropi draft the "about you".
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, IdCard, Loader2, LogOut } from '@/components/icons';
import { useAuth, useUserId } from '@/contexts/AuthContext';
import { useProfile, type Profile as P } from '@/hooks/useProfile';
import { useWeek } from '@/hooks/useWeek';
import { useSidebar } from '@/components/DashboardLayout';
import { callMuse, isMuseConfigured, MUSE_MODELS } from '@/lib/api/muse';
import { loadCv } from '@/lib/cv/cv';
import { cn } from '@/lib/utils';

const VOICE = 'ropi-voice-v1';
const readVoice = () => {
  try {
    return JSON.parse(localStorage.getItem(VOICE) ?? '{}');
  } catch {
    return {};
  }
};

export default function Profile() {
  const navigate = useNavigate();
  const userId = useUserId();
  const { displayName, signOut } = useAuth();
  const profile = useProfile((s) => s.profile);
  const set = useProfile((s) => s.set);
  const goal = useWeek((s) => s.goal);
  const setGoal = useWeek((s) => s.setGoal);
  const { collapsed, toggle } = useSidebar();
  const [goalText, setGoalText] = useState(goal?.title ?? '');
  const [goalDate, setGoalDate] = useState(goal?.targetDate ?? '');
  const [busy, setBusy] = useState<null | 'cv' | 'about'>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [patience, setPatience] = useState<string>(readVoice().patience ?? 'normal');
  const cv = userId ? loadCv(userId) : null;

  useEffect(() => {
    const v = readVoice();
    localStorage.setItem(VOICE, JSON.stringify({ ...v, patience }));
  }, [patience]);

  const saveGoal = () => {
    const t = goalText.trim();
    setGoal(t ? { title: t, ...(goalDate ? { targetDate: goalDate } : {}) } : null);
    setMsg('Goal saved. Today and Talk plan around it.');
  };

  const fillFromCv = () => {
    if (!cv) return navigate('/cv');
    const c = cv.cv;
    const latest = c.experience.find((e) => e.role || e.company);
    set({
      targetRole: profile.targetRole || c.headline,
      location: profile.location || c.location,
      background: profile.background || (latest ? [latest.role, latest.company].filter(Boolean).join(' at ') + (latest.start ? ` (since ${latest.start})` : '') : ''),
      about: profile.about || c.summary,
    });
    setMsg('Filled in from your CV. Change anything that’s off.');
  };

  const draftAbout = async () => {
    if (!isMuseConfigured()) return setMsg('Ropi’s assistant isn’t set up, so it can’t draft this.');
    setBusy('about');
    try {
      const c = cv?.cv;
      const out = await callMuse(
        `Write 2 short sentences, first person, plain and warm, for "about me" in a study and career app. Use ONLY these facts; no new ones.
Goal: ${goalText || 'not set'}. Target role: ${profile.targetRole || 'not set'}. Background: ${profile.background || 'not set'}. Level in the new field: ${profile.level || 'not set'}. Location: ${profile.location || 'not set'}.
${c ? `From their CV: ${c.summary} Skills: ${c.skills.slice(0, 8).join(', ')}.` : ''}
Return ONLY JSON: {"about": ""}`,
        { model: MUSE_MODELS.fast, reasoningEffort: 'minimal', json: true, maxTokens: 1200, timeoutMs: 20000 }
      );
      const about = String(JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] ?? out).about ?? '').trim();
      if (about) set({ about });
      setMsg(about ? 'Drafted. Edit it so it sounds like you.' : 'Nothing came back. Try again.');
    } catch {
      setMsg('That didn’t work just now. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const field = (k: keyof P, label: string, placeholder: string) => (
    <label className="block text-[12.5px] font-medium text-muted-foreground">
      {label}
      <Input value={String(profile[k])} onChange={(e) => set({ [k]: e.target.value } as Partial<P>)} placeholder={placeholder} className="mt-1 text-[13.5px] text-foreground" />
    </label>
  );

  return (
    <DashboardLayout>
      <PageHeader title={`Hi, ${displayName}`} description="A few lines about you, so every answer, plan and practice question fits where you’re heading." />

      {msg && <p role="status" className="mb-4 rounded-lg bg-success/[0.07] px-3.5 py-2.5 text-[13px] text-success">{msg}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold">About you</h2>
              <Button size="sm" variant="outline" onClick={fillFromCv}>
                <IdCard />
                {cv ? 'Fill from my CV' : 'Make a CV first'}
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {field('targetRole', 'The job you want next', 'Project Manager')}
              {field('background', 'What you do now, or did before', 'Retail team lead, 6 years')}
              {field('location', 'City, country', 'London, UK')}
              <label className="block text-[12.5px] font-medium text-muted-foreground">
                Experience in that field
                <select value={profile.level} onChange={(e) => set({ level: e.target.value as P['level'] })} className="mt-1 h-10 w-full rounded-lg border bg-background px-2 text-[13.5px] text-foreground">
                  <option value="">Choose</option>
                  <option value="new">New to it</option>
                  <option value="some">Some experience</option>
                  <option value="experienced">Experienced</option>
                </select>
              </label>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[12.5px] font-medium text-muted-foreground">
                <label htmlFor="about">In your words (optional)</label>
                <button onClick={draftAbout} disabled={busy !== null} className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50">
                  {busy === 'about' && <Loader2 className="h-3 w-3 animate-spin" />}
                  Write it for me
                </button>
              </div>
              <Textarea id="about" value={profile.about} onChange={(e) => set({ about: e.target.value })} rows={3} className="mt-1 text-[13.5px]" placeholder="I moved to London last year and I’m switching from retail management into project management." />
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">Saved as you type, in this browser.</p>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="text-[16px] font-semibold">Your goal</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <label className="block text-[12.5px] font-medium text-muted-foreground">
                What you’re working toward
                <Input value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder="Pass CAPM and land a junior PM role" className="mt-1 text-[13.5px] text-foreground" />
              </label>
              <label className="block text-[12.5px] font-medium text-muted-foreground">
                By (optional)
                <Input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} className="mt-1 text-[13.5px] text-foreground" />
              </label>
              <Button onClick={saveGoal}>
                <Check />
                Save goal
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-[16px] font-semibold">Settings</h2>
            <div className="mt-3 space-y-4 text-[13px]">
              <label className="block font-medium text-muted-foreground">
                How Ropi answers
                <div className="mt-1.5 inline-flex rounded-lg bg-muted p-0.5" role="radiogroup">
                  {(['short', 'detailed'] as const).map((s) => (
                    <button key={s} role="radio" aria-checked={profile.answerStyle === s} onClick={() => set({ answerStyle: s })} className={cn('rounded-md px-3 py-1 text-[12.5px] font-medium', profile.answerStyle === s ? 'bg-card text-foreground shadow-[0_1px_2px_hsl(225_20%_8%/0.08)]' : 'text-muted-foreground')}>
                      {s === 'short' ? 'Short and to the point' : 'With more detail'}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block font-medium text-muted-foreground">
                When you talk, wait for me to finish
                <select value={patience} onChange={(e) => setPatience(e.target.value)} className="mt-1.5 h-9 w-full rounded-lg border bg-background px-2 text-foreground">
                  <option value="short">A short pause</option>
                  <option value="normal">A normal pause</option>
                  <option value="long">A long pause (I think while I talk)</option>
                  <option value="manual">Until I tap the mic</option>
                </select>
              </label>
              <label className="flex items-center gap-2 font-medium text-muted-foreground">
                <input type="checkbox" checked={collapsed} onChange={toggle} />
                Keep the sidebar folded
              </label>
              <button onClick={() => navigate('/talk')} className="font-medium text-primary hover:underline">
                Choose Ropi’s voice in Talk
              </button>
            </div>
          </Card>
          <Card className="p-5 text-[13px] text-muted-foreground">
            <div className="font-semibold text-foreground">Your data</div>
            <p className="mt-1">Quizzes, cards, jobs, documents and History are saved to your private account. Your week, CV draft, profile and practice scores are kept in this browser.</p>
            <Button variant="ghost" size="sm" className="mt-3 -ml-2" onClick={signOut}>
              <LogOut />
              Sign out
            </Button>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
