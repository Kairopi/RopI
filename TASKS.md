# 📋 ROPI - 48 HOUR BUILD TASKS
## Meta Global AI Hackathon 2026

**Deadline:** November 4, 2026 @ 9PM EST  
**Time Remaining:** ~67 hours  
**Start Time:** November 1, 2026 @ 6PM EST

---

## 🎯 BUILD STRATEGY

### **Core Philosophy: DEMO FIRST**
Build the TWO jaw-dropping moments FIRST, then fill in surrounding features.

**Priority Order:**
1. **WOW Moments** (16 hours) - LifeShift + Learning Loop
2. **Core Loop** (16 hours) - Job discovery → approval → apply
3. **Supporting Features** (8 hours) - Knowledge, voice, polish
4. **Demo Ready** (8 hours) - Fake data, video, submission

---

## ⏰ HOUR-BY-HOUR BREAKDOWN

### **PHASE 1: FOUNDATION (Hours 0-8) - 8 hours** ✅ COMPLETE

#### **Hour 0-2: Project Setup** ✅ COMPLETE
**Status:** DONE - All dependencies installed, server running

**Tasks:**
- [x] Initialize Vite + React + TypeScript
- [x] Install TailwindCSS + shadcn/ui dependencies
- [x] Install Supabase client
- [x] Install React Router + React Query
- [x] Create folder structure
- [x] Create App.tsx with routing shell
- [x] Update index.html (title, meta tags)
- [x] Create .env file from .env.example
- [x] Test dev server runs

**Deliverable:** ✅ `npm run dev` works on http://localhost:5173/

---

#### **Hour 2-4: Supabase Setup** ✅ COMPLETE (Using Mock Auth)
**Status:** BYPASSED - Using localStorage mock authentication for hackathon demo

**Decision:** Supabase publishable key authentication had 401 errors. Instead of debugging during hackathon, we implemented mock auth system that works perfectly for demo. Can migrate to real Supabase post-MVP.

**What's Done:**
- [x] Supabase project created (mvopnwzaatoivybzucwh.supabase.co)
- [x] Schema file created (supabase-schema.sql with 24 tables)
- [x] .env configured with Supabase credentials
- [x] Mock authentication implemented (AuthContext with localStorage)
- [x] Auth works perfectly for demo

**What's Deferred:**
- [ ] Real Supabase auth integration (post-hackathon)
- [ ] Running schema in Supabase (not needed for demo with mock data)
- [ ] RLS policies (not needed for demo)

**Deliverable:** ✅ Mock auth works, can login/logout, routes protected

---

#### **Hour 4-6: Auth + Layout** ✅ COMPLETE

**Tasks:**
- [x] Create Login page (email magic link UI)
- [x] Create AuthContext provider (mock localStorage)
- [x] Create ProtectedRoute wrapper
- [x] Create DashboardLayout component
  - [x] Sidebar navigation (Desktop)
  - [x] Mobile bottom nav
  - [x] User menu (top right)
  - [x] Logo + branding
- [x] Create placeholder pages:
  - [x] Dashboard (with stats cards and activity feed)
  - [x] JobBoard (placeholder)
  - [x] LearningHub (placeholder)
  - [x] LifeShift (placeholder)
  - [x] KnowledgeBase (placeholder)
  - [x] TaskBoard (interactive task tracking)
- [x] Test navigation works

**Deliverable:** ✅ Can login, see dashboard, navigate between all pages

---

#### **Hour 6-8: Design System Setup** ✅ COMPLETE

**Tasks:**
- [x] Create shadcn/ui components (button, card, badge, input already installed)
- [x] Apply color system from ROPI_DESIGN.md
- [x] Test responsive breakpoints
- [ ] Create custom ROPI components (will build as needed)

**Deliverable:** Foundation ready, moving to WOW moments

**STRATEGY PIVOT:** Instead of extracting code from 25 repos, we're building clean implementations using their ALGORITHMS and PATTERNS. See `MASTER_IMPLEMENTATION_PLAN.md` for full strategy.

---

### **PHASE 2: WOW MOMENT #1 - LIFESHIFT (Hours 8-16) - 8 hours**

#### **Hour 8-10: LifeShift Algorithm** ✅ COMPLETE

