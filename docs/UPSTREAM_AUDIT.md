# Upstream audit: the five FIRST-priority modules

Audited 4 November 2026 by reading each repository's code and tests, not its README. Every repo was cloned into `github-extractions/` and pinned to the commit below. Licences come from each repo's own `LICENSE` file. I only call a feature "proven" when there is implementation code and a test for it. I did not run the upstream test suites; Ropi's own checks are listed at the end.

| Module | Repo @ pinned commit | Licence (copyright line) | What we took | How | Difficulty |
|---|---|---|---|---|---|
| OpenMuse | `CopilotKit/openmuse` @ `a4944f4c471d3dc93b8bfc060b5da309b5216ab2` | MIT, "Copyright (c) 2026 OpenMuse contributors" | Approval and receipt model, activity timeline layout, honest outcome states | Adapted the pattern (no code copied) | S |
| Smart Agentic Calendar | `fbdo/smart-agentic-calendar` @ `6088e957e17eda94fd362f8e420510827b5ed858` | MIT, "Copyright (c) 2024-2026 Fabio Oliveira" | Scheduler core (ported earlier), trailing-block rule, conflict suggestions | Ported and adapted to TypeScript in the browser | M |
| Resume Matcher | `srbhr/Resume-Matcher` @ `d480551798b7aa97f5b57ba1972ee383bd882238` | Apache-2.0 (template line, no named holder) | Not yet. Verified-tailoring design written up below | Planned: port the patterns | M |
| ts-fsrs | `open-spaced-repetition/ts-fsrs` @ `f582c1d5660f3ae7780683511fd8506f7615ec20` (installed: npm `ts-fsrs@6.0.0`) | MIT, "Copyright (c) 2026 Open Spaced Repetition" | FSRS-7 scheduler, `preview`, forgetting curve | Installed as a package | S |
| Open Notebook | `lfnovo/open-notebook` @ `5e285b7a2e435895c4ee99ad7e4b8d2af64c3239` | MIT, "Copyright (c) 2024 Luis Novo" | Source, chunk and cite pattern | Adapted the pattern (Python/SurrealDB, so nothing copied) | M |

Notices for adapted code are in `THIRD_PARTY_NOTICES.md` and in comments at the top of each ported function.

---

## 1. OpenMuse: tasks, approvals, browser workers, receipts

**Stack.** pnpm monorepo on Node 22 or later:
- Server: Hono on port 8787. Embedded PGlite by default, or Postgres via `DATABASE_URL`.
- Client: one Expo app (React Native plus web).
- Browser worker: Playwright, run in Docker.
- An optional Linux "computer": a Docker image or an E2B sandbox.
- Key dependencies: `@copilotkit/runtime 1.70.1`, `@ag-ui/core 0.0.59`, `@tanstack/ai`, `zod ^4.1`, `hono ^4.11`.
- `CPK_INTELLIGENCE_API_KEY` is required in every mode. Real model mode adds an OpenAI, Anthropic or Google key.

**Relevant files**
- `packages/domain/src/index.ts`. Defines `ActionProposal` (status values `awaiting_review | executing | succeeded | failed | outcome_unknown | denied | cancelled | expired`, plus `hash` and `expiresAt`) and `ActivityEntry`.
- `packages/domain/src/agent.ts`. Defines `AgentTask`, `TaskStep`, `Evidence` and `RunEvent`.
- `apps/server/src/actions.ts`. `ActionService.propose`:
  - the proposal id is a sha256 of an idempotency key;
  - the payload hash is a sha256 of the exact input;
  - a review expires after 30 minutes.

  `ActionService.decide` then:
  - rejects a hash mismatch with 409;
  - expires stale reviews;
  - claims the action atomically (one conditional UPDATE), so it can only run once;
  - records an activity entry for every transition.
- `apps/server/src/db.ts`. A single generic `records(owner, kind, id, data jsonb)` table. `recoverInterruptedActions` marks anything still "executing" after a crash as `outcome_unknown`.
- UI: `apps/mobile/src/details.tsx` `ReviewDetail` (the approval card) and `apps/mobile/src/screens.tsx` `ActivityScreen` (a "Needs review" filter plus a timeline).

**Proven by tests.** `tests/actions.test.ts` covers:
- denying never executes;
- concurrent approvals run only once;
- a stale hash is rejected;
- expired or disconnected proposals are blocked;
- `outcome_unknown` cannot be retried;
- a cancelled task never executes.

