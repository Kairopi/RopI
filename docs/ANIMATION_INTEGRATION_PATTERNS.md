# Animation & Integration Patterns from Proven Repos

**Source:** Analyzed super-productivity, smart-agentic-calendar, ts-fsrs repos  
**Date:** November 3, 2026  
**Purpose:** Apply proven patterns to ROPI Hour 12-16

---

## 1. ANIMATION CONSTANTS (From Super Productivity)

### Timing Functions
```typescript
// From: super-productivity/src/app/ui/animations/animation.const.ts

export const EASE_IN_OUT_QUINT = 'cubic-bezier(.38, .04, .35, .96)';
export const ANI_STANDARD_TIMING_ = 'cubic-bezier(.4, 0, .2, 1)';  // Material Design
export const ANI_ENTER_TIMING_ = 'cubic-bezier(0, 0, .2, 1)';      // Entrance
export const ANI_LEAVE_TIMING_ = 'cubic-bezier(.4, 0, 1, 1)';      // Exit
export const ANI_SHARP_TIMING_ = 'cubic-bezier(.4, 0, .6, 1)';     // Quick changes
```

### Duration Constants
```typescript
export const TRANSITION_DURATION_XS = '55ms';   // Micro-interactions
export const TRANSITION_DURATION_S = '150ms';   // Fast
export const TRANSITION_DURATION_M = '225ms';   // Standard (most common)
export const TRANSITION_DURATION_L = '375ms';   // Slow/deliberate
export const TRANSITION_DURATION_XL = '1s';     // Very slow/dramatic

// Combined (duration + curve)
export const ANI_STANDARD_TIMING = '225ms cubic-bezier(.4, 0, .2, 1)';
export const ANI_ENTER_TIMING = '225ms cubic-bezier(0, 0, .2, 1)';
export const ANI_LEAVE_TIMING = '195ms cubic-bezier(.4, 0, 1, 1)';
```

### ✅ ROPI APPLICATION:
```typescript
// Create: src/lib/animations/constants.ts
export const LIFESHIFT_FADE_OUT = '200ms cubic-bezier(.4, 0, 1, 1)';
export const LIFESHIFT_FADE_IN = '225ms cubic-bezier(0, 0, .2, 1)';
export const LIFESHIFT_SLIDE_UP = '375ms cubic-bezier(.4, 0, .2, 1)';
export const HIGHLIGHT_FLASH = '150ms cubic-bezier(.4, 0, .2, 1)';
```

---

## 2. FADE TRANSITIONS (From Super Productivity E2E Tests)

### Pattern: Fade Out → Setup → Fade In
```typescript
// From: super-productivity/e2e/video-kit/transitions.ts

export const fadeTransition = async (
  page: Page,
  setupNextScene: () => Promise<unknown>,
  options: { fadeMs?: number; label?: string } = {}
): Promise<void> => {
  const fadeMs = options.fadeMs ?? 200;  // Default 200ms
  
  // 1. Fade out current content
  await loopBoundary(page, 'out', fadeMs);
  
  // 2. Run setup while hidden (state change, route change, etc.)
  await setupNextScene();
  
  // 3. Fade in new content
  await loopBoundary(page, 'in', fadeMs);
};
```

### CSS Implementation
```typescript
// Creates overlay layer with z-index management
const transition = `opacity ${durationMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;

el.style.cssText = [
  'position:fixed',
  'inset:0',
  'background:#000',      // Or your surface color
  'z-index:9999',         // Above everything
  'pointer-events:none',  // Don't block clicks
  `transition:${transition}`,
  `opacity:${mode === 'in' ? 1 : 0}`,  // Start state
].join(';');

// Flush styles, then trigger transition
void el.offsetWidth;
el.style.opacity = mode === 'in' ? '0' : '1';  // End state
```

### ✅ ROPI APPLICATION:
```typescript
// In LifeShift.tsx recalculation handler:
async function handleRecalculate(constraint: Constraint) {
  // 1. Fade out old schedule (200ms)
  setTransitionState('fade-out');
  await delay(200);
  
  // 2. Calculate new schedule while hidden
  setTransitionState('calculating');
  const newSchedule = await recalculateSchedule(...);
  
  // 3. Fade in new schedule (225ms)
  setTransitionState('fade-in');
  setAfterSchedule(newSchedule);
  await delay(225);
  
  setTransitionState('complete');
}
```

---

## 3. HIGHLIGHT CHANGES PATTERN

### From ts-fsrs landing page styles
```typescript
// From: ts-fsrs/docs/theme/landing/styles.ts

export const card = cn(
  'rounded-2xl border border-line bg-surface p-5',
  'transition-colors duration-200 hover:border-line-strong',
  'motion-reduce:transition-none'  // Accessibility: respect prefers-reduced-motion
);
```

### ✅ ROPI APPLICATION:
```typescript
// In ScheduleTimeline.tsx
<Card
  className={cn(
    'p-4 border-l-4 transition-all duration-300',
    colorClass,
    isChanged && [
      'ring-2 ring-primary shadow-md',           // Ring on change
      'animate-pulse-once',                       // Flash once
    ],
    'motion-reduce:transition-none'  // Accessibility
  )}
>
```

### Custom Animation (Framer Motion)
```typescript
// From: Motion Primitives patterns
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence mode="wait">
  <motion.div
    key={schedule.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{
      duration: 0.225,
      ease: [0.4, 0, 0.2, 1]  // ANI_STANDARD_TIMING curve
    }}
  >
    {/* Schedule content */}
  </motion.div>
</AnimatePresence>
```

---

## 4. LOADING STATES WITH TIMER

### Pattern: Show calculation time in real-time
```typescript
// Inspired by super-productivity indicator.ts (pie chart animation sync)

export function RecalculatingLoader({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 16);  // ~60fps
    
    return () => clearInterval(interval);
  }, [startTime]);
  
  return (
    <div className="flex items-center gap-2">
      <Spinner />
      <span className="text-sm text-muted-foreground">
        Recalculating... {elapsed}ms
      </span>
    </div>
  );
}
```

### ✅ ROPI APPLICATION:
```typescript
// In LifeShift.tsx
{isCalculating && (
  <RecalculatingLoader startTime={calculationStartTime} />
)}
```

---

## 5. AGENT STATUS UPDATES

### Pattern: Show reasoning steps during calculation
```typescript
// Inspired by smart-agentic-calendar conflict detection

