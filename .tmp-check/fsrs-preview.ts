// Verify FSRS preview intervals and retrievability with the installed ts-fsrs
import { createConceptCard, previewRatings, reviewCard, calculateRetrievability, formatInterval, Rating, type ConceptCard } from '/src/lib/learning/spaced-repetition.ts';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(got)}`);
};

export default async function () {
  const now = new Date();
  const draft = await createConceptCard('Lambda timeouts', 'Max Lambda timeout?', '900 seconds');
  const card = { ...draft, id: 'c1', userId: 'u', createdAt: now } as ConceptCard;

  const p = await previewRatings(card, now);
  const labels = (['again', 'hard', 'good', 'easy'] as const).map((k) => formatInterval(p[k].nextReview, now));
  console.log(`      new card:   Again ${labels[0]} · Hard ${labels[1]} · Good ${labels[2]} · Easy ${labels[3]}`);
  const due = (['again', 'hard', 'good', 'easy'] as const).map((k) => p[k].nextReview.getTime());
  check('intervals increase Again <= Hard <= Good <= Easy', due[0] <= due[1] && due[1] <= due[2] && due[2] <= due[3], labels);
  check('Again on a new card is minutes, not days', labels[0].endsWith('m'), labels[0]);

  // Review "Good" twice to graduate, then look 3 days later
  const r1 = await reviewCard(card, Rating.Good, now);
  const c1 = { ...card, ...r1.updatedCard } as ConceptCard;
  const later = new Date(now.getTime() + 10 * 60000);
  const r2 = await reviewCard(c1, Rating.Good, later);
  const c2 = { ...c1, ...r2.updatedCard } as ConceptCard;
  const p2 = await previewRatings(c2, new Date(later.getTime() + 86400000));
  console.log(`      after 2 Goods: due in ${formatInterval(r2.nextReviewDate, later)}; next preview: ${(['again', 'hard', 'good', 'easy'] as const).map((k) => `${k} ${formatInterval(p2[k].nextReview, new Date(later.getTime() + 86400000))}`).join(' · ')}`);

  const rNow = await calculateRetrievability(c2, later);
  const r3d = await calculateRetrievability(c2, new Date(later.getTime() + 3 * 86400000));
  const r30d = await calculateRetrievability(c2, new Date(later.getTime() + 30 * 86400000));
  console.log(`      memory strength: just reviewed ${rNow}% · in 3 days ${r3d}% · in 30 days ${r30d}%`);
  check('just after review ~100%', rNow >= 95, rNow);
  check('memory decays over time (not stuck at 100%)', r30d < r3d && r3d <= rNow, { rNow, r3d, r30d });
  check('new card reports 0 (no memory yet)', (await calculateRetrievability(card, now)) === 0);

  check('formatInterval', formatInterval(new Date(now.getTime() + 90 * 60000), now) === '2h' && formatInterval(new Date(now.getTime() + 4 * 86400000), now) === '4d');

  console.log(`\n${pass}/${pass + fail} FSRS checks pass`);
  if (fail) process.exitCode = 1;
}
