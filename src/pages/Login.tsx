import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2 } from '@/components/icons';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/Logo';
import { ShiftDemo } from '@/components/brand/ShiftDemo';

const PROOF = [
  // Measured in the browser: 0.3-0.9 ms per replan (see LifeShift badge)
  { k: '~1 ms', v: 'to replan a whole week' },
  { k: '1 quiz', v: 'to find a real weak spot' },
  { k: 'FSRS', v: 'spaced review for every miss' },
];

export default function Login() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signIn(name);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.08fr_1fr]">
      {/* Brand side: the product idea, shown working */}
      <section className="relative hidden overflow-hidden bg-primary text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-14">
        {/* Quiet grid texture echoing the week calendar */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)',
          }}
        />

        <Logo size={26} tone="white" className="relative" />

        <div className="relative">
          <h1 className="font-display text-[52px] xl:text-[60px] font-semibold leading-[1.02] tracking-[-0.04em] text-white max-w-[12ch]">
            A plan that moves when life does.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-white/80">
            Ropi schedules your study and job applications around your real free time. Tell it what changed and the week
            replans itself. Every quiz shows exactly what to practice next.
          </p>
          <div className="mt-10">
            <ShiftDemo />
          </div>
        </div>

        <dl className="relative grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
          {PROOF.map((p) => (
            <div key={p.k}>
              <dt className="font-display text-[22px] font-semibold tracking-[-0.02em]">{p.k}</dt>
              <dd className="mt-1 text-[12.5px] leading-snug text-white/70">{p.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Form side */}
      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          <h1 aria-label="Ropi" className="mb-10 lg:hidden">
            <Logo size={28} />
          </h1>

          <div className="eyebrow mb-3">Welcome</div>
          <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.03em]">Start your week</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">No email or password. Your progress is saved to a private account in this browser.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-[13px] font-medium">
                What should we call you? <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
                maxLength={40}
                disabled={isLoading}
                autoFocus
                autoComplete="given-name"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" /> : null}
              {isLoading ? 'Starting' : 'Start'}
              {!isLoading && <ArrowRight />}
            </Button>
          </form>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-[13px] text-destructive">{error}</p>
            </div>
          )}

          <p className="mt-10 text-[12px] leading-relaxed text-muted-foreground">
            Built with Meta Muse for planning, quizzes and lessons. Review scheduling uses the open FSRS algorithm.
          </p>
        </div>
      </section>
    </div>
  );
}
