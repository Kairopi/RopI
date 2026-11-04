/**
 * Notes for a folder or subtopic: yours and the ones Ropi wrote for you.
 * Type or say a note; ask Ropi to sum up what you know so far; put any note
 * on today's plan to practise it.
 */
import { useState } from 'react';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check, Loader2, Mic, Plus, Trash2, CalendarClock } from '@/components/icons';
import { useWeek } from '@/hooks/useWeek';
import { speechManager } from '@/lib/voice/speech-manager';
import { addTo, makeNote, updateIn } from '@/lib/library/notes';
import type { SavedLink } from '@/lib/library/store';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const tonight = () => {
  const d = new Date();
  d.setHours(22, 0, 0, 0);
  return d.toISOString();
};

export function NotesPanel({
  id,
  folder,
  subtopic,
  notes,
  practiceHref,
  onChange,
  summarize,
}: {
  id: string;
  folder: { key: string; name: string };
  subtopic: string | null;
  notes: SavedLink[];
  /** Where a practice block opens */
  practiceHref: string;
  onChange: () => void;
  /** Ropi writes "what you know so far" (optional) */
  summarize?: () => Promise<string>;
}) {
  const addTask = useWeek((s) => s.addTask);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [planned, setPlanned] = useState<Set<string>>(new Set());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canListen = speechManager.getSupport().stt;
  const name = subtopic ?? folder.name;

  const save = async (body: string, by: 'you' | 'ropi', title: string | null = null) => {
    if (!body.trim()) return;
    await addTo(folder, subtopic, makeNote(body, title, by));
    onChange();
  };

  const dictate = async () => {
    if (listening) {
      speechManager.stopListening();
      return;
    }
    setError(null);
    setListening(true);
    try {
      const before = draft.trim();
      const join = (t: string) => (before ? `${before} ${t}` : t);
      const heard = await speechManager.listenDetailed({ onInterim: (t) => setDraft(join(t)) });
      setDraft(join(heard.transcript));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Voice stopped');
    } finally {
      setListening(false);
    }
  };

  const sorted = [...notes].sort((a, b) => b.added_at.localeCompare(a.added_at));

  return (
    <Panel
      id={id}
      title="Notes"
      meta={notes.length ? String(notes.length) : undefined}
      summary={sorted[0] ? sorted.slice(0, 3).map((n) => n.title).join(' · ') : 'None yet'}
      actions={
        summarize ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy === 'summary'}
            onClick={async () => {
              setBusy('summary');
              setError(null);
              try {
                await save(await summarize(), 'ropi', `What I know so far about ${name}`);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Ropi could not write it just now');
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === 'summary' ? <Loader2 className="animate-spin" /> : <Plus />}
            {busy === 'summary' ? 'Ropi is writing' : 'Sum up what I know'}
          </Button>
        ) : undefined
      }
    >
      {sorted.length > 0 && (
        <ul className="mb-4 space-y-2">
          {sorted.map((n) => (
            <li key={n.url} className="group rounded-xl border bg-background/60 p-3.5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">{n.title}</div>
                  {(() => {
                    // Don't repeat the title: it's usually the first sentence of the note
                    const head = n.title.replace(/…$/, '');
                    const body = n.note && n.note.startsWith(head) && !n.title.endsWith('…') ? n.note.slice(head.length).replace(/^[.!?:\s]+/, '') : n.note;
                    return body && body !== n.title ? <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">{body}</p> : null;
                  })()}
                  <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                    {n.added_by === 'ropi' ? 'Written by Ropi' : 'Your note'} · {when(n.added_at)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={planned.has(n.url)}
                    onClick={() => {
                      addTask({ title: `Practise: ${subtopic ?? n.title}`, duration: 15, priority: 'P2', deadline: tonight(), category: 'learning', tags: ['study'], href: practiceHref });
                      setPlanned((s) => new Set(s).add(n.url));
                    }}
                  >
                    {planned.has(n.url) ? <Check /> : <CalendarClock />}
                    {planned.has(n.url) ? 'On today' : 'Practise today'}
                  </Button>
                  <button
                    aria-label={`Delete note ${n.title}`}
                    onClick={async () => {
                      await updateIn(folder, subtopic, n.url, null);
                      onChange();
                    }}
                    className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy('add');
          try {
            await save(draft, 'you');
            setDraft('');
          } finally {
            setBusy(null);
          }
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={sorted.length ? 'Add a note' : `What do you want to remember about ${name}?`}
          aria-label={`New note on ${name}`}
          rows={2}
          className="text-[13.5px]"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-muted-foreground">{error ?? (listening ? 'Listening. Say your note.' : 'Notes stay in this folder. Ropi uses them when you ask about it.')}</span>
          <div className="flex gap-2">
            {canListen && (
              <Button type="button" size="sm" variant={listening ? 'default' : 'ghost'} onClick={dictate} aria-label={listening ? 'Stop dictating' : 'Say a note'}>
                <Mic />
                {listening ? 'Stop' : 'Say it'}
              </Button>
            )}
            <Button type="submit" size="sm" variant="outline" disabled={!draft.trim() || busy === 'add'}>
              Save note
            </Button>
          </div>
        </div>
      </form>
    </Panel>
  );
}
