# Ropi

**Turn your dead time into growth time.** Ropi is a study and career coach for people who are studying and job hunting around a full life: they moved abroad, they're changing careers, they're working toward a certification. They don't get free evenings, they get 5 minutes on the platform and 20 on the bus. Ropi makes those minutes count, and plans the bigger work around the free time they actually have, replanning when the week changes. It is built for the Meta Global AI Developer Hackathon 2026, with Meta's Muse models for the language work.

You tell Ropi when you're free and what you need to do. It places each task in your free time before it's due. When something changes ("manager added a shift, only 20 min tonight"), only the blocks that lost their time move, and each one says why. Quizzes, review cards and job deadlines feed the same week, so a question you miss becomes a practice block and a closing date becomes time to apply.

## What you can do

| Page | What it's for |
|---|---|
| **Today** | **Got a few minutes?** Pick 2, 5, 10 or 20 minutes and whether you can look at the screen. Ropi lists up to three things that fit, from your own data: the cards FSRS says are due, the concept you score worst on, a job that closes in the next 3 days, a short news brief on your goal. Audio only keeps to things Ropi can say out loud. Then what to do next and why. Your week on a 24-hour calendar with dates: click empty time to add something to do or busy time, click a block to start it or mark it done. Check-ins after a planned block ends ("Done, took 30 min"). Last 7 days, with Growth time: quiz time, card reviews, tasks done and time talking with Ropi. Finishing a quiz ticks off the block that planned it. |
| **Talk** | Hands-free, for small gaps in the day. Say "I have 10 minutes on the train" and Ropi says how to spend them ("start" opens the first one). Or "I'm lost, what does a project charter mean?", "quiz me", "latest news on PMP", "a podcast for my commute" ("under 15 minutes" picks an episode that fits), "remind me to read chapter 4 tomorrow", "find product manager jobs in London", or "help me answer this form question". Ropi answers out loud in the voice you pick, keeps listening until you say stop, and saves every conversation with the time of each message. |
| **LifeShift** | Say or type what changed. Meta Muse turns the sentence into a constraint, the scheduler replans, moved blocks travel to their new slot, and anything that no longer fits gets concrete fixes ("Do 135 min instead", "Skip it this week"). |
| **Learn** | One box to start: type a topic and choose **Quiz me** or **Study guide + cards**, or switch to **My notes** and drop a PDF or DOCX. A study guide opens as soon as you save it, and the cards you keep join your daily reviews. A folder for each topic you study, which you can rename and add subtopics to. Each folder holds its documents, quizzes (dated), review cards, conversations with Ropi, and links you or Ropi saved. Quizzes score each concept separately. Missed questions become FSRS review cards. Meta Muse writes a short lesson on your weakest concept. Upload a PDF or DOCX and get a quiz where every answer quotes the exact line it came from. Voice quizzes. |
| **Jobs** | One search across five job sources: Job Seek (company career pages), Remotive, Remote OK, Jobicy and Arbeitnow. Saving a job keeps its full description. Score your resume against it, tailor the resume with Meta Muse, approve it, then apply yourself on the source's site. A Board view shows every job by stage. |
| **Tasks** | Everything on your plate this week, what's at risk, and how your real times compare with your estimates. |
| **History** | Everything you did, day by day: quizzes, reviews, replans, applications and conversations. A 5-week calendar at the top lets you jump to any day. Each entry says how Ropi knows: "Recorded by Ropi" or "You reported". Entries can't be edited or deleted. |
| **Ask Ropi** (Ctrl/Cmd + K) | Questions about your own week and progress ("What have I been getting wrong?"). Answers cite your quiz history, cards, notes and plan. |

## On your phone

Ropi has a web app manifest, so Chrome and Edge can install it (Android, Windows, macOS). Long-press (or right-click) the installed icon for two shortcuts: **5 minutes** opens Today on 5 minutes, and **Audio only** opens Talk and asks for a 5-minute audio plan. iOS doesn't support web app shortcuts. There's no service worker, so Ropi needs a connection.