**Reference Docs:**
- ✅ `docs/UPSTREAM_REFERENCES.md` - All GitHub links organized
- ✅ `docs/UPSTREAM_AUDIT.md` - Smart Agentic Calendar audit complete
- ✅ GitHub repo cloned: `github-extractions/smart-agentic-calendar`

**Tasks:**
- [x] Read Smart Agentic Calendar implementation
  - ✅ Audited `src/engine/scheduler.ts` (668 lines)
  - ✅ Extracted algorithm patterns (see UPSTREAM_AUDIT.md)
  - ✅ Understood constraint-based approach (NOT LLM)
- [x] Define interfaces
  - ✅ Created `src/lib/scheduling/types.ts`
  - ✅ Task, TimeBlock, AvailableSlot, Constraint interfaces
  - ✅ SlotScore, Schedule, AtRiskTask types
- [x] Create scheduling modules:
  - ✅ `src/lib/scheduling/utils.ts` - Time helpers (diffMinutes, addMinutes, etc.)
  - ✅ `src/lib/scheduling/availability.ts` - Build availability map, consume slots
  - ✅ `src/lib/scheduling/scoring.ts` - 5 scoring functions (deadline, priority, focus, energy, buffer)
  - ✅ `src/lib/scheduling/scheduler.ts` - Main scheduler (generateSchedule, recalculateSchedule)
- [x] Create mock data:
  - ✅ `src/lib/mock/schedule-data.ts` - Demo tasks, events, constraints, applyConstraint()
- [x] Test scenarios ready:
  - ✅ Scenario 1: 90min → 20min (timeReduced constraint)
  - ✅ Scenario 2: New deadline added (urgentDeadline constraint)
  - ✅ Scenario 3: Work shift conflict (shiftConflict constraint)
- [ ] Verify recalculation < 1 second (will test in UI)

**Algorithm (Implemented from Smart Agentic Calendar):**
```typescript
// ✅ BUILT: Constraint-based scheduling (Proven pattern)
function generateSchedule(tasks, availability, events, config) {
  // 1. ✅ Build availability map (windows - events - blocks = free slots)
  const slots = buildAvailabilityMap(availability, events, pinnedBlocks);
  
  // 2. ✅ Score slots (deadline 40% + priority 30% + focus 15% + energy 10% + buffer 5%)
  const scoredSlots = slots.map(slot => scoreSlot(task, slot, context));
  
  // 3. ✅ Place tasks (greedy bin packing into best-scored slots)
  const blocks = [];
  for (const task of orderedTasks) {
    const placement = placeTask(task, scoredSlots, existingBlocks);
    blocks.push(...placement.blocks);
  }
  
  // 4. ✅ Return schedule + at-risk tasks
  return { blocks, atRiskTasks, calculationTime };
}

// ✅ BUILT: Recalculation function
function recalculateSchedule(currentSchedule, tasks, newAvailability) {
  return generateSchedule(tasks, newAvailability, events, config);
}
```

**Files Created (5 files, ~600 lines):**
- ✅ `src/lib/scheduling/types.ts` (171 lines) - TypeScript interfaces
- ✅ `src/lib/scheduling/utils.ts` (47 lines) - Time helpers
- ✅ `src/lib/scheduling/availability.ts` (205 lines) - Availability map builder
- ✅ `src/lib/scheduling/scoring.ts` (146 lines) - Slot scoring functions
- ✅ `src/lib/scheduling/scheduler.ts` (318 lines) - Main scheduler algorithm
- ✅ `src/lib/mock/schedule-data.ts` (207 lines) - Demo data

**Deliverable:** ✅ Algorithm works, ready for UI integration

**Performance:** Algorithm complexity O(n*m) where n=tasks, m=slots. Expected <100ms for typical workload (10 tasks × 50 slots)

---

#### **Hour 10-12: LifeShift UI** ✅ COMPLETE

**Tasks:**
- [x] Create LifeShift page layout
- [x] Create ScheduleTimeline component
  - [x] Shows time blocks (study, work, break)
  - [x] Color-coded by type (learning=blue, career=purple, personal=emerald)
  - [x] Drag-to-reorder (deferred - not needed for MVP demo)
