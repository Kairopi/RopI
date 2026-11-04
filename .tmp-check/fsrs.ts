import { createConceptCard, reviewCard, previewRatings, calculateRetrievability, hydrateFsrsCard, Rating } from '@/lib/learning/spaced-repetition';

export default async function () {
  const card = await createConceptCard('AWS Lambda', 'What causes cold starts?', 'Initializing the execution environment');
  console.log('new card due:', card.nextReviewDue?.toISOString(), '| state', card.fsrsCard.state);

  const full = { ...card, id: 'x', userId: 'u', createdAt: new Date() } as any;
  const p = await previewRatings(full);
  console.log('preview  again:', p.again.interval, '| hard:', p.hard.interval, '| good:', p.good.interval, '| easy:', p.easy.interval);

  const r1 = await reviewCard(full, Rating.Good);
  console.log('review Good -> next', r1.nextReviewDate.toISOString(), '| interval days', r1.intervalDays, '| state', r1.state);

  // Simulate a database round trip (JSONB turns Dates into strings)
  const fromDb = { ...full, fsrsCard: hydrateFsrsCard(JSON.parse(JSON.stringify(r1.updatedCard.fsrsCard))), lastReviewedAt: new Date() };
  const later = new Date(r1.nextReviewDate.getTime() + 60_000);
  const r2 = await reviewCard(fromDb, Rating.Again, later);
  console.log('review Again after DB round trip -> next', r2.nextReviewDate.toISOString(), '| state', r2.state, '(3 = relearning)');
  console.log('retrievability now:', await calculateRetrievability(fromDb), '%');
}
