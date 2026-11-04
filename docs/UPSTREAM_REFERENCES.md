# ROPI OPEN-SOURCE REFERENCE LIBRARY

**Purpose:** Research references and reusable components for ROPI development.

**Instructions:** 
1. Inspect current ROPI codebase FIRST
2. For each capability, inspect relevant repo, verify features work
3. Examine LICENSE and dependencies
4. Choose: install, extract, adapt, or integrate
5. Pin source commits and retain legal notices
6. Use existing working code rather than rebuilding

---

## 01. CORE AGENTS / PERSONAL AI

### ⭐ FIRST PRIORITY: OpenMuse
**URL:** https://github.com/CopilotKit/openmuse  
**Purpose:** Tasks, approvals, browser workers, receipts  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Task management system
- Approval flow patterns
- Browser worker implementation
- Receipt/evidence generation

### OpenBot
**URL:** https://github.com/CopilotKit/OpenBot  
**Purpose:** Isolated agent computers, permissions and activity logs  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Permission system architecture
- Activity logging patterns
- Agent isolation mechanism

### CopilotKit
**URL:** https://github.com/CopilotKit/CopilotKit  
**Purpose:** Shared frontend-agent state and generative UI  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- State management patterns
- Generative UI components

### Khoj
**URL:** https://github.com/khoj-ai/khoj  
**Purpose:** Personal knowledge, research, memory and automations  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Knowledge indexing
- Search patterns
- Automation scheduling

### Pipali
**URL:** https://github.com/khoj-ai/pipali  
**Purpose:** Desktop coworker, files and background tasks  
**Status:** 🔍 TO INSPECT

### OpenClaw
**URL:** https://github.com/openclaw/openclaw  
**Purpose:** Always-on personal agent and messaging  
**Status:** 🔍 TO INSPECT

### Nanobot
**URL:** https://github.com/HKUDS/nanobot  
**Purpose:** Lightweight personal assistant  
**Status:** 🔍 TO INSPECT

### AnythingLLM
**URL:** https://github.com/Mintplex-Labs/anything-llm  
**Purpose:** Agent workspaces and document tools  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Workspace isolation patterns
- Document processing

---

## 02. PLANNING / LIFESHIFT

### ⭐ FIRST PRIORITY: Smart Agentic Calendar
**URL:** https://github.com/fbdo/smart-agentic-calendar  
**Purpose:** Scheduling constraints, deadlines, replanning  
**Status:** ✅ CLONED - Currently inspecting  
**Local Path:** `c:\Users\HP\Documents\MUSE CODE\github-extractions\smart-agentic-calendar`  
**Key Files:**
- ✅ `src/engine/scheduler.ts` - Constraint-based scheduling algorithm
- ✅ `src/engine/conflict-detector.ts` - Deadline conflict detection
- ✅ `src/engine/replan-coordinator.ts` - Automatic replanning
- `src/models/task.ts` - Task data model
- `src/models/schedule.ts` - Schedule result types

**Algorithm Pattern:**
1. Build availability map (subtract events/blocks from available windows)
2. Score slots (deadline proximity + priority + focus time + energy + buffer)
3. Topological sort tasks (respect dependencies)
4. Place tasks (bin packing into best-scored slots)
5. Return schedule + at-risk tasks

### Super Productivity
**URL:** https://github.com/super-productivity/super-productivity  
**Purpose:** Timeboxing, actual durations and daily planning  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Timeboxing logic
- Actual vs estimated tracking

### Open Sunsama (STUDY ONLY)
**URL:** https://github.com/ShadowWalker2014/open-sunsama  
**Purpose:** Day-planning UX patterns  
**Status:** 📚 REFERENCE ONLY (check license)

---

## 03. JOB OPPORTUNITIES / APPLICATIONS

### ⭐ FIRST PRIORITY: Resume Matcher
**URL:** https://github.com/srbhr/Resume-Matcher  
**Purpose:** Verified CV tailoring and document generation  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Fact-preserving resume editing logic
- ATS score calculation algorithm
- Keyword matching patterns

### Job Seek
**URL:** https://github.com/colophon-group/jobseek  
**Purpose:** Vacancy discovery from employer websites  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Job scraping patterns
- Company watchlist system

### Job Application Tracker
**URL:** https://github.com/waddington/job-application-tracker  
**Purpose:** Status, interviews and follow-ups  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Application stage tracking
- CRM patterns for recruiters

