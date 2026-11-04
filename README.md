# Ropi

Ropi plans your study and job search around the free time you actually have, and replans when your week changes. It is built for the Meta Global AI Developer Hackathon 2026, with Meta's Muse models for the language work.

You tell Ropi when you're free and what you need to do. It places each task in your free time before it's due. When something changes ("manager added a shift, only 20 min tonight"), only the blocks that lost their time move, and each one says why. Quizzes, review cards and job deadlines feed the same week, so a question you miss becomes a practice block and a closing date becomes time to apply.

## What you can do

| Page | What it's for |
|---|---|
| **Today** | What to do next and why. Your week on a calendar with dates: click empty time to add something to do or busy time, click a block to start it or mark it done. Check-ins after a planned block ends ("Done, took 30 min"). Last 7 days. |
| **LifeShift** | Say or type what changed. Meta Muse turns the sentence into a constraint, the scheduler replans, moved blocks travel to their new slot, and anything that no longer fits gets concrete fixes ("Do 135 min instead", "Skip it this week"). |
| **Learn** | Quizzes that score each concept separately. Missed questions become FSRS review cards. Meta Muse writes a short lesson on your weakest concept. Upload a PDF or DOCX and get a quiz where every answer quotes the exact line it came from. Voice quizzes. |
| **Jobs** | Search real openings from company career pages (Job Seek). Saving a job also fetches its full description. Score your resume against it, tailor the resume with Meta Muse, approve it, then apply yourself. A Board view shows every job by stage. |
| **Tasks** | Everything on your plate this week, what's at risk, and how your real times compare with your estimates. |
| **History** | Everything you did, day by day, with how Ropi knows: "Recorded by Ropi" or "You reported". Entries can't be edited or deleted. |
| **Ask Ropi** (Ctrl/Cmd + K) | Questions about your own week and progress ("What have I been getting wrong?"). Answers cite your quiz history, cards, notes and plan. |

## Honesty rules

These are enforced in code, not just stated:

- **Ropi never applies for you.** "Applied" is something you report, and History shows it as "You reported".
- **Document quizzes keep only questions whose quote is word for word in your document** (`quoteIsInChunk`). Anything Muse can't back up is dropped.
- **Ask Ropi answers only from your own records.** Citations to evidence that doesn't exist are stripped before you see them (`verifyCitations`).
- **Replan explanations come from the scheduler's data, not from a language model** (`explainChanges`).
- **A job isn't scored without a real description.** It asks for one instead.
- **History is append-only.** Row-level security allows inserts and reads, never updates or deletes.

## Where Meta models are used

All calls go to the Meta Model API's OpenAI-compatible chat completions endpoint (`src/lib/api/muse.ts`), mostly with `muse-spark-1.3`:

- reading your free time and LifeShift sentences into structured data (`parse-availability.ts`, `parse-constraint.ts`)
- writing quizzes on any topic and from your documents (`topic-quiz.ts`, `source-quiz.ts`)
- the lesson on your weakest concept (`adaptive-lessons.ts`)
- summaries and tags for uploaded documents (`sources.ts`)
- Ask Ropi answers (`knowledge/ask.ts`)
- resume tailoring and interview practice (`resume-tailor.ts`, `interview-coach.ts`)

Where a result can be checked, it is: quotes against the document, citations against the evidence, and every parsed constraint against valid dates and minutes. If Muse is down or returns something invalid, LifeShift falls back to built-in rules and says "Parsed by rules".

What isn't a model:
- **Scheduling** is a constraint scheduler adapted from smart-agentic-calendar.
- **Review timing** is FSRS (`ts-fsrs` 6.0.0).
- **Resume scoring** is deterministic. It checks the job description's key terms, named skills, job title, resume sections and gaps between jobs.
- **Voice** uses the browser's Web Speech API.

## Run it locally

You need Node 20.19+ (or 22.12+), which is what Vite 8 requires, and a Supabase project.

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:5173
```

`.env`:

| Variable | What it is |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable (anon) key |
| `VITE_MUSE_API_KEY` | Meta Model API key |
| `VITE_META_API_BASE_URL` | Optional, defaults to `https://api.meta.ai/v1` |

Database setup:
1. In the Supabase SQL editor, run `supabase-schema.sql`.
2. Run each file in `supabase-migrations/` in filename order. Each one is safe to re-run.
3. Turn on anonymous sign-ins (Authentication > Providers). Ropi signs every visitor in anonymously, so row-level security (`auth.uid() = user_id`) works without email confirmation.

These steps were applied to the live hackathon project. Running the whole sequence on a brand-new project hasn't been tested.

Other commands: `npm run build`, `npm run typecheck`.

## How it was checked

End-to-end browser tests (Playwright) run against the live Supabase project and Meta API:

- the main flow: onboarding, quiz, weak spot, review cards, lesson, LifeShift, Ask Ropi, check-in, History
- the calendar: add busy time, add a task, open a block, collapse a section
- PDF upload to a quoted quiz
- jobs: search, save with description, score, tailor, I applied, History
- the Board
- History backfill and the phone calendar

Logic suites cover the scheduler, week logic, voice command parsing, document sources, FSRS previews and resume scoring.

These test scripts live in `.tmp-check/`, which is not committed yet.

## Known limits

- **The Meta API key is in the browser bundle** (`VITE_MUSE_API_KEY`), which is fine for a demo but not for production. Production needs a small server proxy that holds the key.
- **Your week (free time, tasks, busy time) is saved in this browser** (localStorage). Quizzes, cards, jobs, documents and History are in Supabase. There's no cross-device sync or email login yet.
- **Nothing runs in the background.** "Last 7 days" and the plan are worked out when you open the app, and there are no notifications.
- **Job descriptions are fetched automatically only for Job Seek listings.** For a job from elsewhere, you paste the description.
- **Voice answers need Chrome, Edge or Safari**, and you can't interrupt Ropi while it reads.

## Credits

Code adapted from, and designs followed from, open-source projects, each pinned to the exact commit studied and with its licence: see `THIRD_PARTY_NOTICES.md`. What was taken from each repo and why is in `docs/UPSTREAM_AUDIT.md`.

Job listings come from [Job Seek](https://jseek.co): Viktor Shcherbakov, "Collection of Job Postings," (c) 2025, [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Job descriptions belong to the employers.
