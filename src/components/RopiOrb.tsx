/**
 * Ropi's voice: a soft cobalt orb that moves while Ropi thinks or talks.
 * Adapted from the Uiverse.io loader by andrew-manzyk (MIT), recoloured to the brand
 * and slowed down. Still under prefers-reduced-motion.
 */

import { useId } from 'react';
import { cn } from '@/lib/utils';

export function RopiOrb({ size = 80, active = 'speaking', className }: { size?: number; active?: 'thinking' | 'speaking'; className?: string }) {
  const id = 'orb' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <span
      aria-hidden="true"
      className={cn('ropi-orb pointer-events-none absolute inset-0 block', active === 'thinking' && 'ropi-orb-thinking', className)}
      style={{ width: size, height: size }}
    >
      <span className="ropi-orb-inner" style={{ transform: `scale(${size / 100})` }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <defs>
            <mask id={id}>
              <polygon points="0,0 100,0 100,100 0,100" fill="black" />
              <polygon points="25,25 75,25 50,75" fill="white" />
              <polygon points="50,25 75,75 25,75" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
              <polygon points="35,35 65,35 50,65" fill="white" />
            </mask>
          </defs>
        </svg>
        <span className="ropi-orb-box" style={{ mask: `url(#${id})`, WebkitMask: `url(#${id})` }} />
      </span>
    </span>
  );
}
