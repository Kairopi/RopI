/**
 * Page header used on every screen: eyebrow, display title, one specific
 * sentence, optional actions. Gives every page the same editorial hierarchy.
 */

import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className = '' }: PageHeaderProps) {
  return (
    <header className={`mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${className}`}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] sm:text-[32px] leading-[1.1] font-semibold">{title}</h1>
        {description && <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Section heading inside a page */
export function SectionTitle({ children, meta, className = '' }: { children: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mb-4 ${className}`}>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{children}</h2>
      {meta && <div className="flex flex-wrap items-center gap-2">{meta}</div>}
    </div>
  );
}