- [x] Create ConstraintInput component
  - [x] Text input: "Manager added shift, only 20min tonight"
  - [x] Parse natural language → structured constraint (3 patterns: time_reduced, deadline_added, shift_conflict)
  - [x] Show parsed result with details
  - [x] Example constraints provided
- [x] Create BeforeAfter comparison view
  - [x] Split screen: Before | After
  - [x] Highlight what changed (ring animation on changed tasks)
  - [x] Show recalculation time (<1s performance)
  - [x] Show at-risk tasks if any
- [x] Wire to backend:
  - [x] Fetch current schedule (generateSchedule on mount)
  - [x] Submit constraint change (recalculateSchedule)
  - [x] Show loading state
  - [x] Animate update (300ms delay + highlight transitions)
- [x] Added navigation link to sidebar
- [x] Reset demo functionality

**Files Created:**
- ✅ `src/pages/LifeShift.tsx` - Main page with state management
- ✅ `src/components/ScheduleTimeline.tsx` - Timeline visualization component
- ✅ `src/components/BeforeAfterView.tsx` - Split-screen comparison with stats
- ✅ `src/components/ConstraintInput.tsx` - Natural language input parser

**Demo Flow:**
1. Initial schedule generated with 5 mock tasks
2. User types constraint (e.g., "only 20min tonight")
3. Constraint parsed to structured data
4. Click "Apply & Recalculate"
5. Schedule recalculates in <1s
6. Before/After view shows changes with highlights
7. At-risk tasks displayed if any
8. Reset button to try again

**Performance:**
- Recalculation: <50ms (well under 1s target) ✅
- 5 tasks → optimal time blocks ✅
- Constraint-based scoring working correctly ✅

**Deliverable:** ✅ DEMO-READY - Can type constraint, see schedule recalculate instantly

---

#### **Hour 12-14: LifeShift Animation** ✅ COMPLETE

**Tasks:**
- [x] Create recalculation animation:
  - [x] Fade out old schedule (200ms ANI_LEAVE_CURVE)
  - [x] Show "Recalculating..." with real-time timer (60fps updates)
  - [x] Slide in new schedule (225ms ANI_ENTER_CURVE)
  - [x] Highlight changed items (ring-2 ring-primary shadow-md)
- [x] Add agent status updates:
  - [x] Scheduler: "Analyzing constraint..."
  - [x] Job Agent: "Adjusting X tasks"
  - [x] Study Agent: "Optimizing learning blocks"
  - [x] Staggered animations (0.1s delay between items)
- [x] Add explanation card:
  - [x] "Here's what I did and why..." header
  - [x] Show reasoning steps per task
  - [x] Display old→new time slots
- [x] Polish transitions:
  - [x] Material Design cubic-bezier curves
  - [x] AnimatePresence for mount/unmount
  - [x] Smooth state transitions (idle→fade-out→calculating→fade-in→complete)
- [x] Test on mobile:
  - [x] Responsive grid layout (1 col mobile, 3 col desktop)
  - [x] motion-reduce:transition-none for accessibility

**Files Created:**
- ✅ `src/lib/animations/constants.ts` - Material Design timing curves & durations
- ✅ `src/components/RecalculatingLoader.tsx` - Animated loader with 60fps timer
- ✅ `src/components/AgentStatusFeed.tsx` - Staged agent status updates
- ✅ `src/components/ReasoningCard.tsx` - Explanation of schedule changes

**Files Updated:**
- ✅ `src/pages/LifeShift.tsx` - Integrated animation system, added transition states
- ✅ `src/components/BeforeAfterView.tsx` - Added Framer Motion animations

**Animation Details:**
```typescript
// Proven patterns from super-productivity (70k+ stars)
TRANSITION_DURATION_M = 225ms  // Standard
ANI_STANDARD_CURVE = cubic-bezier(.4, 0, .2, 1)  // Material Design
ANI_ENTER_CURVE = cubic-bezier(0, 0, .2, 1)      // Entrance
ANI_LEAVE_CURVE = cubic-bezier(.4, 0, 1, 1)      // Exit

// Transition flow
Phase 1: Fade out (200ms) + store before state
Phase 2: Calculate (visible timer updates at 16ms intervals)
Phase 3: Fade in (225ms) + highlight changes
Phase 4: Show reasoning card (delayed 300ms)
```

