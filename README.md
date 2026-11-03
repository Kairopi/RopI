# 🚀 ROPI - AI Life Operating System

**Meta Global AI Developer Hackathon 2026**

> "One intelligent system that closes the loop between ambition and action"

## 🎯 What is ROPI?

ROPI is an **intelligent closed-loop career growth system** that:
- **Understands** your real life (work shifts, deadlines, goals, available time)
- **Coordinates** job applications + learning + schedule across everything
- **Adapts** in real-time when circumstances change (LifeShift)
- **Executes** autonomously with observable actions and verifiable evidence
- **Learns** from your actual results (quiz scores → skill updates → adjusted lessons)

Built with **100% Meta AI technology stack** for the Meta Global AI Developer Hackathon 2026.

---

## ✨ Key Features

### 🔄 **LifeShift - Real-Time Adaptation (WOW #1)**
Type "Manager added shift, only 20min tonight" → watch entire system recalculate in < 1 second.
- Constraint-based scheduling (not LLM guessing)
- Coordinated action across jobs + learning + schedule
- Observable reasoning: "Here's what I did and why"

### 🧠 **Learning Feedback Loop (WOW #2)**
Get one quiz answer wrong → watch ROPI update your skill level + adjust tomorrow's lesson live.
- Uses ts-fsrs (proven spaced-repetition algorithm, not fake AI)
- Identifies weak spots automatically
- Adapts future content based on YOUR results

### 💼 **Autonomous Job Applications**
Agents apply to jobs overnight with permission design + verifiable evidence.
- 6-stage pipeline (discover → score → tailor → approve → apply → track)
- Fact-preserving resume editing (never fabricates)
- Observable execution with screenshots + confirmation IDs
- Approval required before submission

### 🎙️ **Voice Everywhere**
Hands-free interaction while commuting, cooking, or exercising.
- Voice quizzes with Web Speech API
- Natural conversation with Meta Muse Voice
- Works on mobile + desktop

---

## 🏗️ Tech Stack

- **Frontend:** Vite + React + TypeScript + TailwindCSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Meta Muse Wonder, Meta Muse Spark, Meta Muse Voice Transcribe
- **Scheduling:** ts-fsrs (spaced repetition)
- **Browser Automation:** Stagehand (vision-based)
- **Deployment:** Vercel

---

## 🎨 Design System

