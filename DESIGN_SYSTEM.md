# 🎨 ROPI DESIGN SYSTEM
## Meta Global AI Hackathon 2026

**Last Updated:** November 1, 2026  
**Status:** Foundation Phase

---

## 🎯 DESIGN PRINCIPLES

### **1. Observable Intelligence**
Every AI action is visible, explainable, and reversible. Users see WHAT is happening, WHY it's happening, and can intervene.

### **2. Closed-Loop Feedback**
The system learns from actual results (quiz scores, job outcomes) and adapts future behavior automatically.

### **3. Progressive Trust**
Start with "ask permission" mode. Build trust through demonstrated value. Graduate to autonomous mode.

### **4. Evidence-Based Actions**
All AI actions produce verifiable evidence (screenshots, confirmation IDs, extracted data).

### **5. Mobile-First, Voice-Ready**
Works hands-free while commuting, cooking, exercising. Desktop for deep work, mobile for quick interactions.

---

## 🎨 VISUAL DESIGN

### **Color Palette**

```css
/* Primary - Meta Brand Purple */
--primary-50: #f5f3ff;
--primary-100: #ede9fe;
--primary-500: #a855f7;  /* Main brand */
--primary-600: #9333ea;
--primary-700: #7e22ce;

/* Success - Learning Progress */
--success-50: #f0fdf4;
--success-500: #22c55e;
--success-700: #15803d;

/* Warning - Needs Attention */
--warning-50: #fffbeb;
--warning-500: #f59e0b;
--warning-700: #b45309;

/* Error - Critical Issues */
--error-50: #fef2f2;
--error-500: #ef4444;
--error-700: #b91c1c;

/* Neutral - Base UI */
--neutral-50: #fafafa;
--neutral-100: #f5f5f5;
--neutral-200: #e5e5e5;
--neutral-300: #d4d4d4;
--neutral-400: #a3a3a3;
--neutral-500: #737373;
--neutral-600: #525252;
--neutral-700: #404040;
--neutral-800: #262626;
--neutral-900: #171717;

/* Agent States */
--agent-idle: #94a3b8;
--agent-thinking: #3b82f6;
--agent-acting: #a855f7;
--agent-success: #22c55e;
--agent-error: #ef4444;
--agent-waiting: #f59e0b;
```

### **Typography**

```css
/* Font Families */
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'Fira Code', 'Courier New', monospace;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px - timestamps, labels */
--text-sm: 0.875rem;   /* 14px - body, descriptions */
--text-base: 1rem;     /* 16px - default */
--text-lg: 1.125rem;   /* 18px - subheadings */
--text-xl: 1.25rem;    /* 20px - section titles */
--text-2xl: 1.5rem;    /* 24px - page titles */
--text-3xl: 1.875rem;  /* 30px - hero */
--text-4xl: 2.25rem;   /* 36px - dashboard headline */

/* Font Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### **Spacing Scale**

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### **Border Radius**

```css
--radius-sm: 0.25rem;   /* 4px - tight elements */
--radius-md: 0.375rem;  /* 6px - buttons, inputs */
--radius-lg: 0.5rem;    /* 8px - cards */
--radius-xl: 0.75rem;   /* 12px - modals */
--radius-2xl: 1rem;     /* 16px - hero elements */
--radius-full: 9999px;  /* circular */
```

### **Shadows**

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
--shadow-glow: 0 0 20px rgb(168 85 247 / 0.3);
```

---

## 🧩 COMPONENT LIBRARY

### **1. Agent Status Indicator**

Shows real-time agent activity with animated states.

```tsx
<AgentStatus
  agent="job-hunter"
  status="acting"
  action="Analyzing LinkedIn job postings"
  progress={67}
  evidence={3} // 3 pieces of evidence collected
/>
```

**Visual States:**
- 🔵 **Idle:** Gray, no animation
- 🟡 **Thinking:** Blue, pulsing
- 🟣 **Acting:** Purple, animated spinner
- 🟢 **Success:** Green, checkmark
- 🔴 **Error:** Red, X icon
- 🟠 **Waiting:** Orange, "needs help" icon

---

### **2. Evidence Card**

Displays verifiable proof of agent actions.

```tsx
<EvidenceCard
  type="screenshot"
  timestamp="2026-11-01T14:30:00Z"
  action="Applied to Monzo PM role"
  data={{
    applicationId: "MON-2026-1234",
    confirmationMessage: "Application submitted successfully",
    url: "https://monzo.com/careers"
  }}
  screenshot="/evidence/monzo-confirmation.png"
/>
```

---

### **3. LifeShift Timeline**

Shows before/after recalculation when life changes.

```tsx
<LifeShiftTimeline
  trigger="Manager added shift, only 20min tonight"
  before={{
    study: "90min AWS Lambda deep dive",
    jobs: "Browse 30 new postings",
    break: "30min"
  }}
  after={{
    jobs: "Agent handles overnight (autonomous)",
    study: "15min quiz on YOUR weak spot",
    review: "5min check job materials",
    saved: "70min moved to Saturday"
  }}
  recalculationTime="0.8s"
/>
```

