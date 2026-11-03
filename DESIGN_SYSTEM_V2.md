# 🎨 ROPI DESIGN SYSTEM V2
## Precision Minimalism – Linear × Vercel × Klim Type

**Last Updated:** November 1, 2026  
**Philosophy:** Restraint is luxury. The interface should feel distinctive because of its **decisions**, not because it's visually loud.

---

## 🎯 DESIGN PRINCIPLES

### **1. Precision Over Decoration**
The work itself—not the interface chrome—should dominate. Use exceptional typography, hierarchy and controlled information density.

### **2. Monochrome Foundation**
Predominantly neutral UI with **one** restrained ultramarine accent. Color communicates status and actions, not decoration.

### **3. Typography Is the System**
Carefully specified text sizes, line heights, tracking and weights. Not just choosing a font and hoping for the best.

### **4. 8px Rhythm**
Consistent spacing system creates visual harmony without arbitrary padding.

### **5. Quiet Until Important**
Motion should explain a change, reveal detail or preserve context—not constantly demand attention.

---

## 🎨 COLOR SYSTEM

### **ROPI / PRECISION MONOCHROME**

```css
/* Foundation */
--paper: #FFFFFF;      /* Main canvas */
--mist: #F7F8FA;       /* Quiet surfaces */
--ink: #111318;        /* Primary text */
--slate: #666B75;      /* Secondary text */
--line: #E4E7EC;       /* Dividers */

/* Single Accent */
--ultramarine: #3452E8;  /* Interaction accent */
--ultramarine-dark: #2A42C0;  /* Hover state */

/* Semantic (Used Sparingly) */
--success: #10B981;
--success-light: #D1FAE5;
--warning: #F59E0B;
--warning-light: #FEF3C7;
--error: #EF4444;
--error-light: #FEE2E2;
```

### **Color Usage Rules**

✅ **DO:**
- Use ultramarine only for selected, actionable or significant elements
- Keep most surfaces in paper/mist/ink/slate
- Use semantic colors for status (success/warning/error)
- Maintain 4.5:1 contrast minimum (WCAG AA)

❌ **DON'T:**
- Add gradients, neon effects or glassmorphism
- Use multiple brand colors competing for attention
- Apply color for decoration alone
- Create pastel card backgrounds everywhere

---

## 📝 TYPOGRAPHY SYSTEM

### **Font Stack**

**Primary:** Geist Sans (via CDN or Inter as fallback)  
**Monospace:** Geist Mono (for technical metadata only)

```css
font-family: 'Geist Sans', 'Inter', system-ui, -apple-system, sans-serif;
font-family: 'Geist Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
```

### **Type Scale**

| Element | Font | Weight | Size / Line Height | Letter Spacing | Usage |
|---------|------|--------|-------------------|----------------|-------|
| **Wordmark** | Geist Sans | 600 | 27px / 30px | -0.02em | ropi. logo |
| **Hero Heading** | Geist Sans | 500 | 38px / 44px | -0.02em | Page titles |
| **Section Heading** | Geist Sans | 550-600 | 21px / 28px | -0.01em | Section titles |
| **Card Title** | Geist Sans | 500 | 15px / 22px | 0 | Card headings |
| **Body Large** | Geist Sans | 400 | 16px / 25px | 0 | Important text |
| **Body** | Geist Sans | 400 | 14px / 22px | 0 | Default text |
| **Label** | Geist Sans | 500 | 13px / 18px | 0.01em | Form labels |
| **Small** | Geist Sans | 400 | 12px / 18px | 0.02em | Metadata |
| **Mono Small** | Geist Mono | 400-500 | 12px / 18px | 0 | Dates, durations |

### **Typography Rules**

✅ **DO:**
- Use negative letter-spacing on large headings
- Apply subtle tracking (0.01-0.02em) on labels and small text
- Use tabular figures for dates, durations and percentages
- Maintain clear hierarchy with size and weight

❌ **DON'T:**
- Use 700-900 weight headlines arbitrarily
- Set tiny light-grey text just to look elegant
- Mix multiple font families randomly
- Create exaggerated font weights

