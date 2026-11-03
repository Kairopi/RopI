# ROPI Design System 1.0 — Precision Minimalism

**Philosophy**: Design for focus. Make complexity feel effortless.

## Design Inspiration
- **Visual Reference**: Geist (Vercel) + Linear
- **Interaction Patterns**: GitHub Primer + Adobe Spectrum
- **Motion & Spacing**: Atlassian Design System

## 01 / Color Tokens

### Core Palette (6 tokens)
```css
--canvas: #FFFFFF;        /* Primary background */
--surface: #F7F8FA;       /* Elevated surfaces, cards */
--ink: #111318;           /* Primary text */
--secondary: #666B75;     /* Secondary text, labels */
--border: #E4E7EC;        /* Borders, dividers */
--accent: #3452E8;        /* Primary action, focus */
```

### Semantic Tokens
```css
--background: var(--canvas);
--foreground: var(--ink);
--muted: var(--surface);
--muted-foreground: var(--secondary);
--border: var(--border);
--primary: var(--accent);
--primary-foreground: var(--canvas);
```

### State Colors
```css
--success: #10B981;
--success-light: #D1FAE5;
--warning: #F59E0B;
--warning-light: #FEF3C7;
--error: #EF4444;
--error-light: #FEE2E2;
```

## 02 / Typography

### Font Stack
```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'Geist Mono', 'Fira Code', monospace;
```

### Type Scale
```css
--text-xs: 12px;      /* Meta information */
--text-sm: 14px;      /* Body text, labels */
--text-base: 16px;    /* Primary body */
--text-lg: 18px;      /* Emphasized */
--text-xl: 20px;      /* Section headings */
--text-2xl: 24px;     /* Page titles */
--text-3xl: 30px;     /* Hero headings */
--text-4xl: 38px;     /* Display */
```

### Font Weights
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Letter Spacing
- **Headlines (xl+)**: `-0.02em` (tighter tracking)
- **Body (sm-lg)**: `0` (normal)
- **Small text (xs)**: `0.01em` (slightly looser)

## 03 / Spacing System

### 8px Rhythm
```css
--space-1: 4px;   /* Fine adjustments */
--space-2: 8px;   /* Tight spacing */
--space-3: 12px;  /* Compact */
--space-4: 16px;  /* Standard */
--space-5: 20px;  /* Comfortable */
--space-6: 24px;  /* Spacious */
--space-8: 32px;  /* Section gaps */
--space-12: 48px; /* Large sections */
--space-16: 64px; /* Hero spacing */
```

### Component Spacing Rules
- **Card padding**: 16px (mobile), 20px (tablet), 24px (desktop)
- **Button padding**: 12px horizontal, 8px vertical
- **Input padding**: 12px horizontal, 10px vertical
- **Section margins**: 24px (mobile), 32px (desktop)
- **Grid gaps**: 12px (mobile), 16px (tablet), 24px (desktop)

## 04 / Shape & Borders

### Border Radius
```css
--radius-sm: 6px;   /* Small elements */
--radius-md: 8px;   /* Standard (buttons, inputs) */
--radius-lg: 12px;  /* Cards, panels */
--radius-xl: 16px;  /* Large surfaces */
```

### Border Width
```css
--border-thin: 1px;  /* Standard borders */
--border-thick: 2px; /* Focus states */
```

### Shadow (Minimal)
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 2px 4px 0 rgba(0, 0, 0, 0.08);
--shadow-focus: 0 0 0 2px var(--accent);
```

## 05 / Component States

### Interactive States
```css
/* Default */
background: var(--canvas);
border: 1px solid var(--border);

/* Hover */
background: var(--surface);
border-color: var(--secondary);

/* Focus */
outline: none;
box-shadow: var(--shadow-focus);

/* Active/Pressed */
background: var(--muted);
transform: translateY(1px);

/* Disabled */
opacity: 0.5;
cursor: not-allowed;
```

## 06 / Motion Principles

### Timing Functions
```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

### Durations
```css
--duration-fast: 150ms;    /* Micro-interactions */
--duration-base: 200ms;    /* Standard transitions */
--duration-slow: 300ms;    /* Page transitions */
--duration-page: 400ms;    /* Major layout changes */
```

### Animation Rules
1. **Purposeful**: Every animation explains what's happening
2. **Fast**: Default to 200ms or faster
3. **Respectful**: Honor `prefers-reduced-motion`
4. **Smooth**: Use ease-out for entering, ease-in for exiting

