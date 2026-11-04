// ATS scorer: keywords come from the job's own text, matched as whole words, and a weak resume scores lower
import { calculateATSScore } from '/src/lib/jobs/ats-scorer.ts';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(got)?.slice(0, 400)}`);
};

const JOB = {
  title: 'Product Manager',
  company: 'Pay Co',
  description: `We are hiring a Product Manager to own our mobile payments experience.
You will set the roadmap, run discovery and user research, write clear requirements, and work with engineering and design in an agile team.
Requirements: 3+ years product management, experience with A/B testing and experimentation, SQL for analysis, strong stakeholder management, fintech or payments experience preferred.`,
};

const GOOD = `Alex Kim
Product Manager
EXPERIENCE
Senior Product Manager, Fintech Co (2021 - 2026)
- Led mobile payments features to 2M users, owned the roadmap
- Ran A/B tests, experimentation and user research; discovery with design and engineering in an agile team
- Wrote product requirements; SQL analysis; stakeholder management
Product Analyst, Retail Ltd (2018 - 2021)
EDUCATION
BSc Economics (2018)
SKILLS
Product management, A/B testing, SQL, agile`;

const WEAK = `Sam Lee
Barista
EXPERIENCE
Barista, Coffee House (2015 - 2017)
Shift lead, Cafe Two (2020 - 2026)
- Made good coffee, trained new staff
EDUCATION
High school (2014)`;

export default async function () {
  const good = calculateATSScore({ content: GOOD }, JOB);
  const weak = calculateATSScore({ content: WEAK }, JOB);
  console.log('      good', good.overall_score, good.sub_scores, 'missing', good.evidence.missing_keywords);
  console.log('      weak', weak.overall_score, weak.sub_scores, 'matched', weak.evidence.matched_keywords);

  check('job terms come from the description (not only a tech list)', good.evidence.matched_keywords.length + good.evidence.missing_keywords.length >= 8, good.evidence);
  check('payments, roadmap, user research, sql are recognised', ['payments', 'roadmap', 'user research', 'sql'].every((t) => [...good.evidence.matched_keywords, ...good.evidence.missing_keywords].includes(t)), good.evidence);
  check('a matching resume matches most terms', good.sub_scores.keyword_match >= 70, good.sub_scores);
  check('a barista resume matches few terms', weak.sub_scores.keyword_match <= 25, weak.sub_scores);
  check('weak resume scores clearly lower overall', good.overall_score - weak.overall_score >= 30, { good: good.overall_score, weak: weak.overall_score });
  check('"go" is not matched inside "good"', !weak.evidence.matched_keywords.includes('go'), weak.evidence.matched_keywords);
  check('no gap in 2018-2021-2026 timeline', good.sub_scores.date_consistency === 100, good.sub_scores);
  check('2017 -> 2020 gap is found', weak.sub_scores.date_consistency < 100, weak.sub_scores);
  check('no description gives a neutral, not a fake high, keyword score', calculateATSScore({ content: GOOD }, { ...JOB, description: '' }).sub_scores.keyword_match === 50);
  const terms = [...good.evidence.matched_keywords, ...good.evidence.missing_keywords];
  check('no phrases glued across commas', !terms.some((t) => ['experimentation sql', 'management fintech', 'testing sql'].includes(t)), terms);
  check('resume saying "Product Manager" fully matches the title', good.sub_scores.title_match === 100, good.sub_scores);
  check(
    '"Senior Product Manager - Spotify Connect" still matches a Product Manager resume',
    calculateATSScore({ content: GOOD }, { ...JOB, title: 'Senior Product Manager - Spotify Connect' }).sub_scores.title_match >= 75
  );
  check('barista title does not match', weak.sub_scores.title_match < 60, weak.sub_scores);

  console.log(`\n${pass}/${pass + fail} ATS checks pass`);
  if (fail) process.exitCode = 1;
}
