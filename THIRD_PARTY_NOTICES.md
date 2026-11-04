# Third-party notices

Ropi includes code adapted from, or follows designs of, the open-source projects below. For each one this file gives the exact commit studied (see `docs/UPSTREAM_AUDIT.md`) and its licence notice.

## smart-agentic-calendar (code adapted)
https://github.com/fbdo/smart-agentic-calendar @ 6088e957e17eda94fd362f8e420510827b5ed858

Adapted into `src/lib/scheduling/` (`scheduler.ts`, `availability.ts`, `scoring.ts`, `plan.ts`):
- slot scoring weights
- availability map
- trailing-block rule
- conflict suggestions (`suggestDeprioritizations`)

Changes made in Ropi:
- local time instead of UTC
- deadlines enforced during placement
- stable (incremental) replanning
- a transitive ordering key
- reasons generated from engine data

```
MIT License

Copyright (c) 2024-2026 Fabio Oliveira

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## ts-fsrs (npm dependency)
https://github.com/open-spaced-repetition/ts-fsrs — `ts-fsrs@6.0.0`. MIT, Copyright (c) 2026 Open Spaced Repetition. Used unmodified; the licence ships with the package.

## OpenMuse (design pattern)
https://github.com/CopilotKit/openmuse @ a4944f4c471d3dc93b8bfc060b5da309b5216ab2. MIT, Copyright (c) 2026 OpenMuse contributors.

Followed its append-only activity and receipt model, honest outcome states and activity timeline layout, in `src/lib/receipts.ts` and `src/pages/Activity.tsx`. No source files were copied.

## Open Notebook (design pattern)
https://github.com/lfnovo/open-notebook @ 5e285b7a2e435895c4ee99ad7e4b8d2af64c3239. MIT, Copyright (c) 2024 Luis Novo.

Followed its source → overlapping chunks → search → cite pattern, in `src/lib/documents/sources.ts` and `src/lib/learning/source-quiz.ts`. No source files were copied.

## Super Productivity (syntax design)
https://github.com/super-productivity/super-productivity @ 460c2ea1acd2155c3f835edf4ffb634cfc4f49d7. MIT.

Followed its short-syntax grammar for quick-add (`30m`, `@fri`, `#tag`), in `src/lib/week/quick-add.ts`. Ropi's version is a separate, smaller implementation.

## Resume Matcher (planned)
https://github.com/srbhr/Resume-Matcher @ d480551798b7aa97f5b57ba1972ee383bd882238. Apache License 2.0.

Its verified-tailoring patterns are planned (see the audit). If they are ported, the Apache-2.0 licence text will be added here and each modified file will say so.

## Job Seek (public API and job data)
https://github.com/colophon-group/jobseek @ 2828c7c8fb58489c8a1e74803c816f8db4b260c7. Code: MIT, Copyright (c) 2025 Viktor Shcherbakov.

Ropi calls the public API at https://jseek.co (`/api/v1/search`, `/api/v1/resolve`) and reads each posting's published description (`{assets}/job/{id}/{locale}/latest.html`, the `descriptionUrl` built in `apps/web/src/lib/services/search.ts`), in `src/lib/jobs/jobseek-client.ts`. Endpoint shapes were taken from the repo's MCP server (`packages/mcp-server/src/tools`). No source files were copied.

Job data attribution, as the repo's `LICENSE-JOB-DATA` asks: Viktor Shcherbakov, "Collection of Job Postings," (c) 2025, CC BY-NC 4.0, https://creativecommons.org/licenses/by-nc/4.0/. That licence is non-commercial. Job descriptions, logos and other employer content are not covered by it and remain the employers'. Ropi keeps a copy of a description only for the user who saved that job, so they can score their resume against it.
