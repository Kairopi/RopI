import { useState } from 'react';
import { cn } from '@/lib/utils';

/** A company's logo, or its first letter when there is none or it fails to load */
export function CompanyLogo({ src, company, size = 40, className }: { src?: string | null; company: string; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const box = { width: size, height: size };
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        style={box}
        className={cn('shrink-0 rounded-lg border bg-white object-contain p-0.5', className)}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      style={{ ...box, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded-lg border bg-muted font-semibold text-muted-foreground', className)}
    >
      {company.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  );
}