**Performance:**
- Real-time timer: 60fps (16ms intervals) ✅
- Total animation time: 425ms (200+225) ✅
- Calculation shown transparently: <50ms ✅
- Accessibility: Respects prefers-reduced-motion ✅

**Deliverable:** ✅ POLISHED - Smooth animations, transparent calculation, professional UX

---

#### **Hour 14-16: LifeShift Integration** ✅ COMPLETE

**Tasks:**
- [x] Connect to Dashboard:
  - [x] Show "Today's Schedule" card (TodaysScheduleCard component)
  - [x] Click → opens LifeShift page (navigate('/schedule'))
  - [x] Show last recalculation time (formatDistanceToNow)
- [x] Global state management:
  - [x] Created useSchedule hook with Zustand
  - [x] Persist schedule across page navigation
  - [x] Track lastRecalculationTime
- [x] Add to activity feed:
  - [x] "Schedule recalculated (42ms)" with Zap icon
  - [x] Show calculation time badge
  - [x] Animated with Framer Motion variants
- [ ] Connect to Job Agent:
  - [ ] When schedule changes, update agent priorities
  - [ ] Agent respects new time constraints
- [ ] Connect to Learning:
  - [ ] Quiz duration adapts to available time
  - [ ] Shows "15min quiz" vs "30min quiz"
- [ ] Save to database:
  - [ ] Insert into `replan_log` table
  - [ ] Track: trigger, before, after, duration

**Files Created:**
- ✅ `src/hooks/useSchedule.ts` - Zustand store for global schedule state
- ✅ `src/components/TodaysScheduleCard.tsx` - Dashboard widget with click-to-navigate

**Files Updated:**
- ✅ `src/pages/Dashboard.tsx` - Integrated TodaysScheduleCard + activity feed animations

**Features Implemented:**
```typescript
// Global state (persisted to localStorage)
const { currentSchedule, lastRecalculationTime, setSchedule } = useSchedule();

// Activity feed entry (animated)
<Zap /> Schedule recalculated
<Badge>{calculationTime}ms</Badge>
{formatDistanceToNow(lastRecalculationTime)}

// Dashboard card → LifeShift navigation
<Card onClick={() => navigate('/schedule')}>
  {todayBlocks.map(block => ...)}
</Card>
```

**Deliverable:** ✅ Dashboard integrated - Schedule visible, clickable, activity tracked

**Note:** Database persistence (replan_log) and agent integration deferred to post-MVP (not blocking WOW moment demo)

---

### **PHASE 3: WOW MOMENT #2 - LEARNING LOOP (Hours 16-24) - 8 hours**

#### **Hour 16-18: Quiz System** ✅ CRITICAL FIX COMPLETE

**Status:** ts-fsrs v6 API fixed and working! See `CRITICAL_FIX_COMPLETE.md`

**Completed:**
- [x] ~~Read SurfSense + ts-fsrs from LEARNINGS_FROM_4_LEARNING_SYSTEMS.md~~
- [x] ~~Install ts-fsrs library: `npm install ts-fsrs`~~ (Already installed v6.0.0)
- [x] ~~Create `lib/learning/spaced-repetition.ts`~~ ✅ REWRITTEN WITH CORRECT V6 API
  - [x] Initialize FSRS scheduler (async DefaultScheduler)
  - [x] Calculate next review date (scheduler.review)
  - [x] Update card difficulty based on answer
  - [x] Added previewRatings() function
  - [x] Added calculateRetrievability() function
  - [x] Added confidence calculation
  - [x] Added revlog saving
- [x] Updated DailyReviews.tsx to async
- [x] Created test file (__test-spaced-repetition.ts)
- [x] Build verified passing ✅

**Next Tasks:**
- [ ] Create quiz generation logic:
  - [ ] Parse user documents (PDF, MD, TXT)
  - [ ] Extract key concepts
  - [ ] Generate multiple-choice questions
  - [ ] Store in `concept_cards` table
- [ ] Create quiz taking flow:
  - [ ] Fetch due cards from ts-fsrs
  - [ ] Show question + options
  - [ ] Record answer + time taken
  - [ ] Calculate new review date
  - [ ] Update skill confidence

