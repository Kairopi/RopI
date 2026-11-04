/**
 * Your topics: one folder per thing you're learning, newest activity first.
 * Each opens to its subtopics, documents, quizzes, conversations and saved links.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from '@/components/icons';
import { loadFolders, type TopicFolder } from '@/lib/library/topics';
import { saveTopic, topicKey } from '@/lib/library/store';
import { cn } from '@/lib/utils';

const day = (iso: string) => {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function TopicFolders({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [folders, setFolders] = useState<TopicFolder[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [all, setAll] = useState(false);

  const load = () => loadFolders(userId).then(setFolders).catch(() => setFolders([]));
  useEffect(() => {
    if (userId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    await saveTopic({ match_key: topicKey(n), name: n });
    setName('');
    setAdding(false);
    navigate(`/learn/topic/${encodeURIComponent(topicKey(n))}`);
  };

  const shown = all ? folders ?? [] : (folders ?? []).slice(0, 6);

  return (
    <Panel
      id="learn-folders"
      className="mb-6"
      title="Your topics"
      meta={folders?.length ? String(folders.length) : undefined}
      summary={folders?.map((f) => f.name).join(' · ') || 'No topics yet'}
      actions={
        <Button size="sm" variant="ghost" onClick={() => setAdding((a) => !a)}>
          <Plus />
          New topic
        </Button>
      }
    >
      {adding && (
        <form
          className="mb-4 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Intro to project management" aria-label="New topic name" maxLength={120} />
          <Button type="submit" disabled={!name.trim()}>
            Create
          </Button>
        </form>
      )}

      {folders === null ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-xl bg-muted/70" />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <p className="rounded-xl border border-dashed p-5 text-[13px] text-muted-foreground">
          Take a quiz, upload notes or talk to Ropi about something, and it gets its own folder here. Or start one with New topic.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((f) => {
              const bits = [
                f.attempts.length && `${f.attempts.length} quiz${f.attempts.length === 1 ? '' : 'zes'}`,
                f.sources.length && `${f.sources.length} doc${f.sources.length === 1 ? '' : 's'}`,
                f.conversations.length && `${f.conversations.length} talk${f.conversations.length === 1 ? '' : 's'}`,
                f.links.length && `${f.links.length} saved`,
              ].filter(Boolean);
              return (
                <li key={f.key}>
                  <button
                    onClick={() => navigate(`/learn/topic/${encodeURIComponent(f.key)}`)}
                    className="flex h-full w-full flex-col rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-[14px] font-semibold leading-snug">{f.name}</span>
                      {f.confidence !== null && <span className="shrink-0 font-display text-[18px] font-semibold tabular-nums tracking-[-0.03em]">{f.confidence}%</span>}
                    </div>
                    <span className="mt-1 text-[12px] text-muted-foreground">{bits.join(' · ') || 'Empty'}</span>
                    <span className="mt-auto flex items-center justify-between gap-2 pt-3 text-[11.5px] text-muted-foreground">
                      <span>{f.lastActivity ? `Active ${day(f.lastActivity)}` : 'New'}</span>
                      {f.dueCards > 0 && <span className="rounded-full bg-primary/10 px-2 py-px font-medium text-primary">{f.dueCards} due</span>}
                    </span>
                    {f.confidence !== null && (
                      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-muted">
                        <span className={cn('block h-full rounded-full', f.confidence >= 70 ? 'bg-primary' : 'bg-warning')} style={{ width: `${Math.max(3, f.confidence)}%` }} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {!all && folders.length > 6 && (
            <button onClick={() => setAll(true)} className="mt-3 w-full rounded-lg py-2 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Show all {folders.length}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
