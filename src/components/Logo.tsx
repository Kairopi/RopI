/**
 * ROPI logo: the R mark (one continuous stroke that changes direction, plus a dot)
 * and the "Ropi" wordmark set in Outfit, which matches the mark's round geometry.
 *
 * The mark inherits `currentColor`, so it is cobalt on light surfaces and can
 * be white on dark ones. Source vector: src/components/brand/ropi-mark.svg
 */

interface LogoProps {
  /** Height of the mark in px; the wordmark scales with it */
  size?: number;
  withWordmark?: boolean;
  className?: string;
  /** Mark color (defaults to the brand cobalt) */
  tone?: 'brand' | 'ink' | 'white';
}

const TONES = {
  brand: 'text-primary',
  ink: 'text-foreground',
  white: 'text-white',
};

export function RopiMark({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 240 230"
      height={size}
      width={(size * 240) / 230}
      fill="none"
      stroke="currentColor"
      strokeWidth={34}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <circle cx="64" cy="22" r="19" fill="currentColor" stroke="none" />
      <path d="M110 22H160a52 52 0 0 1 0 104H70C40 126 20 146 20 172c0 19 10 33 24 40" />
      <path d="M128 128L214 210" />
    </svg>
  );
}

export function Logo({ size = 22, withWordmark = true, className = '', tone = 'brand' }: LogoProps) {
  return (
    <span className={`inline-flex items-center select-none ${TONES[tone]} ${className}`} style={{ gap: size * 0.38 }}>
      <RopiMark size={size} />
      {withWordmark && (
        <span
          className="font-display font-bold leading-none"
          style={{ fontSize: size * 0.95, letterSpacing: '-0.035em' }}
        >
          Ropi
        </span>
      )}
    </span>
  );
}