There are 52 test files in `tests/`, and CI runs lint, typecheck, tests and Docker smoke tests. Live LLM and Google behaviour are not tested; `docs/FEATURES.md` lists them as "Remaining extension".

**Reuse decision.** Installing it isn't possible: the repo is private (`private: true`), the client is React Native and it needs a CopilotKit key. We adopted the patterns instead:
- an append-only receipts table;
- every receipt states how it is known (`system_recorded`, `self_reported` or `external_confirmed`);
- the UI never claims more than the receipt shows (job applications are `self_reported` because Ropi does not submit anything);
- an activity timeline with filters and expandable evidence.

Files: `src/lib/receipts.ts`, `src/pages/Activity.tsx`, and the `receipts` table in `supabase-migrations/20261104_receipts_and_sources.sql`.

**Not adopted (yet).** Hash-bound expiring proposals, and browser workers. Ropi has no automated action that would need approval before it executes, and building fake automation would break the "don't claim unverified actions" rule.

---

## 2. Smart Agentic Calendar: constraints, deadlines, replanning

**Stack.** TypeScript ESM package v0.2.1. Dependencies: `@modelcontextprotocol/sdk`, `better-sqlite3`, `rrule` and `zod`. Tests run on vitest 4.

**Relevant files**
- `src/engine/scheduler.ts`.
  - `generateSchedule` builds an availability map, sorts tasks topologically by dependency, places them greedily into the best-scoring slots and reports at-risk tasks.
  - Weights are `deadlineProximity 40, priority 30, focusTime 15, energy 10, buffer 5`.
  - `adjustForTrailingBlock` stops it leaving a fragment smaller than the minimum block.
- `src/engine/conflict-detector.ts`. `detectConflicts` handles overdue tasks, infeasible dependency chains and insufficient time. `suggestDeprioritizations` suggests lower-priority tasks to drop; it never suggests one due sooner, and stops once enough minutes are freed.
- `src/engine/replan-coordinator.ts`. Coalesces replan requests with a dirty flag and `setTimeout(0)`, replaces the schedule atomically, keeps the previous schedule if a replan fails, and updates task statuses.

**Proven by tests.**
- `tests/unit/engine/scheduler*.test.ts`.
- `tests/pbt/scheduler.pbt.test.ts`: property-based checks that blocks never overlap, stay inside free time and keep scores bounded.
- `tests/unit/engine/conflict-detector.test.ts`, `tests/integration/scheduling-pipeline.test.ts`, and `tests/performance/replan-latency.test.ts` (200 tasks in under 500 ms).

**Its limits, found by reading the code.**
- Replanning is always a full rebuild, so one change can move unrelated blocks.
- Placement does not enforce deadlines (blocks can land after one).
- Energy scoring is wired to `null`.
- All maths is in UTC.
- It is a 3-star hobby project. It is well tested, but not "industry proven".

**What Ropi does now** (`src/lib/scheduling/`)

| Capability | Ropi before | Ropi now |
|---|---|---|
| Task ordering | Pairwise comparator with a 1 h tolerance. Not transitive, so results depended on input order | One numeric key per task: deadline plus a priority offset. Total and deterministic (`orderKey`) |
| Replanning | Full rebuild on every change | **Stable replan** (`stableReplan`). Blocks that still fit keep their exact slots and only affected tasks are re-placed. A full rebuild is used only if it lowers the priority-weighted unscheduled minutes (`riskCost`) |
| Trailing fragments | No-op bug | Ported upstream `adjustForTrailingBlock` |
| Block ids | Random | Deterministic: `${taskId}#${index}@${start}` |
| "Why it moved" | Text templates chosen by constraint type | `explainChanges` builds each reason from engine data: which slot disappeared, who took a slot, the deadline, the trigger sentence |
| Conflicts | An at-risk reason string only | `suggestFixes`, ported from `suggestDeprioritizations`. Options: do the minutes that fit, skip lower-priority tasks scheduled before the deadline, or skip this task. One click applies it and it can be undone |
| What-if | None | `planWith` previews "N tasks will move, M won't fit" before you confirm |
| Deadlines | Already enforced (better than upstream) | Kept |
| Local time | Already local (better than upstream UTC) | Kept |

Tests: `.tmp-check/lifeshift-engine.ts` runs 21 checks. They cover stability, determinism, explanations, suggestions never sacrificing a more urgent task, no overlaps, nothing scheduled past a deadline, and 60 tasks with 3 replans in about 38 ms.