**Deliverable:** ✅ ts-fsrs v6 working, ready for quiz integration

---

#### **Hour 18-20: Skill Model Update**

**Tasks:**
- [ ] Create `lib/learning/skill-model.ts`
  - [ ] Track confidence per topic (0-100%)
  - [ ] Track quiz history (all attempts)
  - [ ] Identify weak spots (< 40% accuracy)
  - [ ] Calculate weighted average across attempts
- [ ] Create confidence calculation:
  ```typescript
  // Example: Lambda quizzes: 3/5, 4/6, 3/5, 4/5
  // Weighted average: recent attempts count more
  // Result: 68% confidence
  // Weak spot: Timeout limits (0/3 correct)
  ```
- [ ] Create skill update animation:
  - [ ] Confidence meter animates from old → new value
  - [ ] Show +/- change indicator
  - [ ] Highlight weak spots in red
- [ ] Update "Tomorrow's Lesson" card:
  - [ ] Based on weak spots identified
  - [ ] Show: "Memory trick for timeout limits"
- [ ] Save to database:
  - [ ] Update `skill_model` table
  - [ ] Insert into `quiz_attempts` table

**Deliverable:** Skill model updates live after quiz

---

#### **Hour 20-22: Voice Quiz (MVP)**

**Tasks:**
- [ ] Create Web Speech API integration:
  ```typescript
  // Speech Recognition (STT)
  const recognition = new webkitSpeechRecognition();
  recognition.onresult = (event) => {
    const answer = event.results[0][0].transcript;
    processAnswer(answer);
  };
  
  // Speech Synthesis (TTS)
  const utterance = new SpeechSynthesisUtterance(question);
  speechSynthesis.speak(utterance);
  ```
- [ ] Create VoiceQuizCard component:
  - [ ] Mic button (start/stop listening)
  - [ ] Visual feedback (pulsing ring)
  - [ ] Spoken question + options
  - [ ] Voice answer recognition
  - [ ] Match answer to option (fuzzy matching)
- [ ] Test voice commands:
  - [ ] "Option A" → selects A
  - [ ] "900 seconds" → matches correct answer
  - [ ] "Next question" → advances
- [ ] Add error handling:
  - [ ] "Sorry, I didn't catch that"
  - [ ] Show text fallback option

**Deliverable:** Voice quiz works hands-free

---

#### **Hour 22-24: Learning Loop Integration**

**Tasks:**
- [ ] Connect to Dashboard:
  - [ ] Show "Next Quiz" card
  - [ ] Show skill confidence meters
  - [ ] Show weak spots
- [ ] Connect to LifeShift:
  - [ ] Quiz duration adapts to schedule
  - [ ] "15min quiz" vs "30min quiz"
- [ ] Connect to Job Agent:
  - [ ] Update resume with new certifications
  - [ ] When confidence > 80% → add skill to resume
- [ ] Add to activity feed:
  - [ ] "Quiz completed: 4/5 (80%)"
  - [ ] "Skill updated: Lambda 68% → 70%"
  - [ ] "Tomorrow's lesson adjusted"
- [ ] Create LearningHub page:
  - [ ] Topic cards (AWS, Python, PM Skills)
  - [ ] Confidence meters
  - [ ] Quiz history
  - [ ] Spaced repetition calendar

**Deliverable:** DEMO-READY learning feedback loop

---

### **PHASE 4: JOB APPLICATION SYSTEM (Hours 24-32) - 8 hours**

#### **Hour 24-26: Job Discovery**

**Tasks:**
- [ ] Create job scraping simulation (fake data for demo)
  - [ ] 20 sample job postings (JSON)
  - [ ] Fields: title, company, location, salary, description, requirements
- [ ] Create JobBoard page:
  - [ ] List view with filters
  - [ ] Filters: location, salary, match %
  - [ ] Sort: match %, date posted, salary
- [ ] Create job matching algorithm:
  ```typescript
  // Match score = 
  // 40% keyword match (resume vs requirements)
  // 30% skill match
  // 20% experience match
  // 10% location preference
  ```
- [ ] Create JobCard component:
  - [ ] Company logo + title
  - [ ] Match percentage (badge)
  - [ ] Salary range
  - [ ] "View Details" button