## Honesty rules

These are enforced in code, not just stated:

- **Got a few minutes never plans more minutes than you picked**, and Audio only never offers a screen task.
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
- Talk: working out what you asked for, explanations, coaching replies and form-answer drafts (`coach/brain.ts`)
- latest news, through Meta search grounding: the Responses API with the `web_search` tool. Answers are cited, and the source links are shown (`callMuseWithWebSearch` in `api/muse.ts`)
- summaries and tags for uploaded documents (`sources.ts`)
- Ask Ropi answers (`knowledge/ask.ts`)
- resume tailoring and interview practice (`resume-tailor.ts`, `interview-coach.ts`)

Where a result can be checked, it is: quotes against the document, citations against the evidence, and every parsed constraint against valid dates and minutes. If Muse is down or returns something invalid, LifeShift falls back to built-in rules and says "Parsed by rules".

What isn't a model:
- **Scheduling** is a constraint scheduler adapted from smart-agentic-calendar.
- **Got a few minutes?** is a small set of rules (lib/spare/plan.ts). It never plans more minutes than you said.
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
2. Run each file in `supabase-migrations/` in filename order. Each one is safe to re-run. `20261104b_library.sql` adds topic folders and conversations. Until it runs, those are kept in the browser instead.
3. Turn on anonymous sign-ins (Authentication > Providers). Ropi signs every visitor in anonymously, so row-level security (`auth.uid() = user_id`) works without email confirmation.

These steps were applied to the live hackathon project. Running the whole sequence on a brand-new project hasn't been tested.

Other commands: `npm run build`, `npm run typecheck`.

## How it was checked

End-to-end browser tests (Playwright) run against the live Supabase project and Meta API:

- the main flow: onboarding, quiz, weak spot, review cards, lesson, LifeShift, Ask Ropi, check-in, History, and Got a few minutes picking the new weak spot
- Learn: one composer, a typed topic opens a quiz, a study guide opens after saving and its kept cards are added to reviews (counted in the database), a quiz ticks off its planned block, the manifest and shortcut URL
- spare minutes: the plan fits the time, Growth time counts a Talk conversation, Audio only has no screen tasks, the choice is remembered, Start opens the step, and Talk answers "I have 10 minutes on the train"
- the calendar: add busy time, add a task, open a block, collapse a section
- PDF upload to a quoted quiz
- jobs: search, save with description, score, tailor, I applied, History
- the Board
- History backfill and the phone calendar

Logic suites cover the spare-minutes picker, the scheduler, week logic, voice command parsing, document sources, FSRS previews and resume scoring.

These test scripts live in `.tmp-check/`, which is not committed yet.

## Known limits

- **The Meta API key is in the browser bundle** (`VITE_MUSE_API_KEY`), which is fine for a demo but not for production. Production needs a small server proxy that holds the key.
- **Your week (free time, tasks, busy time) is saved in this browser** (localStorage). Quizzes, cards, jobs, documents and History are in Supabase. There's no cross-device sync or email login yet.
- **Nothing runs in the background.** "Last 7 days" and the plan are worked out when you open the app, and there are no notifications.
- **Job descriptions are fetched automatically only for Job Seek listings.** For a job from elsewhere, you paste the description.
- **Voice needs Chrome, Edge or Safari.** You stop Ropi by tapping, not by talking over it (no barge-in). Ropi's voice is the browser's own; you pick one of the voices installed on your device.
- **Talk never submits applications or fills in forms for you.** It drafts answers for you to check and paste.

## Credits

Code adapted from, and designs followed from, open-source projects, each pinned to the exact commit studied and with its licence: see `THIRD_PARTY_NOTICES.md`. What was taken from each repo and why is in `docs/UPSTREAM_AUDIT.md`.

Job listings come from [Job Seek](https://jseek.co): Viktor Shcherbakov, "Collection of Job Postings," (c) 2025, [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Job descriptions belong to the employers.