---

### **4. Skill Confidence Meter**

Shows learning progress with visual feedback.

```tsx
<SkillMeter
  topic="Lambda Cold Starts"
  confidence={68}
  change={+3}
  quizzesTaken={4}
  lastQuizScore={4/5}
  weakSpots={["Timeout limits", "Pricing tiers"]}
  nextLesson="Memory tricks for numbers"
/>
```

**Visual:**
- Progress bar (0-100%)
- Trend arrow (↑ improving, ↓ declining, → stable)
- Color: < 40% red, 40-70% yellow, > 70% green
- Weak spots highlighted below

---

### **5. Permission Dialog**

Agent asks for approval with full context.

```tsx
<PermissionDialog
  agent="application-submitter"
  action="Submit application"
  target="Monzo - Product Manager"
  reason="90% match, closes in 24h"
  risk="sensitive"
  evidence={{
    resume: "/resumes/monzo-pm-v3.pdf",
    coverLetter: "/letters/monzo-pm.pdf",
    atsScore: "92/100"
  }}
  options={["Approve Once", "Approve All Tonight", "Decline"]}
/>
```

---

### **6. Voice Quiz Card**

Hands-free quiz with voice interaction.

```tsx
<VoiceQuiz
  topic="Lambda Cold Starts"
  question="What is the maximum timeout for AWS Lambda?"
  options={["300 seconds", "600 seconds", "900 seconds", "1800 seconds"]}
  voiceEnabled={true}
  timeRemaining={45}
  onAnswer={(answer, correct) => {
    // Update skill model
    // Adjust tomorrow's lesson
  }}
/>
```

---

## 📱 RESPONSIVE LAYOUT

### **Breakpoints**

```css
--screen-sm: 640px;   /* Mobile landscape */
--screen-md: 768px;   /* Tablet */
--screen-lg: 1024px;  /* Desktop */
--screen-xl: 1280px;  /* Large desktop */
--screen-2xl: 1536px; /* Extra large */
```

### **Layout Patterns**

**Mobile (< 768px):**
- Single column
- Bottom navigation bar
- Stacked cards
- Voice button always visible

**Tablet (768px - 1024px):**
- 2-column grid for cards
- Side navigation drawer
- Collapsible sections

**Desktop (> 1024px):**
- Persistent sidebar navigation
- 3-column dashboard
- Side panels for details
- Keyboard shortcuts enabled

---

## 🎭 ANIMATION PRINCIPLES

### **1. Agent Thinking**

```css
@keyframes thinking {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
/* Duration: 1.5s, easing: ease-in-out, infinite */
```

### **2. LifeShift Recalculation**

```css
@keyframes recalculate {
  0% { opacity: 1; transform: translateY(0); }
  50% { opacity: 0.3; transform: translateY(-10px); }
  100% { opacity: 1; transform: translateY(0); }
}
/* Duration: 0.8s, easing: cubic-bezier(0.4, 0, 0.2, 1) */
```

### **3. Evidence Collection**

```css
@keyframes collectEvidence {
  0% { opacity: 0; transform: scale(0.8) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
/* Duration: 0.3s, easing: ease-out, stagger: 0.1s */
```

### **4. Confidence Meter Update**

```css
@keyframes confidenceUpdate {
  0% { width: var(--old-width); }
  100% { width: var(--new-width); }
}
/* Duration: 1s, easing: ease-in-out */
```

---

## 🔊 VOICE INTERACTION DESIGN

### **Wake Words**
- "Hey ROPI"
- "ROPI" (when voice mode active)

### **Voice States**

**1. Listening**
- Visual: Pulsing purple ring
- Feedback: Subtle chime

**2. Processing**
- Visual: Purple spinner
- Feedback: "Hmm..."

**3. Speaking**
- Visual: Animated waveform
- Feedback: Natural voice (Meta Muse Voice)

**4. Error**
- Visual: Red flash
- Feedback: "Sorry, I didn't catch that"

### **Voice Commands**

```
"ROPI, what's my schedule today?"
"ROPI, how did I do on the last quiz?"
"ROPI, apply to this job"
"ROPI, I only have 20 minutes tonight"
"ROPI, show me jobs closing this week"
"ROPI, quiz me on Lambda"
```

---

## 📊 DASHBOARD LAYOUT

### **Main Dashboard (Desktop)**

