# Ropi demo script (3 minutes)

Every step below is a flow the end-to-end tests run against the live app. The times in brackets are what those runs measured, so you know where to cut in the edit. Say only what's on screen.

## Before you record

1. Open the app in a fresh browser profile (Chrome or Edge, so voice works). Sign in with a name, choose **Load a sample week**.
2. On Learn, check the badge says **Meta Muse connected**.
3. Have ready:
   - a short PDF of study notes (one or two pages, e.g. AWS Lambda limits)
   - your resume as plain text
4. Do one warm-up pass of the whole script, then sign out and start fresh for the real take. The sample week is built from "now", so record within an hour of loading it.
5. If anything fails live, cut to the backup take. Don't narrate around an error.

## Script

### 0:00 to 0:15. The problem
**Screen:** Today.

> "Studying for a certification and job hunting both need time, and the week never goes to plan. Ropi plans both into the free time you actually have, and replans when life changes."

### 0:15 to 0:45. The week, with real dates
**Screen:** Today, then the This week calendar.

1. Point at **Up next**: the next block, its time, and why it's planned.
2. In the calendar, click empty time tomorrow evening. Choose **Busy time**, type "Shift at work", 7:00 to 8:00 PM, then **Block this time**.

> "I just picked up a shift. Ropi keeps that hour clear and finds new time for what was there."

3. Click a block to show its date, time, due date and **Start**.

### 0:45 to 1:15. LifeShift
**Screen:** LifeShift.

1. Click the example "Manager added shift, only 20min tonight", then **Replan my week**. [Meta Muse reads it in about 1.5 s; the whole step takes about 6 s.]
2. Blocks travel to their new slots. Point at the badge **Parsed by Meta Muse**, then at **what I did and why**.
3. If something doesn't fit, point at the fix buttons ("Do 135 min instead").

> "Meta Muse turns the sentence into a constraint. The scheduler, not the model, decides what moves, and every move comes with the reason."

### 1:15 to 1:50. The learning loop
**Screen:** Learn, then the quiz, then results.

1. **AWS Lambda Fundamentals**: answer, and miss the two cold-start questions on purpose.
2. On the results page, show the skill update, the **Weak spots** card, **3 cards added**, and the Meta Muse lesson. [The lesson takes about 13 s; cut the wait.]
3. Go back to Today. Under **Added by Ropi**, show **Practice: Lambda cold starts**, already scheduled.

> "What I got wrong is now in my week, with review cards timed by FSRS."

### 1:50 to 2:10. Your own notes, with proof
**Screen:** Learn, Make your own, From a document.

1. Drop the PDF. It shows a Muse summary and tags.
2. **Quiz me on it (with quotes)**. [About 15 s; cut the wait.] Answer one question, finish, and show the quoted line on results: **quote verified word for word**.

> "Every question has to quote my notes exactly, or Ropi throws it out."

### 2:10 to 2:25. Ask Ropi
**Screen:** any page.

1. Press Ctrl+K and choose **What have I been getting wrong?** [about 6 s]
2. Point at the citation chips, e.g. [H1] and [Q1].

> "It answers only from my own history, and every claim points to the record."

### 2:25 to 2:50. Jobs, without pretending
**Screen:** Jobs.

1. In **Find jobs**, search "Product Manager", London. Save one result. [About 3 s; its full description comes with it.]
2. Paste your resume, then **Score my fit**: the score, plus what's missing from your resume.
3. **Tailor resume** [15 to 25 s; cut the wait], then **Approve**, then **I applied** with a confirmation number.

> "Ropi never applies for me. I apply, I say so, and it's recorded as something I reported."

### 2:50 to 3:00. History
**Screen:** History.

Show today's date heading, with the quiz, the reviews, the replan and the application, each marked **Recorded by Ropi** or **You reported**.

> "Ropi: your week, replanned around real life, with a record of what actually happened."

## Q&A, honest answers

- **Does it apply to jobs for me?** No. You apply on the company site. Ropi tracks it, and marks it as something you reported.
- **Where are Meta models used?** Reading your sentences (free time, LifeShift), writing quizzes and lessons, document summaries, Ask Ropi answers, resume tailoring and interview practice. All use `muse-spark-1.3` on the Meta Model API.
- **What isn't AI?** The scheduler, FSRS review timing and the resume score. Those need to be repeatable and explainable.
- **Is the voice from Meta?** No. Voice uses the browser's speech recognition and speech output. Muse handles the language work.
- **How do you stop made-up answers?** Document quiz quotes are checked word for word against your file. Ask Ropi citations are checked against the evidence it was given. Replan reasons come from scheduler data.
- **Where is my data?** Quizzes, cards, jobs, documents and History are in Supabase, behind row-level security (only your account can read your rows). Your week plan is stored in your browser.
- **Is it ready for real users?** It's a hackathon build. The Meta API key needs to move behind a server before launch, and there's no email login or cross-device sync yet.
- **Where do the job listings come from?** Job Seek, which collects them from company career pages. Its job data is CC BY-NC 4.0, and descriptions belong to the employers.