---

## 📐 SPACING SYSTEM

### **8px Rhythm**

```css
--space-0: 0px;
--space-1: 8px;
--space-2: 16px;
--space-3: 24px;
--space-4: 32px;
--space-5: 40px;
--space-6: 48px;
--space-8: 64px;
--space-10: 80px;
--space-12: 96px;
```

### **Component Spacing**

- **Input padding:** 12px × 8px (horizontal × vertical)
- **Button padding:** 12px × 10px
- **Card padding:** 24px
- **Section spacing:** 32px - 48px
- **Page margins:** 32px desktop, 16px mobile

---

## 🎯 COMPONENT SPECIFICATIONS

### **1. Buttons**

```tsx
// Primary Action (Ultramarine)
<button className="bg-ultramarine hover:bg-[#2A42C0] text-paper font-medium py-2.5 px-4 rounded-md text-sm transition-colors">
  Sign in
</button>

// Secondary Action
<button className="bg-paper border border-line hover:bg-mist text-ink font-medium py-2.5 px-4 rounded-md text-sm transition-colors">
  Cancel
</button>

// Ghost Action
<button className="text-slate hover:text-ink font-medium text-sm transition-colors">
  Learn more
</button>
```

### **2. Input Fields**

```tsx
<div>
  <label className="block text-sm font-medium text-ink mb-1.5">
    Email
  </label>
  <input
    type="email"
    className="w-full px-3 py-2 bg-paper border border-line rounded-md text-sm text-ink placeholder-slate focus:outline-none focus:ring-2 focus:ring-ultramarine focus:border-transparent transition-all"
    placeholder="you@company.com"
  />
</div>
```

### **3. Cards**

```tsx
// Standard Card
<div className="bg-paper rounded-lg border border-line p-6 shadow-card">
  <h3 className="text-md font-semibold text-ink mb-2">
    Card Title
  </h3>
  <p className="text-sm text-slate">
    Card content
  </p>
</div>

// Elevated Card (hover state)
<div className="bg-paper rounded-lg border border-line p-6 shadow-card hover:shadow-elevated transition-shadow">
  ...
</div>
```

### **4. Agent Status Indicators**

```tsx
// Active Agent
<div className="flex items-center gap-2">
  <div className="h-2 w-2 bg-ultramarine rounded-full animate-pulse"></div>
  <p className="text-sm font-medium text-ink">Job Hunter</p>
  <p className="text-xs text-slate">Analyzing opportunities</p>
</div>

// Idle Agent
<div className="flex items-center gap-2">
  <div className="h-2 w-2 bg-line rounded-full"></div>
  <p className="text-sm text-slate">Resume Writer</p>
</div>
```

### **5. Navigation**

```tsx
// Active Link
<a className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-ink bg-mist rounded-md">
  <Icon className="h-5 w-5" />
  Dashboard
</a>

// Inactive Link
<a className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate hover:text-ink hover:bg-mist/50 rounded-md transition-colors">
  <Icon className="h-5 w-5" />
  Jobs
</a>
```

---

## 🎭 SHADOWS & ELEVATION

```css
/* Subtle - Resting state */
box-shadow: 0 1px 2px rgba(17, 19, 24, 0.04);

/* Card - Standard elevation */
box-shadow: 0 2px 8px rgba(17, 19, 24, 0.06);

/* Elevated - Hover/focus */
box-shadow: 0 8px 24px rgba(17, 19, 24, 0.08);
```

**Use shadows sparingly.** Most separators should be 1px borders, not drop shadows.

---

## 📐 BORDER RADIUS

```css
--radius-sm: 8px;   /* Inputs, buttons */
--radius-md: 10px;  /* Cards */
--radius-lg: 12px;  /* Modals, panels */
```

**Sharp, not pill-shaped.** No 999px border radius on rectangular elements.

---

## ✨ ANIMATION PRINCIPLES

### **Motion Should Be Invisible**

Animations explain changes and preserve spatial context—not demand attention.