```
┌──────────────────────────────────────────────────────────┐
│  ROPI Logo                         🎙️  ⚙️  👤          │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  🎯 Today's Focus                                         │
│  ┌─────────────────────┐  ┌────────────────────────┐    │
│  │ 🟣 Job Agent Acting  │  │ 📚 Next: Lambda Quiz   │    │
│  │ Found 3 new matches  │  │ 15 min • Your weak spot│    │
│  │ 2 need approval      │  │ Confidence: 68% ↑      │    │
│  └─────────────────────┘  └────────────────────────┘    │
│                                                            │
│  ⚡ Active Agents                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🟣 Job Hunter      │ Analyzing LinkedIn jobs      │   │
│  │ 🟡 Resume Writer   │ Waiting for approval        │   │
│  │ 🔵 Scheduler       │ Idle                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
│  📋 Recent Activity                                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ✅ Applied to Monzo PM (Evidence: Screenshot)     │   │
│  │ 🟢 Quiz completed: 4/5 (80%) - Skill updated     │   │
│  │ 🔄 Schedule recalculated (LifeShift: 0.8s)       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## 🎬 DEMO MOMENTS

### **WOW #1: LifeShift Recalculation**

**Setup:** Dashboard showing 90min study session scheduled

**Action:** Type "Manager added shift, only 20min tonight"

**Result (< 1 second):**
1. Old schedule fades out with animation
2. New schedule slides in
3. Agent cards update status
4. Explanation appears: "I've recalculated..."
5. Evidence: Before/after screenshots saved

**Visual:** Split-screen animation showing transformation

---

### **WOW #2: Learning Feedback Loop**

**Setup:** Take voice quiz on Lambda

**Action:** Answer timeout question wrong

**Result (live on screen):**
1. Confidence meter animates: 68% → 70% (with +2 indicator)
2. Weak spot highlighted: "Timeout limits (0/3 correct)"
3. Tomorrow's lesson card updates: "Memory trick: 9-0-0 for 900s"
4. Next quiz difficulty adjusts
5. Skill graph shows historical trend

**Visual:** Cascading updates across dashboard

---

## 🔐 PERMISSION DESIGN (Visual)

### **Permission Levels**

**Ask Mode (Default):**
- 🟡 Yellow border on agent cards
- Every sensitive action requires approval
- Shows: "Waiting for your approval"

**Auto Mode (Trusted):**
- 🟢 Green border on agent cards
- Safe actions proceed automatically
- Sensitive actions still ask
- Shows: "Working autonomously"

**Supervised Mode:**
- 🟠 Orange border on agent cards
- Every action visible in real-time
- Can pause/stop anytime
- Shows: "You're watching"

---

## 📦 COMPONENT CHECKLIST

### **Phase 1: Foundation (Hour 0-8)**
- [ ] Layout shell (sidebar, main, mobile nav)
- [ ] Color system + CSS variables
- [ ] Typography system
- [ ] Basic Button component
- [ ] Basic Card component
- [ ] Auth screens (Login/Signup)

### **Phase 2: Dashboard (Hour 8-16)**
- [ ] Dashboard layout
- [ ] Agent Status Indicator
- [ ] Today's Focus cards
- [ ] Recent Activity feed
- [ ] Evidence Card (basic)

### **Phase 3: Job Features (Hour 16-24)**
- [ ] Job Board (list view)
- [ ] Job Detail modal
- [ ] Permission Dialog
- [ ] Resume preview
- [ ] Application form

### **Phase 4: Learning Features (Hour 24-32)**
- [ ] Learning Hub layout
- [ ] Quiz Card (text-based)
- [ ] Voice Quiz Card
- [ ] Skill Confidence Meter
- [ ] Lesson viewer

### **Phase 5: Polish (Hour 32-40)**
- [ ] LifeShift Timeline animation
- [ ] Evidence screenshots
- [ ] Voice interaction UI
- [ ] Loading states
- [ ] Error states

### **Phase 6: Demo Ready (Hour 40-48)**
- [ ] Demo mode (fake data)
- [ ] WOW moment #1 animation
- [ ] WOW moment #2 animation
- [ ] Mobile responsive
- [ ] Performance optimization

---

## 🎨 DESIGN ASSETS NEEDED

### **Icons (Lucide React)**
- ✅ Agent states: Circle, Loader, CheckCircle, XCircle, AlertCircle
- ✅ Navigation: Home, Briefcase, BookOpen, Calendar, Database, Settings
- ✅ Actions: Play, Pause, Stop, RefreshCw, Eye, EyeOff
- ✅ Evidence: Camera, FileText, Link, Download
- ✅ Voice: Mic, MicOff, Volume2, VolumeX

### **Illustrations**
- Empty states (no jobs, no quizzes, etc.)
- Success celebrations
- Error states
- Onboarding walkthrough

### **Demo Assets**
- Sample job postings (5)
- Sample quiz questions (10 per topic)
- Sample evidence screenshots (3)
- Sample resume (1)

---

## 🚀 IMPLEMENTATION NOTES

### **State Management**
- React Query for server state
- Zustand for local state
- Context for auth

### **Styling Approach**
- TailwindCSS for utility classes
- CSS variables for theming
- shadcn/ui for base components

### **Performance**
- Code splitting by route
- Lazy load images
- Debounce voice input
- Virtual scrolling for long lists

### **Accessibility**
- ARIA labels on all interactive elements
- Keyboard navigation
- Screen reader support for voice mode
- Focus management in modals

---

**Next Steps:** Create TASKS.md with hour-by-hour breakdown
