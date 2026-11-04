/**
 * Animation Constants
 * 
 * Based on Material Design and proven patterns from super-productivity
 * Source: github.com/super-productivity/super-productivity
 */

import type { Variants } from 'framer-motion';

// ===== TIMING CURVES =====
// Material Design standard curve - use for most transitions
export const ANI_STANDARD_CURVE = 'cubic-bezier(.4, 0, .2, 1)';

// Entrance curve - elements entering the view
export const ANI_ENTER_CURVE = 'cubic-bezier(0, 0, .2, 1)';

// Exit curve - elements leaving the view
export const ANI_LEAVE_CURVE = 'cubic-bezier(.4, 0, 1, 1)';

// Sharp curve - quick state changes
export const ANI_SHARP_CURVE = 'cubic-bezier(.4, 0, .6, 1)';

// Smooth ease in/out - for dramatic effects
export const ANI_SMOOTH_CURVE = 'cubic-bezier(.38, .04, .35, .96)';

// ===== DURATIONS =====
export const DURATION_XS = 55;    // Micro-interactions
export const DURATION_S = 150;    // Fast changes
export const DURATION_M = 225;    // Standard (MOST COMMON)
export const DURATION_L = 375;    // Deliberate/important
export const DURATION_XL = 1000;  // Very dramatic

// ===== COMBINED (Duration + Curve) =====
export const ANI_STANDARD = `${DURATION_M}ms ${ANI_STANDARD_CURVE}`;
export const ANI_ENTER = `${DURATION_M}ms ${ANI_ENTER_CURVE}`;
export const ANI_LEAVE = `195ms ${ANI_LEAVE_CURVE}`;
export const ANI_FAST = `${DURATION_S}ms ${ANI_STANDARD_CURVE}`;
export const ANI_SLOW = `${DURATION_L}ms ${ANI_STANDARD_CURVE}`;

// ===== LIFESHIFT SPECIFIC =====
export const LIFESHIFT_FADE_OUT = `200ms ${ANI_LEAVE_CURVE}`;
export const LIFESHIFT_FADE_IN = `${DURATION_M}ms ${ANI_ENTER_CURVE}`;
export const LIFESHIFT_SLIDE_UP = `${DURATION_L}ms ${ANI_STANDARD_CURVE}`;
export const HIGHLIGHT_FLASH = `${DURATION_S}ms ${ANI_STANDARD_CURVE}`;

// ===== FRAMER MOTION VARIANTS =====
// Easing tuples must be typed as 4-number tuples for framer-motion's Variants type
type Bezier = [number, number, number, number];
const EASE_STANDARD: Bezier = [0.4, 0, 0.2, 1];
const EASE_LEAVE: Bezier = [0.4, 0, 1, 1];
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: {
      duration: DURATION_M / 1000,
      ease: EASE_STANDARD
    }
  }
};

export const fadeOutVariants: Variants = {
  visible: { opacity: 1 },
  hidden: { 
    opacity: 0,
    transition: {
      duration: 200 / 1000,
      ease: EASE_LEAVE
    }
  }
};

export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: DURATION_M / 1000,
      ease: EASE_STANDARD
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 200 / 1000,
      ease: EASE_LEAVE
    }
  }
};

export const staggerChildrenVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05
    }
  }
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: DURATION_S / 1000,
      ease: EASE_STANDARD
    }
  }
};

// ===== UTILITY FUNCTIONS =====
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getReducedMotionValue = <T>(normalValue: T, reducedValue: T): T => {
  if (typeof window === 'undefined') return normalValue;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return prefersReducedMotion ? reducedValue : normalValue;
};