Complete design system documented in `DESIGN_SYSTEM.md`:
- Meta purple theme (#a855f7)
- Observable intelligence patterns
- 6 core components (AgentStatus, EvidenceCard, SkillMeter, etc.)
- Mobile-first, voice-ready
- Animation principles for WOW moments

---

## 📋 Build Plan

48-hour build broken down hour-by-hour in `TASKS.md`:
- **Phase 1 (Hour 0-8):** Foundation ✅
- **Phase 2 (Hour 8-16):** LifeShift WOW moment
- **Phase 3 (Hour 16-24):** Learning Loop WOW moment
- **Phase 4 (Hour 24-32):** Job application system
- **Phase 5 (Hour 32-40):** Supporting features
- **Phase 6 (Hour 40-48):** Demo ready + submission

Current status tracked in `STATUS.md`.

---

## 🆚 What Makes ROPI Different?

### **We Borrowed From 25 Production Systems:**

| System | What We Borrowed | GitHub |
|--------|-----------------|--------|
| **Khoj** | Searchable knowledge, scheduled tasks | [khoj-ai/khoj](https://github.com/khoj-ai/khoj) |
| **Skyvern** | Act-Extract-Validate, evidence trails | [Skyvern-AI/skyvern](https://github.com/Skyvern-AI/skyvern) |
| **Smart Agentic Calendar** | Constraint-based scheduling | [fbdo/smart-agentic-calendar](https://github.com/fbdo/smart-agentic-calendar) |
| **ApplyPilot** | 6-stage job pipeline | [Pickle-Pixel/ApplyPilot](https://github.com/Pickle-Pixel/ApplyPilot) |
| **Resume Matcher** | Fact-preserving editing + ATS score | [srbhr/Resume-Matcher](https://github.com/srbhr/Resume-Matcher) |
| **ts-fsrs** | Proven spaced-repetition algorithm | [open-spaced-repetition/ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) |
| **+ 19 more systems** | See FINAL_REQUIREMENTS_2026.md | Complete list in docs |

### **What We Do Differently:**
- ❌ **Other tools:** Do one thing (schedule OR apply OR quiz)
- ✅ **ROPI:** ONE system that understands, coordinates, executes, and learns across EVERYTHING

---

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+
- npm or pnpm
- Supabase account

### **Installation**

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/ropi.git
cd ropi

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase URL and anon key

# Run development server
npm run dev
```

### **Database Setup**

1. Create Supabase project at https://supabase.com/dashboard
2. Copy 24-table schema from `FINAL_REQUIREMENTS_2026.md` (lines 2000-2500)
3. Run SQL in Supabase SQL Editor
4. Enable email auth in Authentication settings

---

## 📊 Database Schema

24 tables organized by feature:

**Scheduling (6 tables):**
- `time_blocks`, `availability_windows`, `calendar_events`, `replan_log`, `scheduling_conflicts`, `user_context`

**Job Applications (5 tables):**
- `job_applications`, `resumes`, `cover_letters`, `recruiters`, `company_watchlists`

**Learning (4 tables):**
- `lessons`, `lesson_progress`, `concept_cards`, `review_sessions`

**Knowledge (1 table):**
- `knowledge_items`

**Agent System (8 tables):**
- `tasks`, `agent_intentions`, `verified_actions`, `activity_log`, `action_history`, `agent_permissions`, `control_handoffs`, `quiz_attempts`

---

## 🎬 Demo Scenarios

### **Scenario 1: LifeShift**
1. Dashboard shows 90min study session
2. Type: "Manager added shift, only 20min tonight"
3. Watch interface recalculate in < 1s
4. See before/after comparison
5. Observe coordinated changes across jobs + learning

### **Scenario 2: Learning Loop**
1. Take voice quiz on AWS Lambda
2. Answer 4/5 correct (get timeout limit wrong)
3. Watch skill meter update: 68% → 70%
4. See weak spot: "Timeout limits (0/3 correct)"
5. See tomorrow's lesson: "Memory trick for 900 seconds"

### **Scenario 3: Job Application**
1. Browse jobs with match scores
2. Click "Monzo PM" (90% match)
3. Review tailored resume (ATS: 92/100)
4. Approve application
5. Watch agent apply with evidence

---

## 📚 Documentation

- **DESIGN_SYSTEM.md** - Complete design system
- **TASKS.md** - 48-hour build plan
- **STATUS.md** - Real-time progress tracker
- **FINAL_REQUIREMENTS_2026.md** - Complete requirements
- **LEARNINGS_FROM_*.md** - Research from 25 systems

---

## 🏆 Why This Wins

1. **Closed-Loop Intelligence** - Not just automation, actual learning from results
2. **100% Meta Technology** - Muse Wonder, Spark, Voice
3. **Solves Real Problems** - 41% say time is biggest barrier, 47% pause job search
4. **Autonomous + Intelligent** - Acts while you're offline, coordinates everything
5. **Two Jaw-Dropping Moments** - LifeShift + Learning Loop (no other team has this)
6. **Production-Ready** - Built from 25 proven patterns, not invented from scratch

---

## 📝 License

MIT License - Built for Meta Global AI Developer Hackathon 2026

---

## 🙏 Acknowledgments

This project synthesizes proven patterns from 25 open-source systems:
- Khoj, Open Notebook (knowledge)
- Skyvern (automation)
- Smart Agentic Calendar, Open Sunsama, Super Productivity (scheduling)
- ApplyPilot, Job Seek, Resume Matcher, Reactive Resume, Job Application Tracker (jobs)
- LearnHouse, ts-fsrs, SurfSense, Karakeep (learning)
- Pipecat, LiveKit Agents, Kokoro-FastAPI (voice)
- OpenMuse, AnythingLLM, Pipali, OpenClaw, OpenBot, Nanobot, Nanobrowser (platform)

See `FINAL_REQUIREMENTS_2026.md` for complete attribution with GitHub links.

---

**Built with 🧠 + ⚡ for Meta Global AI Developer Hackathon 2026**

**Deadline:** November 4, 2026 @ 9PM EST  
**Status:** In progress (Hour 2 of 48)