## 07 / Custom ROPI Components

### MissionRow
**Purpose**: Displays goals, deadlines, importance and next action
**Style**: Compact, beautifully aligned, minimal borders
```
[Priority Badge] [Mission Title]           [Deadline] [Status]
                  [Next action]            [Progress Bar]
```

### LifeShiftTimeline
**Purpose**: Shows time changes and rescheduled activities
**Style**: Smooth, spatial reordering with before/after states
**Animation**: Shared-element transitions using Motion

### DecisionDiff
**Purpose**: Compares the old plan with the new one
**Style**: Subtle before/after highlighting (red → green)
**Layout**: Side-by-side or unified view

### ActionReceipt
**Purpose**: Displays proposed, approved and verified agent work
**Style**: Quiet activity timeline with clear statuses
**States**: Proposed (blue), Approved (purple), Verified (green), Failed (red)

### OpportunityPanel
**Purpose**: Contains job details, evidence of fit and prepared documents
**Style**: Sophisticated editorial document layout
**Layout**: Rich typography, clear hierarchy, generous whitespace

### LearningSurface
**Purpose**: Shows questions, answers, explanations and progress
**Style**: Focused, distraction-free learning experience
**Interaction**: Card-based, swipe gestures, immediate feedback

### CommandBar
**Purpose**: Allows natural-language and voice interaction
**Style**: Almost invisible until needed (Cmd+K)
**Behavior**: Slides in from center, blurs background

## 08 / Layout Patterns

### Grid System
```css
/* Mobile: 4 columns */
grid-template-columns: repeat(4, 1fr);
gap: 12px;

/* Tablet: 8 columns */
grid-template-columns: repeat(8, 1fr);
gap: 16px;

/* Desktop: 12 columns */
grid-template-columns: repeat(12, 1fr);
gap: 24px;
```

### Container Widths
```css
--container-sm: 640px;  /* Forms, focused content */
--container-md: 768px;  /* Articles, documentation */
--container-lg: 1024px; /* Dashboards */
--container-xl: 1280px; /* Wide layouts */
```

## 09 / Accessibility Requirements

### WCAG AA Compliance
- **Contrast ratios**: 4.5:1 for body text, 3:1 for large text
- **Focus indicators**: 2px solid accent, visible on all interactive elements
- **Touch targets**: Minimum 44px × 44px on mobile
- **Motion**: Respect `prefers-reduced-motion`

### Keyboard Navigation
- **Tab order**: Logical, follows visual layout
- **Focus trap**: Modals and dialogs trap focus
- **Escape**: Closes overlays and modals
- **Arrow keys**: Navigate lists and menus

## 10 / Implementation Rules

### Component Development
1. **Design once**: Establish component in `components/ui/`
2. **Use tokens**: Never hardcode colors or spacing
3. **Test states**: Default, hover, focus, active, disabled, error
4. **Document**: Add to Storybook (post-MVP)

### Consistency Rules
1. **One motion library**: Motion for React only
2. **One component source**: shadcn/ui (customized)
3. **One color system**: Semantic tokens only
4. **One typography stack**: Inter + Geist Mono

### Code Style
```tsx
// Good: Using semantic tokens
<button className="bg-primary text-primary-foreground">

// Bad: Hardcoded colors
<button className="bg-blue-600 text-white">

// Good: Using spacing scale
<div className="p-4 gap-3">

// Bad: Arbitrary values
<div className="p-[17px] gap-[13px]">
```

## 11 / Responsive Breakpoints

```css
--breakpoint-sm: 640px;   /* Tablets */
--breakpoint-md: 768px;   /* Small laptops */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large desktop */
```

### Mobile-First Approach
Always start with mobile styles, then enhance for larger screens:
```tsx
<div className="p-4 sm:p-5 lg:p-6">
<h1 className="text-2xl sm:text-3xl lg:text-4xl">
```

## 12 / Quality Checklist

Before committing any component:
- [ ] Uses semantic color tokens
- [ ] Follows 8px spacing rhythm
- [ ] Has all interactive states
- [ ] Meets contrast requirements (4.5:1)
- [ ] Touch targets ≥ 44px (mobile)
- [ ] Respects `prefers-reduced-motion`
- [ ] Keyboard accessible
- [ ] Responsive (mobile → desktop)

---

**Design Authority**: This document is the single source of truth for all ROPI visual decisions.

**Last Updated**: Hour 8 - November 1, 2026
**Version**: 1.0.0
**Status**: Active - Use for all new development