### Reactive Resume
**URL:** https://github.com/reactive-resume/reactive-resume  
**Purpose:** Resume data structure and PDF layout  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Resume data model (JSON schema)
- Version control patterns
- PDF generation

### ApplyPilot (REVIEW LICENSE)
**URL:** https://github.com/Pickle-Pixel/ApplyPilot  
**Purpose:** Automated application pipeline  
**Status:** ⚠️ LICENSE CHECK REQUIRED

---

## 04. LEARNING / STUDY / KNOWLEDGE

### ⭐ FIRST PRIORITY: ts-fsrs
**URL:** https://github.com/open-spaced-repetition/ts-fsrs  
**Purpose:** Spaced-repetition review scheduler  
**Status:** ✅ CLONED - Ready to inspect  
**Local Path:** `c:\Users\HP\Documents\MUSE CODE\github-extractions\ts-fsrs`  
**Key Files:**
- `src/fsrs/` - FSRS algorithm implementation
- `src/scheduler.ts` - Review scheduling logic
- TypeScript native (perfect for ROPI)

### ⭐ FIRST PRIORITY: Open Notebook
**URL:** https://github.com/lfnovo/open-notebook  
**Purpose:** Source-grounded notebooks and learning  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Source citation patterns
- Learning notebook structure

### LearnHouse
**URL:** https://github.com/learnhouse/learnhouse  
**Purpose:** Course structures and exercises  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Course data model
- Progress tracking patterns

### SurfSense
**URL:** https://github.com/shaneholloman/surfsense  
**Purpose:** Research and source-connected knowledge  
**Status:** ✅ CLONED - Ready to inspect  
**Local Path:** `c:\Users\HP\Documents\MUSE CODE\github-extractions\surfsense`  
**Files to Check:**
- Document processing
- Quiz generation from sources

### Karakeep
**URL:** https://github.com/karakeep-app/karakeep  
**Purpose:** Bookmarking, notes, tagging and search  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Auto-tagging logic
- Knowledge organization

### Memori
**URL:** https://github.com/DoradoDevs/ai-study-flashcards-app  
**Purpose:** Quizzes, flashcards, practice tests  
**Status:** 🔍 TO INSPECT

### Docling
**URL:** https://github.com/docling-project/docling  
**Purpose:** Parsing PDF and document content for AI  
**Status:** 🔍 TO INSPECT

---

## 05. BROWSER EXECUTION / AUTOMATION

### ⭐ FIRST PRIORITY: Playwright
**URL:** https://github.com/microsoft/playwright  
**Purpose:** Browser actions and automated testing  
**Status:** 📦 PRODUCTION-READY (npm install)  
**Integration:** Standard package, well-documented

### Stagehand
**URL:** https://github.com/browserbase/stagehand  
**Purpose:** AI-guided browser navigation and extraction  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Vision-based element detection
- Action extraction patterns

### Skyvern
**URL:** https://github.com/Skyvern-AI/skyvern  
**Purpose:** Observable browser automation workflows  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Act-Extract-Validate pattern
- Screenshot evidence system
- Action history logging

### Nanobrowser
**URL:** https://github.com/nanobrowser/nanobrowser  
**Purpose:** Browser agent and interaction patterns  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Ask/Auto permission modes
- Site-specific rules

### Activepieces
**URL:** https://github.com/activepieces/activepieces  
**Purpose:** Scheduled workflow and integration architecture  
**Status:** 🔍 TO INSPECT

---

## 06. VOICE

### Pipecat
**URL:** https://github.com/pipecat-ai/pipecat  
**Purpose:** Realtime conversational voice pipelines  
**Status:** 🔍 TO INSPECT  
**Files to Check:**
- Voice agent pipeline architecture
- Turn-taking logic

### LiveKit Agents
**URL:** https://github.com/livekit/agents  
**Purpose:** Realtime voice and turn-taking  
**Status:** 🔍 TO INSPECT

### Kokoro FastAPI
**URL:** https://github.com/remsky/Kokoro-FastAPI  
**Purpose:** Local text-to-speech service  
**Status:** 🔍 TO INSPECT

---

## 07. NOTES / LONG-TERM PERSONAL WORKSPACE

### Memos
**URL:** https://github.com/usememos/memos  
**Purpose:** Personal journal and activity timeline  
**Status:** 🔍 TO INSPECT

