/**
 * One document: read it, see which folder it's in (and move it), and quiz
 * yourself on it with quotes. Reached from a topic folder or Learn.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, BookOpen, Loader2, MessageSquare, Mic } from '@/components/icons';
import { useUserId } from '@/contexts/AuthContext';
import { readSource, moveSource, type SourceText } from '@/lib/documents/sources';
import { loadFolders, type TopicFolder } from '@/lib/library/topics';
import { topicKey } from '@/lib/library/store';

export default function Document() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const userId = useUserId();
  const [doc, setDoc] = useState<SourceText | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [folders, setFolders] = useState<TopicFolder[]>([]);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    readSource(id)
      .then(setDoc)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not open the document');
        setDoc(null);
      });
    loadFolders(userId)
      .then(setFolders)
      .catch(() => undefined);
  }, [id, userId]);

  if (doc === undefined) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }
  if (!doc) {
    return (
      <DashboardLayout>
        <div className="py-16 text-center">
          <h1 className="text-[18px] font-semibold">Document not found</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{error ?? 'It may have been removed.'}</p>
          <Button className="mt-4" onClick={() => navigate('/learning')}>
            Back to Learn
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const s = doc.source;
  const folderName = s.topic || s.title;
  const words = doc.passages.reduce((n, p) => n + p.text.split(/\s+/).length, 0);
  const minutes = Math.max(1, Math.round(words / 230));
  const names = Array.from(new Set([folderName, ...folders.map((f) => f.topic)]));

  return (
    <DashboardLayout>
      <button
        onClick={() => navigate(`/learn/topic/${encodeURIComponent(topicKey(folderName))}`)}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {folderName}
      </button>
      <PageHeader
        title={s.title}
        description={[
          s.file_type ? s.file_type.toUpperCase() : null,
          s.page_count ? `${s.page_count} page${s.page_count === 1 ? '' : 's'}` : null,
          `about ${minutes} min to read`,
          `added ${new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Button onClick={() => navigate(`/quiz/new?source=${s.id}`)}>
              <BookOpen />
              Quiz me on it
            </Button>
            <Button variant="outline" onClick={() => navigate(`/voice-quiz?quiz=new&source=${s.id}`)}>
              <Mic />
              By voice
            </Button>
            <Button variant="ghost" onClick={() => navigate(`/talk?q=${encodeURIComponent(`Explain the main ideas in my notes "${s.title}"`)}`)}>
              <MessageSquare />
              Ask Ropi
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <article className="min-w-0">
          {doc.passages.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">No text was saved for this document.</p>
          ) : (
            <Card className="p-6 sm:p-8">
              <div className="max-w-[68ch] space-y-5">
                {doc.passages.map((p, i) => (
                  <section key={i}>
                    {p.page !== null && (doc.passages.length > 1 || p.page > 1) && (
                      <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Page {p.page}</div>
                    )}
                    <p className="text-[15px] leading-[1.75] text-foreground/90">{p.text}</p>
                  </section>
                ))}
              </div>
            </Card>
          )}
        </article>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card className="p-5">
            <label htmlFor="doc-folder" className="text-[12.5px] font-medium text-muted-foreground">
              Folder
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <select
                id="doc-folder"
                value={folderName}
                disabled={moving}
                onChange={async (e) => {
                  const topic = e.target.value;
                  setMoving(true);
                  try {
                    await moveSource(s.id, topic);
                    setDoc({ ...doc, source: { ...s, topic } });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not move it');
                  } finally {
                    setMoving(false);
                  }
                }}
                className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-[13px]"
              >
                {names.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {moving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">Quizzes on this document count toward that folder.</p>
            {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
          </Card>
          {(s.summary || (s.tags ?? []).length > 0) && (
            <Card className="p-5">
              <div className="text-[12.5px] font-medium text-muted-foreground">In short</div>
              {s.summary && <p className="mt-1.5 text-[13.5px] leading-relaxed">{s.summary}</p>}
              {(s.tags ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {(s.tags ?? []).map((t) => (
                    <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11.5px] text-muted-foreground">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          )}
        </aside>
      </div>
    </DashboardLayout>
  );
}
