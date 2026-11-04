# Ropi demo script (3 minutes)

The story: **turn dead time into growth time.** People who moved abroad, are changing careers, or are studying for a certification while job hunting don't get free evenings. They get 5 minutes on the platform and 20 on the bus. Ropi makes those minutes count, and keeps the bigger plan moving when the week changes.

Every step below is a flow the end-to-end tests run against the live app (`today-e2e`, `spare-e2e`, `e2e-browser`, `talk-e2e`, `upload-e2e`, `jobs-e2e`, `history-e2e`). Times in brackets are what those runs measured, so you know where to cut. Say only what's on screen.

## Before you record

1. Use a fresh Chrome or Edge profile (voice needs one of them). Sign in with a name and choose **Load a sample week**.
2. On Learn, there should be no Meta Muse warning inside **Learn something new**. A warning means the key is missing or Muse isn't answering.
3. Have ready a short PDF of study notes (one or two pages, e.g. AWS Lambda limits) and your resume as plain text.
4. Do one warm-up pass, then sign out and start fresh for the real take. The sample week is built from "now", so record within an hour of loading it.
5. If anything fails live, cut to the backup take. Don't narrate around an error.

## Script

### 0:00 to 0:15. The promise

**Screen:** the sign-in page. Let the card on the left cycle once: getting dressed, on the platform, on the bus.

> "I moved countries and I'm changing careers. I don't have free evenings, I have five minutes here and twenty there. Ropi turns that dead time into growth time."

### 0:15 to 0:40. Got a few minutes?

**Screen:** Today, the **Got a few minutes?** card at the top.

1. Pick **5 min**. Ropi shows one thing that fits, and why.
2. Pick **10 min** and **Audio only**. The list changes to things Ropi can say out loud: a voice quiz and a news brief, nothing that needs the screen.

3. Click **Hear my day**. Ropi reads tonight's plan out loud from **Your day**, the short list below.

> "I tell it how long I have and whether I can look at my phone. It picks what's worth it, from my own data. And on the move, it reads me my day."

### 0:40 to 1:10. It learns what I'm missing

**Screen:** Learn, the AWS Lambda quiz, then results.

1. Take **AWS Lambda Fundamentals** and miss the two cold-start questions on purpose.
2. On results, show the verdict, **What this quiz showed**, and the cards it added. [The lesson takes about 13 s; cut the wait.]
3. Back on Today, **Got a few minutes?** on 5 min now starts with **Review 3 cards**, and 10 min adds **Quiz: Cold starts**.

> "Now my five minutes go to the exact thing I got wrong, timed by spaced repetition so I review it right before I'd forget."

### 1:10 to 1:40. Hands busy: Talk

**Screen:** Talk. Use the mic.

1. Say: "Plan my day." Ropi reads the day, then asks what else to fit in. Say: "Read chapter 4 for 30 minutes by Friday." It lands in the week.
2. Say: "I'm getting dressed, I have five minutes." Ropi answers out loud with a plan: first it explains cold starts, the one you missed. [About 3 s]
3. Say "start". Ropi explains it in plain English and asks one question to check. Answer it out loud.
4. Optional if time allows: "A podcast on AWS under 15 minutes" picks an episode that fits, and plays it right there.

> "No typing, no looking. And every conversation is saved under its topic with the time."

### 1:40 to 2:05. When the week changes: LifeShift

**Screen:** LifeShift.

1. Click the example "Manager added shift, only 20min tonight". **Preview** shows what will move, then **Replan my week**. [Meta Muse reads it in about 1.5 s]
2. Blocks travel to their new slots. Point at **Parsed by Meta Muse** and the reason on each move.

> "Meta Muse reads the sentence. The scheduler, not the model, decides what moves, and says why."

### 2:05 to 2:25. My own notes, with proof

**Screen:** Learn, **Learn something new**, then **My notes**.

1. Drop the PDF, then **Quiz me on it (with quotes)**. [About 15 s; cut the wait.]
2. Answer one question and show the quoted line on results: **quote verified word for word**.

> "Every question has to quote my notes exactly, or Ropi throws it out."

### 2:25 to 2:45. Jobs, without pretending

**Screen:** Jobs.

1. **Find jobs**: "Product Manager", London. Results come from five job sites, each credited. Save one. [About 3 s]
2. **Score my fit** with your resume: the score and what's missing.

> "Ropi never applies for me. It finds roles, checks my fit and drafts answers. I apply, and I say so."

### 2:45 to 3:00. Growth, on the record

**Screen:** Today's **Last 7 days**, then History.

Point at **Growth time**, then History's day view: the quiz, the reviews, the replan and the talk, each with its time.

> "Ropi. Never stop growing, even when life gets busy."

## Q&A, honest answers

- **How does it pick what to do in 5 minutes?** A small set of rules, not a model: cards FSRS says are due first (about 20 s each), then the concept you score worst on, then a job closing in the next 3 days, then a short brief on your goal. Audio only drops anything that needs the screen. It never plans more minutes than you said.
- **Does it apply to jobs for me?** No. You apply on the company site. Ropi tracks it, and marks it as something you reported.
- **Where are Meta models used?** Reading your sentences (free time, LifeShift, Talk), writing quizzes, lessons and explanations, live news with web search grounding, document summaries, Ask Ropi answers and resume tailoring. All use `muse-spark-1.3` on the Meta Model API.
- **What isn't AI?** The scheduler, the spare-minutes picker, FSRS review timing and the resume score. Those need to be repeatable and explainable.
- **Is the voice from Meta?** No. Voice uses the browser's speech recognition and speech output. Muse handles the language work.
- **How do you stop made-up answers?** Document quiz quotes are checked word for word against your file. Ask Ropi citations are checked against the evidence it was given. News comes with the URLs Muse searched. Replan reasons come from scheduler data.
- **Where is my data?** Quizzes, cards, jobs, documents, topic folders, conversations and History are in Supabase behind row-level security (only your account can read your rows). Your week plan is stored in your browser.
- **Is it ready for real users?** It's a hackathon build. The Meta API key needs to move behind a server before launch, and there's no email login or cross-device sync yet.
- **Where do the job listings come from?** Job Seek, Remotive, Remote OK, Jobicy and Arbeitnow, each credited and linked. Job Seek's data is CC BY-NC 4.0, and descriptions belong to the employers.
