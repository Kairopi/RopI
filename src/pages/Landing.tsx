/**
 * The first screen: what Ropi is in one line, three things it does, one button.
 * One screen, no long scroll. Signed-in visitors go straight to Today.
 */
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, FileText, Video } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MinutesDemo } from '@/components/brand/MinutesDemo';
import { useAuth } from '@/contexts/AuthContext';

const PROOF = [
  {
    icon: Brain,
    title: 'Got 5 minutes? Ropi picks the one thing.',
    body: 'The cards you’re about to forget, or the idea you keep missing. It never plans more than the time you have.',
  },
  {
    icon: FileText,
    title: 'Your notes, quizzed with proof.',
    body: 'Drop a PDF. Every question quotes the exact line it came from, checked word for word.',
  },
  {
    icon: Video,
    title: 'Practise out loud, then see what to fix.',
    body: 'A live interviewer for your role that follows up on what you say. Then a review in your own words.',
  },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col px-6 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Logo size={24} />
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
            Open Ropi
          </Button>
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr]">
          <section>
            <h1 className="font-display text-[44px] font-semibold leading-[1.03] tracking-[-0.04em] sm:text-[58px]">Turn dead time into growth time.</h1>
            <p className="mt-5 max-w-[50ch] text-[17px] leading-relaxed text-muted-foreground">
              For people studying and job hunting around a full life. Ropi knows what you’re about to forget, and fits it into the minutes you actually have: on the
              train, in a queue, getting ready.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => navigate('/login')}>
                Try it free
                <ArrowRight />
              </Button>
              <span className="text-[13px] text-muted-foreground">No email or password. A sample week is one tap away.</span>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-3">
              {PROOF.map((p) => (
                <li key={p.title} className="rounded-2xl border bg-card p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
                    <p.icon className="h-[18px] w-[18px]" />
                  </span>
                  <h2 className="mt-3 text-[14.5px] font-semibold leading-snug">{p.title}</h2>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{p.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-hidden="true" className="relative hidden overflow-hidden rounded-3xl bg-primary p-8 text-white lg:block">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.09]"
              style={{
                backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                backgroundSize: '56px 56px',
                maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
              }}
            />
            <p className="relative mb-6 text-[13px] font-medium text-white/75">A day with Ropi</p>
            <div className="relative">
              <MinutesDemo />
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-[12px] text-muted-foreground">
          <span>Your quizzes, plans and practice are private to your account. Ropi never applies to jobs for you.</span>
          <span>Built for the Meta Global AI Developer Hackathon 2026.</span>
        </footer>
      </div>
    </div>
  );
}