---

## 3. Resume Matcher: verified CV tailoring

**Stack.** Python 3.13 with FastAPI 0.143 and SQLAlchemy 2.1 (SQLite by default). It calls LLMs through LiteLLM 1.104, parses documents with MarkItDown 0.1.8 and pdfminer, and renders PDFs with Playwright. The frontend is Next.js 16, React 19 and Tailwind 4.

**Relevant files** (under `apps/backend/app/`)
- `services/ats.py` `compute_ats_score`. Fully deterministic, no LLM. Weights are keyword 0.40, skills 0.20, title 0.15, sections 0.15, dates 0.10. A sub-score that can't be evaluated is `None` and its weight is spread over the others. `text_match.keyword_in_text` matches on word boundaries.
- `services/improver.py`. Diff-based tailoring:
  - the LLM returns `changes[{path, action, original, value, reason}]`;
  - a path whitelist and blocklist protect companies, dates, titles and degrees;
  - `_verify_original_matches` rejects a change whose quoted original doesn't match;
  - `verify_diff_result` flags invented metrics with `_METRIC_RE`.
- `services/resume_preservation.py`.
  - `_novel_numbers` normalises currency, %, x and k/m/b and counts how often each appears.
  - `finalize_ai_resume` repairs drift in protected fields.
  - `validate_confirmed_resume` is a hard gate.
  - Grounding warnings fire below 0.45 similarity.
- `prompts/templates.py`. `CRITICAL_TRUTHFULNESS_RULES_TEMPLATE` and `DIFF_IMPROVE_PROMPT`.

**Proven by tests.** `tests/unit/test_verify_diffs.py` (17 tests), `test_ai_preservation.py` (about 40), `test_apply_diffs.py`, `test_ats.py`, plus PDF render and lifecycle tests.

**Gaps in Ropi today.**
- `ats-scorer.ts` matches skills with substrings from a 45-word list ("java" matches "javascript"), and keyword and skills scores count the same signal twice.
- `resume-tailor.ts` returns plain text and checks only banned words. Nothing checks numbers, dates or companies.

Two Ropi bugs were fixed in this pass:
- Scoring passed `skills: []`, which forced skills coverage to 0%.
- Interview practice called a Cohere endpoint (`muse.cohereai.com`, model `command-r-plus`); it now calls Meta Muse.

**Reuse decision: port the patterns, not the Python.** Apache-2.0 allows this with attribution and notices of modification. The planned design (next phase):
1. Muse in JSON mode returns diffs, each with its quoted original.
2. Diffs on whitelisted paths only.
3. A deterministic gate drops any change that introduces a number, company, title or date not found in the base resume.
4. A diff view with a "23/23 facts verified" receipt.

---

## 4. ts-fsrs: spaced-repetition scheduler

**Installed** as `ts-fsrs@6.0.0`, an npm dependency.

**Relevant API** (from the installed type definitions, `dist/index.d.mts` and `dist/index-bfbmySB3-*.d.mts`):
- `DefaultScheduler(options)` creates a scheduler. Ropi uses version FSRS-7, desired retention 0.9 and learning steps 1m and 10m.
- `scheduler.review({card, grade, now})` returns `{card, revlog}`.
- `scheduler.preview({card, now})` returns an iterable of the 4 outcomes (Again, Hard, Good, Easy).
- `scheduler.model.forgettingCurve(memory, elapsedDays)` gives retrievability.
- `forget` and `rollback` also exist.
- No parameter optimiser ships in the package.

**Proven.** The upstream repo has its own test suite. Ropi's checks (`.tmp-check/fsrs.ts`, `.tmp-check/fsrs-preview.ts`) exercise it end to end:
- A new card previews as Again 1m, Hard 14h, Good 5d, Easy 2mo.
- After two "Good" ratings the card is due in 10 days.
- Memory strength reads 100% right after review, 94% after 3 days and 85% after 30 days.

**What was missing and is now used.**
- `preview` was wrapped (`previewRatings`) but never shown. The rating buttons now say "back in 5d".
- Retrievability was computed with an elapsed time that could flip sign and clamp to 100%. It is now measured directly from `lastReviewAt`, and each card shows "NN% recall".

**Reuse decision.** Keep it as a package. Consider `rollback` for an "undo last rating" button later.

---

## 5. Open Notebook: source-grounded notebooks