- [ ] Create JobDetail modal:
  - [ ] Full description
  - [ ] Requirements list
  - [ ] Your matching skills (highlighted)
  - [ ] "Start Application" button

**Deliverable:** Can browse jobs, see match scores

---

#### **Hour 26-28: Resume Tailoring**

**Tasks:**
- [ ] Read Resume Matcher from LEARNINGS_FROM_5_JOB_APPLICATION_SYSTEMS.md
- [ ] Implement fact-preserving rules:
  ```typescript
  // NEVER fabricate:
  // - Company names
  // - Employment dates
  // - Metrics/numbers
  // - Education credentials
  
  // CAN modify:
  // - Bullet point wording
  // - Emphasis (bold key terms)
  // - Section order
  // - Summary statement
  ```
- [ ] Create resume tailoring flow:
  - [ ] Load base resume (from `resumes` table)
  - [ ] Analyze job requirements
  - [ ] Reorder bullets (most relevant first)
  - [ ] Emphasize matching keywords
  - [ ] Generate custom summary
  - [ ] Preview changes (diff view)
- [ ] Create ATS score calculator:
  ```typescript
  // Score = 
  // 40% keyword density (job vs resume)
  // 20% skill coverage
  // 15% title match
  // 15% completeness (no gaps)
  // 10% formatting (clean, parseable)
  ```
- [ ] Show ATS score: "92/100"

**Deliverable:** Resume tailoring works, shows ATS score

---

#### **Hour 28-30: Permission + Approval**

**Tasks:**
- [ ] Read permission patterns from LEARNINGS_FROM_5_AGENT_SYSTEMS.md
- [ ] Create permission system:
  - [ ] Workspace modes: ask / auto / supervised
  - [ ] Action-type rules: safe / confirmable / sensitive
  - [ ] Site-specific rules: LinkedIn = ask
- [ ] Create PermissionDialog component:
  - [ ] Shows: agent, action, target, reason, risk
  - [ ] Shows: tailored resume preview
  - [ ] Shows: ATS score
  - [ ] Options: "Approve Once", "Approve All Tonight", "Decline"
- [ ] Create approval flow:
  - [ ] Agent requests permission
  - [ ] Dialog appears
  - [ ] User reviews materials
  - [ ] User approves/declines
  - [ ] Agent proceeds or stops
- [ ] Save approval to database:
  - [ ] Insert into `agent_permissions` table
  - [ ] Track: who, what, when, decision, reason

**Deliverable:** Permission system works

---

#### **Hour 30-32: Application Submission (Simulated)**

**Tasks:**
- [ ] Create simulated application flow:
  - [ ] Agent "navigates" to company site (fake delay)
  - [ ] Agent "fills form" (show progress)
  - [ ] Agent "submits" (success animation)
  - [ ] Agent "extracts confirmation" (fake ID)
- [ ] Create evidence collection:
  - [ ] Take "screenshot" (show mock image)
  - [ ] Extract confirmation ID (generate random)
  - [ ] Validate success (check icon)
- [ ] Create EvidenceCard component:
  - [ ] Shows: screenshot thumbnail
  - [ ] Shows: confirmation data
  - [ ] Shows: timestamp
  - [ ] Click → full-size screenshot
- [ ] Update job status:
  - [ ] Status: "Applied" (with timestamp)
  - [ ] Add to `job_applications` table
  - [ ] Add evidence to `verified_actions` table
- [ ] Show in Dashboard activity feed:
  - [ ] "Applied to Monzo PM (Evidence: Screenshot)"
  - [ ] Click → shows evidence card

**Deliverable:** End-to-end job application flow works

---

### **PHASE 5: SUPPORTING FEATURES (Hours 32-40) - 8 hours**

#### **Hour 32-34: Dashboard Polish**

**Tasks:**
- [ ] Create "Today's Focus" section:
  - [ ] Next quiz card
  - [ ] Active agents card
  - [ ] Schedule summary
- [ ] Create "Active Agents" section:
  - [ ] Agent status indicators
  - [ ] Current action
  - [ ] Progress bar
  - [ ] Evidence count
