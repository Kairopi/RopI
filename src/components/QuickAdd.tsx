/**
 * Quick add: one line, parsed as you type ("Read chapter 4 45m @thu !1").
 * Used on Today and Tasks.
 */

import { useMemo, useState } from 'react';
import { Plus } from '@/components/icons';
import { useWeek } from '@/hooks/useWeek';
import { parseQuickAdd } from '@/lib/week/quick-add';
import { cn } from '@/lib/utils';

export function QuickAdd({ className, title = 'Add to your week' }: { className?: string; title?: string | null }) {
  const addTask = useWeek((s) => s.addTask);
  const [line, setLine] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const preview = useMemo(() => (line.trim() ? parseQuickAdd(line) : null), [line]);

  const submit = () => {
    if (!preview) return;
    addTask({
      title: preview.title,
      duration: preview.duration,
      priority: preview.priority,
      deadline: preview.deadline?.toISOString(),
      category: preview.category,
      tags: preview.category === 'learning' ? ['study'] : undefined,
    });
    setAdded(preview.title);
    setLine('');
    setTimeout(() => setAdded(null), 2500);
  };

  return (
    <div className={cn('rounded-xl border bg-card p-5', className)}>
      {title && <div className="mb-3 text-[14px] font-semibold">{title}</div>}
      <div className="rounded-xl border bg-background transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
        <div className="flex items-center gap-2 px-3">
          <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            aria-label="Add a task"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Read chapter 4 30m @thu"
            className="h-11 w-full bg-transparent text-[14px] placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none"
          />
        </div>
      </div>
      <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
        {added ? (
          <span className="text-success">Added “{added}”. Your week was replanned.</span>
        ) : preview ? (
          <>
            {preview.tokens.length === 0 && <span>30 min, no deadline</span>}
            {preview.tokens.map((t) => (
              <span key={t.kind} className="rounded-md bg-accent px-1.5 py-0.5 font-medium text-accent-foreground">
                {t.text}
              </span>
            ))}
            <span className="ml-auto">Enter to add</span>
          </>
        ) : (
          <span>
            <span className="font-medium text-foreground">45m</span> length · <span className="font-medium text-foreground">@fri 5pm</span> deadline ·{' '}
            <span className="font-medium text-foreground">!1</span> urgent
          </span>
        )}
      </div>
    </div>
  );
}