**Stack.** Python with FastAPI and LangGraph, SurrealDB, `content-core` for extraction (with an optional Docling engine), `esperanto` for multi-provider LLMs and embeddings, `podcast-creator`, and a Next.js 16 frontend.

**Relevant files**
- `open_notebook/graphs/source.py`. Ingests a URL, a file or text: validates the path and checks for SSRF, extracts content, saves the source, then fans out transformations.
- `open_notebook/utils/chunking.py`. Splits HTML, Markdown or plain text on structure. Defaults: 400-token chunks, 15% overlap, tiny chunks dropped.
- `open_notebook/domain/notebook.py`. `source_embedding` stores the chunks; `text_search` is BM25; `vector_search` uses embeddings.
- `prompts/ask/*.jinja` and `prompts/chat/system.jinja`. Citations are **prompt-only**: the model writes `[source:id]` at document level. No code checks that a citation exists or supports the claim.
- It has no quiz or flashcard feature.

**Reuse decision: adapt the pattern for the browser plus Postgres, with one improvement.**
- Uploaded PDF and DOCX text is kept as a `source`. It is split into overlapping chunks of about 300 words; page numbers are kept and the sliding window prefers paragraph breaks.
- Chunks are indexed with Postgres full-text search through the `search_chunks` RPC, so no embedding service is needed.
- Quizzes from a document: Meta Muse must return the passage id plus an 8-30 word verbatim quote for each question. **Ropi checks the quote is actually in that passage** (whitespace and quote marks normalised) and drops any question that fails. Open Notebook trusts the model's citation.
- Results show "From your notes · title, page N · quote verified word for word". Missed questions become FSRS cards that keep the quote.
- Weak spots from a document quiz are practised from the same document, by text or by voice.

Files: `src/lib/documents/sources.ts`, `src/lib/learning/source-quiz.ts`, `src/hooks/useQuiz.ts` (`?source=`), `src/pages/Learning.tsx`, `src/pages/QuizResults.tsx`. Tests: `.tmp-check/source-logic.ts` (11 checks on the chunker and quote verification).

---

## Voice (from LEARNINGS_FROM_3_VOICE_SYSTEMS.md)

Pipecat, LiveKit Agents and Kokoro are server-side real-time stacks. We did not install them. The turn-taking ideas are built on the browser Web Speech API in `src/components/VoiceQuiz.tsx`:
- live interim transcript;
- 3 recognition alternatives;
- spoken commands (repeat, read the options, skip, stop);
- up to 2 retries, then skip, so it never stalls;
- a read-back confirmation when confidence is low;
- the explanation is read aloud on a wrong answer.

Any quiz can now be taken by voice, including topic, weak-spot and document quizzes. LifeShift has a mic button. Tests: `.tmp-check/voice-parse.ts` (31 cases).

Not done:
- **Barge-in.** Speaker echo makes it unreliable without headphones.
- **Meta speech-to-text fallback** (`muse-voice-transcribe-1.0` exists in `GET /v1/models`). Its endpoint shape isn't verified, and the browser would expose the API key, so it needs a server proxy first.

## Licence summary

| Source | Licence | What that means for Ropi |
|---|---|---|
| OpenMuse | MIT | Patterns only. Attribution kept in comments |
| Smart Agentic Calendar | MIT | Ported code. MIT notice in THIRD_PARTY_NOTICES.md and in code comments |
| Resume Matcher | Apache-2.0 | Planned port. Must keep the licence and mark modified files |
| ts-fsrs | MIT | npm dependency. Licence ships in node_modules |
| Open Notebook | MIT | Patterns only. Attribution kept in comments |
| Super Productivity | MIT | Quick-add grammar re-implemented. Attribution in `src/lib/week/quick-add.ts` |

---

## Learnings docs: what each recommendation became

Status: **Built** means it is in the app and covered by a test. **Changed** means built differently from the doc, for the reason given. **Not built** means deliberately left out.

### LEARNINGS_FROM_KHOJ.md / KHOJ_UPDATES_SUMMARY.md

