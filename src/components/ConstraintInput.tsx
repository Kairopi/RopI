/**
 * ConstraintInput Component
 *
 * Natural language constraint input. Meta Muse turns the sentence into a
 * structured constraint (rules are the fallback); the user confirms before
 * the schedule is recalculated.
 */

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Mic, MicOff } from '@/components/icons';
import { speechManager, SpeechError } from '@/lib/voice/speech-manager';
import type { Constraint } from '@/lib/scheduling/types';
import { parseConstraint } from '@/lib/scheduling/parse-constraint';
import { EXAMPLE_CONSTRAINTS } from '@/lib/scheduling/constraints';

interface ConstraintInputProps {
  onSubmit: (constraint: Constraint) => void;
  isLoading?: boolean;
  /** What-if: how many tasks would move / end up at risk, computed before anything is saved */
  previewImpact?: (constraint: Constraint) => { moved: number; atRisk: number };
}

const TYPE_LABELS: Record<Constraint['type'], string> = {
  time_reduced: 'Less free time',
  deadline_added: 'New deadline',
  shift_conflict: 'Busy period',
};

const when = (date: Date | string) =>
  new Date(date).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });

export default function ConstraintInput({ onSubmit, isLoading, previewImpact }: ConstraintInputProps) {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<Constraint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [listening, setListening] = useState(false);
  const canListen = speechManager.getSupport().stt;
  const impact = useMemo(() => (parsed && previewImpact ? previewImpact(parsed) : null), [parsed, previewImpact]);

  // Say it instead of typing: live transcript fills the box, then Ropi reads it
  const listen = async () => {
    if (listening) {
      speechManager.stopListening();
      return;
    }
    setError(null);
    setParsed(null);
    setListening(true);
    try {
      const heard = await speechManager.listenDetailed({ onInterim: setInput });
      setInput(heard.transcript);
      await runParse(heard.transcript);
    } catch (e) {
      if (!(e instanceof SpeechError && e.code === 'aborted')) setError(e instanceof Error ? e.message : 'Speech recognition failed.');
    } finally {
      setListening(false);
    }
  };

  const runParse = async (text: string) => {
    if (!text.trim()) {
      setError('Describe what changed first.');
      return;
    }
    setIsParsing(true);
    setError(null);
    setParsed(null);
    try {
      const constraint = await parseConstraint(text);
      if (constraint) {
        setParsed(constraint);
      } else {
        setError("I couldn't work out what changed. Try one of the examples below.");
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = () => {
    if (!parsed) return;
    onSubmit(parsed);
    setInput('');
    setParsed(null);
  };

  const busy = isLoading || isParsing;

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-[17px] font-semibold">What changed?</h3>
      <p className="mt-1 text-[13px] text-muted-foreground">Say it the way you would text a friend.</p>

      {/* Composer: the sentence and its action live in one field */}
      <div className="mt-4 rounded-xl border bg-background transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              runParse(input);
            }
          }}
          aria-label="Describe what changed"
          placeholder="Manager added a shift, only 20 min tonight"
          className="block w-full min-h-[84px] resize-none bg-transparent px-3.5 pt-3 text-[14px] placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none"
          disabled={busy}
        />
        <div className="flex items-center gap-2 px-2.5 pb-2.5">
          <span className="text-[11.5px] text-muted-foreground">
            {listening ? 'Speak now…' : <><kbd aria-hidden="true" className="num rounded border bg-card px-1 py-px text-[10.5px]">Enter</kbd> to preview</>}
          </span>
          {canListen && (
            <Button
              size="sm"
              variant={listening ? 'default' : 'ghost'}
              onClick={listen}
              disabled={busy && !listening}
              aria-label={listening ? 'Stop listening' : 'Say what changed'}
              className={listening ? 'ml-auto animate-pulse' : 'ml-auto'}
            >
              {listening ? <MicOff /> : <Mic />}
              {listening ? 'Listening' : ''}
            </Button>
          )}
          <Button size="sm" className={canListen ? '' : 'ml-auto'} onClick={() => runParse(input)} disabled={busy || listening || !input.trim()}>
            {isParsing && <Loader2 className="animate-spin" />}
            {isParsing ? 'Reading it' : 'Preview'}
          </Button>
        </div>
      </div>

      {parsed && (
        <div className="mt-4 overflow-hidden rounded-xl border border-primary/25 animate-slideDown">
          <div className="flex items-start justify-between gap-3 bg-accent px-4 py-3">
            <div className="min-w-0">
              <div className="eyebrow !text-accent-foreground">{TYPE_LABELS[parsed.type]}</div>
              <div className="mt-1 truncate text-[13px] text-foreground">"{parsed.description}"</div>
            </div>
            <Badge variant="outline" className="shrink-0 bg-card">
              {parsed.parsedBy === 'muse' ? 'Parsed by Meta Muse' : 'Parsed by rules'}
            </Badge>
          </div>

          <dl className="space-y-1.5 px-4 py-3 text-[13px]">
            {parsed.type === 'time_reduced' && (
              <Row label="Free time">
                {parsed.availableMinutes} min on{' '}
                {new Date(parsed.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
              </Row>
            )}
            {parsed.type === 'deadline_added' && parsed.urgentDeadline && (
              <Row label="Due">{when(parsed.urgentDeadline)}</Row>
            )}
            {parsed.type === 'shift_conflict' && parsed.conflictingShift && (
              <Row label="Busy">
                {when(parsed.conflictingShift.start)} to{' '}
                {new Date(parsed.conflictingShift.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Row>
            )}
          </dl>

          <div className="px-4 pb-4">
            {impact && (
              <p className="mb-2.5 text-[12.5px] text-muted-foreground">
                What-if:{' '}
                <span className="font-medium text-foreground">
                  {impact.moved === 0 ? 'nothing needs to move' : `${impact.moved} task${impact.moved === 1 ? '' : 's'} will move`}
                </span>
                {impact.atRisk > 0 && <span className="text-destructive">, {impact.atRisk} won't fit</span>}. Nothing changes until you confirm.
              </p>
            )}
            <Button onClick={handleSubmit} disabled={busy} className="w-full">
              {isLoading ? 'Replanning...' : 'Replan my week'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/[0.06] p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="text-[13px] text-destructive">{error}</div>
        </div>
      )}

      <div className="mt-5">
        <div className="eyebrow mb-2">Try one</div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_CONSTRAINTS.map((example) => (
            <button
              key={example}
              onClick={() => {
                setInput(example);
                runParse(example);
              }}
              disabled={busy}
              className="rounded-full border bg-card px-3 py-1.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