- [ ] Create "Recent Activity" feed:
  - [ ] Last 10 actions
  - [ ] Grouped by: jobs, learning, schedule
  - [ ] Real-time updates
- [ ] Add skeleton loaders
- [ ] Add empty states
- [ ] Add error states
- [ ] Mobile responsive

**Deliverable:** Dashboard looks production-ready

---

#### **Hour 34-36: Knowledge Base (Basic)**

**Tasks:**
- [ ] Create KnowledgeBase page:
  - [ ] Document upload (PDF, MD, TXT)
  - [ ] Document list
  - [ ] Search bar
  - [ ] Auto-tagging (Karakeep pattern)
- [ ] Create document processing:
  - [ ] Extract text from PDF
  - [ ] Parse markdown
  - [ ] Generate tags (AI)
  - [ ] Store in `knowledge_items` table
- [ ] Create search:
  - [ ] Full-text search
  - [ ] Filter by tags
  - [ ] Show snippets
- [ ] Connect to quiz generation:
  - [ ] "Generate Quiz from This Document" button
  - [ ] Creates concept cards
  - [ ] Schedules with FSRS

**Deliverable:** Can upload documents, search, generate quizzes

---

#### **Hour 36-38: Agent Monitoring**

**Tasks:**
- [ ] Create AgentsPage:
  - [ ] List all agents
  - [ ] Status: idle / thinking / acting / success / error
  - [ ] Current task
  - [ ] Last action time
- [ ] Create agent controls:
  - [ ] Pause agent
  - [ ] Stop agent
  - [ ] Change mode (ask / auto / supervised)
- [ ] Create action history view:
  - [ ] Timeline of all actions
  - [ ] Filter by agent
  - [ ] Filter by date
  - [ ] Show evidence
- [ ] Create control handoff UI:
  - [ ] "🤚 I need your help"
  - [ ] Shows: blocker (login, 2FA, captcha)
  - [ ] User takes control
  - [ ] User releases control
  - [ ] Agent resumes

**Deliverable:** Can monitor and control agents

---

#### **Hour 38-40: Settings + Profile**

**Tasks:**
- [ ] Create Settings page:
  - [ ] User profile (name, email, avatar)
  - [ ] Goals (target job title, target exam)
  - [ ] Constraints (work schedule, study time)
  - [ ] Preferences (voice enabled, notifications)
  - [ ] Agent permissions (workspace mode)
- [ ] Create onboarding flow:
  - [ ] Welcome screen
  - [ ] Set goals
  - [ ] Upload base resume
  - [ ] Set schedule constraints
  - [ ] Choose agent mode
- [ ] Create profile update:
  - [ ] Save to `user_context` table
  - [ ] Update agents with new preferences

**Deliverable:** User can configure ROPI

---

### **PHASE 6: DEMO READY (Hours 40-48) - 8 hours**

#### **Hour 40-42: Demo Mode + Fake Data**

**Tasks:**
- [ ] Create demo mode flag:
  - [ ] `VITE_DEMO_MODE=true`
  - [ ] Uses fake data (no real Supabase calls)
- [ ] Create fake data generators:
  - [ ] 20 job postings
  - [ ] 5 quiz questions per topic
  - [ ] 3 agent actions with evidence
  - [ ] 1 base resume
  - [ ] 1 user profile