interface AgentStatusUpdate {
  agent: 'scheduler' | 'job_agent' | 'study_agent';
  action: string;
  timestamp: number;
}

const statusUpdates: AgentStatusUpdate[] = [
  { agent: 'scheduler', action: 'Analyzing constraint...', timestamp: 0 },
  { agent: 'job_agent', action: 'Moving application to background', timestamp: 150 },
  { agent: 'study_agent', action: 'Condensing quiz to 15min', timestamp: 300 },
  { agent: 'scheduler', action: 'Finalizing schedule', timestamp: 450 },
];

export function AgentStatusFeed({ updates }: { updates: AgentStatusUpdate[] }) {
  return (
    <Card className="p-4 bg-muted/50">
      <div className="space-y-2">
        {updates.map((update, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: update.timestamp / 1000 }}
            className="flex items-start gap-2"
          >
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
            <div className="text-sm">
              <span className="font-medium">{update.agent}:</span>{' '}
              <span className="text-muted-foreground">{update.action}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
```

---

## 6. DASHBOARD INTEGRATION

### Pattern: Show schedule summary card (From Super Productivity)
```typescript
// In Dashboard.tsx - Add "Today's Schedule" card

export function TodaysScheduleCard() {
  const { currentSchedule, lastRecalculationTime } = useSchedule();
  const navigate = useNavigate();
  
  return (
    <Card
      className="p-6 hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => navigate('/schedule')}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Today's Schedule</h3>
        <Badge variant="outline">
          {currentSchedule?.blocks.filter(b => isToday(b.date)).length} blocks
        </Badge>
      </div>
      
      <div className="space-y-2">
        {currentSchedule?.blocks
          .filter(b => isToday(b.date))
          .slice(0, 3)
          .map(block => (
            <ScheduleBlockPreview key={block.id} block={block} />
          ))}
      </div>
      
      {lastRecalculationTime && (
        <div className="text-xs text-muted-foreground mt-3">
          Recalculated {formatDistanceToNow(lastRecalculationTime)} ago
        </div>
      )}
    </Card>
  );
}
```

---

## 7. ACTIVITY FEED INTEGRATION

### Pattern: Log schedule recalculation events
```typescript
// In Dashboard activity feed

interface ActivityItem {
  type: 'schedule_recalculated' | 'task_completed' | 'application_submitted';
  title: string;
  description?: string;
  timestamp: Date;
  metadata?: any;
}

const activity: ActivityItem = {
  type: 'schedule_recalculated',
  title: 'Schedule recalculated',
  description: 'Manager added shift, only 20min tonight',
  timestamp: new Date(),
  metadata: {
    calculationTime: 42,
    blocksChanged: 3,
    tasksAffected: ['task-1', 'task-2', 'task-3'],
  },
};

// Render in activity feed
<div className="flex items-start gap-3">
  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
  <div className="flex-1 min-w-0">
    <div className="text-sm font-medium">Schedule recalculated (42ms)</div>
    <div className="text-xs text-muted-foreground mt-0.5">
      3 tasks changed
    </div>
    <div className="text-xs text-muted-foreground">2 hours ago</div>
  </div>
</div>
```

---

## 8. DATABASE PERSISTENCE

### Pattern: Log replanning events (From Smart Agentic Calendar)
```typescript
// Create replan_log table entry after each recalculation

interface ReplanLog {
  id: string;
  user_id: string;
  trigger: string;                    // "time_reduced" | "deadline_added" | "shift_conflict"
  trigger_description: string;        // Natural language: "only 20min tonight"
  before_schedule: Schedule;          // Full schedule snapshot
  after_schedule: Schedule;           // New schedule
  calculation_time_ms: number;        // Performance metric
  blocks_changed: number;             // How many blocks moved/changed
  tasks_affected: string[];           // Task IDs affected
  at_risk_tasks: AtRiskTask[];        // Tasks that couldn't be scheduled
  created_at: Date;
}

// Save after recalculation
async function saveReplanLog(log: ReplanLog) {
  await supabase.from('replan_log').insert(log);
}
```

---

## 9. MOBILE RESPONSIVENESS

### Pattern: Test transitions on mobile (From Super Productivity tests)
```typescript
// Key considerations:
// 1. Touch-friendly buttons (min 44x44px)
// 2. Reduced animation on slow devices
// 3. One-column layout on mobile
// 4. Bottom sheets instead of side panels

// Tailwind responsive classes
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Stacks on mobile, side-by-side on desktop */}
</div>

<Button size="lg" className="touch-manipulation">
  {/* 44px+ height, easy to tap */}
</Button>

// Conditional animations
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const animationDuration = prefersReducedMotion ? 0 : 225;
```

---

## 10. EXPLANATION CARD

### Pattern: Show reasoning after recalculation
```typescript
export function ReasoningCard({ changes }: { changes: ScheduleChange[] }) {
  return (
    <Card className="p-4 bg-primary/5 border-primary/20">
      <h4 className="text-sm font-medium mb-2">Here's what I did and why</h4>
      <div className="space-y-2">
        {changes.map((change, i) => (
          <div key={i} className="text-xs">
            <span className="font-medium">{change.task}</span>
            <span className="text-muted-foreground"> → {change.reason}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Example changes:
const changes = [
  {
    task: 'AWS Lambda Quiz',
    reason: 'Moved to tomorrow morning (high priority, needs focus time)',
  },
  {
    task: 'Job Application - Monzo',
    reason: 'Squeezed into tonight (urgent deadline)',
  },
  {
    task: 'Review Resume',
    reason: 'Deferred to Friday (lower priority, flexible)',
  },
];
```

---

## IMPLEMENTATION CHECKLIST FOR HOUR 12-14

### Animation Files to Create:
- [ ] `src/lib/animations/constants.ts` - Timing curves and durations
- [ ] `src/lib/animations/useTransition.ts` - Reusable fade transition hook
- [ ] `src/components/RecalculatingLoader.tsx` - Animated loader with timer
- [ ] `src/components/AgentStatusFeed.tsx` - Real-time status updates
- [ ] `src/components/ReasoningCard.tsx` - Explanation of changes

### Updates to Existing Files:
- [ ] `LifeShift.tsx` - Add transition states (fade-out, calculating, fade-in)
- [ ] `BeforeAfterView.tsx` - Add AnimatePresence for smooth entry/exit
- [ ] `ScheduleTimeline.tsx` - Add highlight flash animation on change
- [ ] `ConstraintInput.tsx` - Add submit animation

### Install Dependencies:
```bash
npm install framer-motion date-fns
```

---

## IMPLEMENTATION CHECKLIST FOR HOUR 14-16

### Dashboard Integration:
- [ ] `Dashboard.tsx` - Add TodaysScheduleCard component
- [ ] `Dashboard.tsx` - Update activity feed with schedule events
- [ ] Create `src/hooks/useSchedule.ts` - Global schedule state

### Database Persistence:
- [ ] Create `replan_log` table in Supabase schema
- [ ] Add `saveReplanLog()` function
- [ ] Call after each recalculation in `LifeShift.tsx`

### Cross-Feature Integration:
- [ ] Job Agent: Update priorities when schedule changes
- [ ] Learning Hub: Adapt quiz duration to available time
- [ ] Activity feed: Show schedule recalculation events

---

## KEY LEARNINGS FROM PROVEN REPOS

### ✅ DO:
1. **Use Material Design curves** - cubic-bezier(.4, 0, .2, 1) is battle-tested
2. **Keep durations short** - 200-225ms feels instant, >400ms drags
3. **Fade through intermediate state** - Never show jarring DOM updates
4. **Respect prefers-reduced-motion** - Accessibility matters
5. **Show calculation time** - Users love seeing speed (<1s)
6. **Log everything** - Replan events are valuable debugging data

### ❌ DON'T:
1. **Don't animate everything** - Micro-interactions don't need 1s transitions
2. **Don't skip mobile testing** - Animations must work on slow devices
3. **Don't block user input** - pointer-events:none on overlays
4. **Don't forget to flush styles** - void el.offsetWidth before transition
5. **Don't use auto** - Explicit values (opacity 0→1, not auto)

---

**Next Actions:**
1. Hour 12-14: Implement animation system
2. Hour 14-16: Dashboard/database integration
3. Test on mobile (responsive + performance)
4. Move to Phase 3: Learning Loop (Hour 16+)

**Time Remaining:** ~50 hours until Nov 4, 9PM EST deadline