| Recommendation | Status | Where |
|---|---|---|
| "Refresh my memory": search YOUR notes and history | **Built** as Ask Ropi (Ctrl/Cmd+K, sidebar, voice input). It retrieves your concept stats, quiz attempts, review cards, document passages (Postgres full-text) and plan. Meta Muse answers only from that evidence and cites ids; citations to anything not retrieved are removed. | `src/lib/knowledge/ask.ts`, `src/components/AskRopi.tsx`; test `.tmp-check/ask-live.ts` (10/10). A live run correctly answered "Lambda cold starts, 0 of 2 correct [H1]" and refused an off-topic question. |
| Study agent that references your weak spots | **Built.** It is the same engine. The answer ends with one action taken from the cited evidence (for example, "Practice Lambda cold starts"). | as above |
| Semantic search with pgvector + embeddings | **Changed** to Postgres full-text search (`search_chunks`). No Meta embeddings endpoint was verified, and full-text search needs no extra service. | `supabase-migrations/20261104_receipts_and_sources.sql` |
| Scheduled automations (Monday jobs, daily readiness, weekly progress) | **Changed** to on-open insights. There is no server cron, and the app never claims to send notifications. "Last 7 days" on Today is computed from real records (quizzes, FSRS reviews, tasks checked off, applications). Daily readiness comes from the loop tasks and Up next. | `src/components/WeekInReview.tsx`, `src/hooks/useLoop.ts` |
| Knowledge → actions (notes become quizzes and reminders) | **Built.** Documents become verified-quote quizzes. Missed questions become FSRS cards that keep the quote. Weak spots become scheduled practice blocks. | `source-quiz.ts`, `process-quiz.ts`, `useLoop.ts` |
| Cross-device continuity | Not built. The week is stored per browser for an anonymous account. Signing in with email is the next step. | |

### LEARNINGS_FROM_3_SCHEDULING_SYSTEMS.md

| Recommendation | Status | Where |
|---|---|---|
| Constraint-based scheduling (hard + soft) | **Built** | `scheduler.ts`, `availability.ts`, `scoring.ts` |
| Automatic replanning | **Built.** Plans are rebuilt from "now" on every view. Only the blocks that lost their time move (stable replan). | `plan.ts` `stableReplan`; test `lifeshift-engine.ts` (21/21) |
| Conflict detection + suggested actions | **Built**: do the minutes that fit, skip lower-priority tasks (never one due sooner), or skip this task. One click to apply, undoable. | `plan.ts` `suggestFixes`, `LifeShift.tsx` |
| LifeShift animation + explained reasoning | **Built.** Reasons come from engine data, not templates. | `explainChanges`, `WeekCanvas.tsx` |
| Time-blocking UI with an unscheduled panel | **Built**: week canvas plus a "doesn't fit" tray | `WeekCanvas.tsx` |
| Unfinished task handling (end-of-day review) | **Built** as a per-block check-in. Once a planned block ends, Today asks: Done (how long it took), Did some (the rest is re-planned), Not yet, or Drop it. | `src/components/CheckIn.tsx`, `useWeek.checkIn`; e2e "check-in after a planned block" |
| Estimation accuracy (actual vs estimated) | **Built.** The Tasks "Done" list shows planned vs actual and "Tasks take you N% longer than planned". | `TaskBoard.tsx` |
| Agents doing job prep in the background | Not built. There are no automated actions, and the app never claims one happened. | |
| Calendar sync, RRULE, teams, integrations | Not built (the doc also says don't build) | |

### LEARNINGS_FROM_4_LEARNING_SYSTEMS.md

| Recommendation | Status | Where |
|---|---|---|
| FSRS spaced repetition (ts-fsrs) | **Built**, including the interval preview on every rating button and per-card recall % | `spaced-repetition.ts`, `DailyReviews.tsx`; test `fsrs-preview.ts` |
| Document processing (your materials) | **Built**: PDF/DOCX kept as sources, ~300-word overlapping chunks with page numbers | `lib/documents/sources.ts`; test `source-logic.ts` |
| Quizzes from YOUR materials | **Built.** Every question must quote its passage word for word, or it is thrown out. | `source-quiz.ts` |
| Auto-tagging + search (Karakeep) | **Built.** Meta Muse writes a one-line summary and 3-5 tags when you save a document. Search is Ask Ropi. | `sources.ts` `autoTag`, `Learning.tsx` |
| Topic / lesson structure (LearnHouse) | **Changed.** Your goal + topics + per-concept mastery (concept_stats) + adaptive lessons. A full course and lesson tree is an LMS feature, which the doc says not to build. | `skill-tracker.ts`, `adaptive-lessons.ts` |
| Browser extension, mind maps, podcasts, mobile apps | Not built (the doc lists them as later) | |