```css
/* Subtle transitions */
transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);

/* Natural easing */
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
```

### **Animation Rules**

✅ **DO:**
- Fade in new content (150-250ms)
- Slide panels naturally (250-350ms)
- Pulse for loading states
- Transform for spatial relationships

❌ **DON'T:**
- Bounce, wobble or elastic effects
- Animations > 500ms
- Animate purely for decoration
- Parallax scrolling effects

---

## 🚫 DESIGN RESTRICTIONS (NON-NEGOTIABLE)

These rules are **enforced** for all ROPI interfaces:

1. **One primary type family** (Geist/Inter) + one mono (Geist Mono)
2. **Predominantly monochrome UI** with one ultramarine accent
3. **Consistent 8px spacing rhythm**
4. **Sharp 8-12px border radii** (no pill shapes)
5. **Minimal shadows** (most separators are 1px borders)
6. **No gradients, glassmorphism or neon effects**
7. **No oversized pills or indiscriminate animation**
8. **No unnecessary cards** – use whitespace and fine separators
9. **Motion explains changes** – not constant decoration
10. **4.5:1 minimum contrast** for normal text (WCAG AA)

---

## 📱 RESPONSIVE DESIGN

### **Breakpoints**

```css
--screen-sm: 640px;   /* Mobile landscape */
--screen-md: 768px;   /* Tablet */
--screen-lg: 1024px;  /* Desktop */
--screen-xl: 1280px;  /* Large desktop */
```

### **Mobile Adjustments**

- Reduce heading sizes by ~30%
- Increase touch targets to 44×44px minimum
- Stack cards vertically
- Show bottom tab bar instead of sidebar
- Simplify navigation to essentials

---

## 🎬 SIGNATURE MOMENTS

### **1. LifeShift Recalculation**

When schedule changes, items gracefully reorder with natural slide transitions.

```tsx
// Before/after comparison with smooth transition
<div className="grid grid-cols-2 gap-4">
  <div className="transition-all duration-300 ease-out">
    {/* Old schedule fades out */}
  </div>
  <div className="transition-all duration-300 ease-out">
    {/* New schedule slides in */}
  </div>
</div>
```

### **2. Skill Confidence Update**

Progress bar animates from old → new value with subtle easing.

```tsx
<div className="relative h-2 bg-line rounded-full overflow-hidden">
  <div
    className="absolute h-full bg-ultramarine transition-all duration-1000 ease-in-out"
    style={{ width: `${confidence}%` }}
  />
</div>
```

---

## 📚 REFERENCES

**Design Inspiration:**
- [Linear's UI Redesign (March 2026)](https://linear.app/blog/linear-ui-redesign)
- [Vercel's Geist Design System](https://vercel.com/geist)
- [Klim Type Foundry – Söhne](https://klim.co.nz/fonts/soehne/)
- [ABC Dinamo – Diatype](https://abcdinamo.com/typefaces/diatype)
- [Karri Saarinen – Output Isn't Design](https://linear.app/now/output-isn-t-design)

**Accessibility:**
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

---

## 🎯 IMPLEMENTATION CHECKLIST

### **Foundation**
- [x] Color system implemented in Tailwind config
- [x] Typography scale defined
- [x] 8px spacing rhythm configured
- [x] Font loaded (Inter as Geist fallback)
- [x] Base styles applied

### **Components**
- [x] Login page redesigned
- [ ] Dashboard layout
- [ ] Navigation sidebar
- [ ] Button variants
- [ ] Input fields
- [ ] Cards
- [ ] Agent status indicators

### **Pages**
- [x] Login (precision minimalism)
- [ ] Dashboard (monochrome + ultramarine)
- [ ] Job Board
- [ ] Learning Hub
- [ ] LifeShift
- [ ] Knowledge Base

---

**Design Quality Bar:** Does every element feel **unmistakably intentional**? If not, remove or refine it.

**Inspiration:** Linear's quiet hierarchy + Vercel's typographic precision + Klim's craft = ROPI's precision instrument for life.
