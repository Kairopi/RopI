/**
 * Panel - a card section the user can collapse.
 *
 * The header toggles the body; the choice is remembered per panel id, so a
 * section you closed stays closed next time. When collapsed, an optional
 * one-line summary keeps the useful number visible.
 */

import { useId, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChevronDown } from '@/components/icons';
import { cn } from '@/lib/utils';

const usePanels = create<{ closed: Record<string, boolean>; toggle: (id: string, defaultOpen: boolean) => void }>()(
  persist(
    (set) => ({
      closed: {},
      toggle: (id, defaultOpen) =>
        set((s) => {
          const isClosed = s.closed[id] ?? !defaultOpen;
          return { closed: { ...s.closed, [id]: !isClosed } };
        }),
    }),
    { name: 'ropi-panels-v1' }
  )
);

interface PanelProps {
  /** Stable id used to remember open/closed */
  id: string;
  title: ReactNode;
  /** Small text next to the title (counts, dates) */
  meta?: ReactNode;
  /** Shown instead of the body when collapsed */
  summary?: ReactNode;
  /** Buttons on the right; clicks don't toggle the panel */
  actions?: ReactNode;
  defaultOpen?: boolean;
  /** "bare": no card chrome, for a section that holds its own cards */
  variant?: 'card' | 'bare';
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function Panel({ id, title, meta, summary, actions, defaultOpen = true, variant = 'card', className, bodyClassName, children }: PanelProps) {
  const bare = variant === 'bare';
  const reduceMotion = useReducedMotion();
  const open = !(usePanels((s) => s.closed[id]) ?? !defaultOpen);
  const toggle = usePanels((s) => s.toggle);
  const bodyId = useId();

  return (
    <section className={cn(!bare && 'rounded-xl border border-border bg-card text-card-foreground', className)} data-panel={id}>
      <div className={cn('flex items-center gap-2', bare ? 'mb-1 min-h-[44px]' : 'min-h-[56px] px-5 sm:px-6')}>
        <button
          type="button"
          onClick={() => toggle(id, defaultOpen)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="group -ml-1.5 flex min-w-0 flex-1 items-center gap-2 rounded-md py-3 pl-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h2 className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">{title}</h2>
          {meta && <span className="truncate text-[12.5px] text-muted-foreground">{meta}</span>}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground',
              open ? 'rotate-0' : '-rotate-90'
            )}
          />
          <span className="sr-only">{open ? 'Collapse' : 'Expand'}</span>
        </button>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            id={bodyId}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className={cn(bare ? 'pb-1 pt-1' : 'px-5 pb-5 sm:px-6 sm:pb-6', bodyClassName)}>{children}</div>
          </motion.div>
        ) : (
          summary && (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn('truncate text-[12.5px] text-muted-foreground', bare ? '-mt-1 pb-1' : '-mt-2 px-5 pb-4 sm:px-6')}
            >
              {summary}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </section>
  );
}