### AFFiNE
**URL:** https://github.com/toeverything/affine  
**Purpose:** Rich notes, whiteboard and knowledge workspace  
**Status:** 🔍 TO INSPECT

---

## 08. PREMIUM UI / COMPONENTS / MOTION

### ⭐ FIRST PRIORITY: shadcn/ui
**URL:** https://github.com/shadcn-ui/ui  
**Purpose:** Reusable UI foundation  
**Status:** ✅ INSTALLED in ROPI  
**Components Used:** button, card, badge, input, dialog

### ⭐ FIRST PRIORITY: Untitled UI Icons
**URL:** https://github.com/untitleduico/icons  
**Purpose:** Free premium-style icons  
**Status:** ✅ INSTALLED (@untitledui/icons-react)  
**Note:** Deprecated warning, using Lucide instead

### ⭐ FIRST PRIORITY: Motion for React
**URL:** https://github.com/motiondivision/motion  
**Purpose:** One central animation engine  
**Status:** ✅ READY TO INSTALL (framer-motion)

### Motion Primitives
**URL:** https://github.com/ibelick/motion-primitives  
**Purpose:** Specialised animated interactions  
**Status:** 🔍 TO INSPECT

### 21st MCP
**URL:** https://github.com/21st-dev/magic-mcp  
**Purpose:** UI component discovery  
**Status:** 🔍 TO INSPECT

### React Flow
**URL:** https://github.com/xyflow/xyflow  
**Purpose:** Goal and dependency graph interface  
**Status:** 🔍 TO INSPECT

### Storybook
**URL:** https://github.com/storybookjs/storybook  
**Purpose:** Component development and visual states  
**Status:** 🔍 TO INSPECT (post-MVP)

---

## 09. BROWSER REVIEW / DEVELOPMENT

### ⭐ FIRST PRIORITY: Playwright MCP
**URL:** https://github.com/microsoft/playwright-mcp  
**Purpose:** Inspect and test the ROPI website  
**Status:** 🔍 TO INSPECT (testing phase)

### Chrome DevTools MCP
**URL:** https://github.com/ChromeDevTools/chrome-devtools-mcp  
**Purpose:** Performance and rendering diagnostics  
**Status:** 🔍 TO INSPECT (optimization phase)

### OpenHands
**URL:** https://github.com/OpenHands/OpenHands  
**Purpose:** Coding agent and execution architecture reference  
**Status:** 🔍 TO INSPECT

---

## PRODUCT DESIGN REFERENCES (DOCUMENTATION, NOT CODE)

### Vercel Geist Design System
**URL:** https://vercel.com/geist/introduction  
**Status:** ✅ REVIEWED - Applied to ROPI_DESIGN.md

### GitHub Primer
**URL:** https://primer.style/  
**Status:** ✅ REVIEWED - Applied to ROPI_DESIGN.md

### Adobe Spectrum
**URL:** https://spectrum.adobe.com/  
**Status:** ✅ REVIEWED - Applied to ROPI_DESIGN.md

### Atlassian Design
**URL:** https://atlassian.design/  
**Status:** ✅ REVIEWED - Applied to ROPI_DESIGN.md

### shadcn MCP
**URL:** https://ui.shadcn.com/docs/mcp  
**Status:** 📚 REFERENCE

### 21st MCP Setup
**URL:** https://21st.dev/mcp  
**Status:** 📚 REFERENCE

---

## NEXT STEPS: UPSTREAM AUDIT

Create `docs/UPSTREAM_AUDIT.md` comparing the **5 FIRST PRIORITY** projects:

1. **OpenMuse** - Tasks, approvals, receipts
2. **Smart Agentic Calendar** - ✅ STARTED (scheduler.ts reviewed)
3. **Resume Matcher** - CV tailoring
4. **ts-fsrs** - ✅ CLONED (ready to inspect)
5. **Open Notebook** - Source-grounded learning

For each, document:
- ✅ Actual relevant files
- ✅ Proven working features
- ✅ Dependencies
- ✅ Current LICENSE
- ✅ Reuse strategy
- ✅ Integration difficulty

Then build ONE cohesive ROPI app using:
- Meta models for AI layer
- Shared persistent state
- Genuine LifeShift engine
- Real action receipts
- Evidence-based study loop

---

**Last Updated:** Hour 8 - November 3, 2026  
**Status:** Reference library created, beginning systematic audit