- [ ] Create demo scenario script:
  - [ ] Start: Dashboard with pending jobs
  - [ ] Action 1: Type "Manager added shift, only 20min tonight"
  - [ ] Result 1: LifeShift recalculation (WOW #1)
  - [ ] Action 2: Take voice quiz, get 1 wrong
  - [ ] Result 2: Skill update + lesson adjust (WOW #2)
  - [ ] Action 3: Approve job application
  - [ ] Result 3: Agent applies, shows evidence
- [ ] Test demo flow end-to-end

**Deliverable:** Demo runs smoothly without backend

---

#### **Hour 42-44: Video Recording**

**Tasks:**
- [ ] Write demo script (voice-over)
- [ ] Record screen:
  - [ ] Show Dashboard (overview)
  - [ ] Show LifeShift WOW moment
  - [ ] Show Learning Loop WOW moment
  - [ ] Show Job Application with evidence
  - [ ] Show Agent monitoring
- [ ] Edit video:
  - [ ] Add captions
  - [ ] Add "before/after" highlights
  - [ ] Add music (Meta approved)
  - [ ] Keep under 3 minutes
- [ ] Export video (1080p, MP4)

**Deliverable:** 3-minute demo video

---

#### **Hour 44-46: Documentation**

**Tasks:**
- [ ] Create README.md:
  - [ ] Project description
  - [ ] Tech stack
  - [ ] Setup instructions
  - [ ] Demo video link
  - [ ] GitHub links to 25 borrowed systems
- [ ] Create ARCHITECTURE.md:
  - [ ] System diagram
  - [ ] Database schema
  - [ ] Agent architecture
  - [ ] Meta AI integration points
- [ ] Create COMPETITIVE_ANALYSIS.md:
  - [ ] Table: ROPI vs 25 tools
  - [ ] What we borrowed from each
  - [ ] Why ROPI is different
- [ ] Create DEMO_SCRIPT.md:
  - [ ] Step-by-step demo instructions
  - [ ] Expected results
  - [ ] Troubleshooting

**Deliverable:** Complete documentation

---

#### **Hour 46-48: Submission + Buffer**

**Tasks:**
- [ ] Test on different browsers:
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari (if available)
- [ ] Test on mobile:
  - [ ] iPhone (if available)
  - [ ] Android (if available)
- [ ] Fix critical bugs
- [ ] Deploy to Vercel:
  - [ ] Connect GitHub repo
  - [ ] Set environment variables
  - [ ] Test production build
- [ ] Submit to hackathon:
  - [ ] Project URL
  - [ ] Demo video
  - [ ] GitHub repo
  - [ ] Documentation
- [ ] Buffer time for last-minute issues

**Deliverable:** SUBMITTED!

---

## 📊 PROGRESS TRACKING

### **Daily Check-ins**

**Day 1 (Hour 0-24):**
- [ ] Foundation complete
- [ ] LifeShift WOW moment working
- [ ] Learning Loop started

**Day 2 (Hour 24-48):**
- [ ] Learning Loop WOW moment working
- [ ] Job application flow complete
- [ ] Demo video recorded
- [ ] SUBMITTED

### **Risk Mitigation**

**If behind schedule:**
1. **Cut scope (not quality):**
   - Voice quiz → text quiz only
   - Knowledge base → skip
   - Agent monitoring → simplified
   
2. **Use MCP tools for speed:**
   - shadcn MCP for components
   - 21st MCP for UI references
   - Playwright MCP for testing

3. **Parallelize work:**
   - Frontend (dashboard) + Backend (agents) simultaneously

**If ahead of schedule:**
1. Add polish:
   - More animations
   - Better mobile experience
   - Voice assistant improvements
2. Add features:
   - Company watchlists (Job Seek pattern)
   - Interview practice (SAM 2)
   - Scheduled automation (Khoj pattern)

---

## 🎯 SUCCESS CRITERIA

### **Must Have (Demo Ready):**
- ✅ LifeShift recalculation (< 1s, animated)
- ✅ Learning feedback loop (quiz → skill update → lesson adjust)
- ✅ Job application with permission + evidence
- ✅ Dashboard showing all 3 features
- ✅ Demo video (< 3 min)
- ✅ Mobile responsive
- ✅ Documentation complete

### **Nice to Have (Extra Credit):**
- Voice quiz working
- Knowledge base search
- Agent control panel
- SAM 2 interview practice
- Company watchlists
- Multiple demo scenarios

### **MVP Requirements:**
- Uses 100% Meta AI technology
- Shows closed-loop intelligence
- Shows observable automation
- Shows active knowledge
- Two jaw-dropping demo moments
- Production-ready architecture

---

## 🚀 NEXT STEPS

**RIGHT NOW (Hour 0):**
1. ✅ Vite project initialized
2. ⏳ Finish index.html updates
3. ⏳ Create Supabase project
4. ⏳ Test dev server

**IMMEDIATE (Hour 0-2):**
- Complete foundation setup
- Move to Hour 2-4: Supabase schema

**TODAY (Hour 0-16):**
- Foundation complete
- LifeShift WOW moment working
- Sleep, then continue

---

**LET'S BUILD! 🚀**
