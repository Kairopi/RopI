import { Rating, State } from 'ts-fsrs';
import { getScheduler } from '@/lib/learning/spaced-repetition';

export default async function () {
  console.log('Rating enum:', JSON.stringify(Rating));
  console.log('State enum:', JSON.stringify(State));
  const s = await getScheduler();
  const now = new Date();
  const card = s.newCard({ now });
  const r = s.review({ card, grade: Rating.Good as any, now });
  console.log('review() keys:', Object.keys(r).join(', '));
  console.log('review().card:', JSON.stringify(r.card));
  console.log('review().revlog:', JSON.stringify(r.revlog));

  // Does review() accept a card that went through JSON (dates as strings)?
  const fromDb = JSON.parse(JSON.stringify(r.card));
  try {
    const r2 = s.review({ card: fromDb, grade: Rating.Good as any, now: new Date(now.getTime() + 11 * 60000) });
    console.log('review(JSON card) OK -> dueAt', r2.card.dueAt, typeof r2.card.dueAt);
  } catch (e) {
    console.log('review(JSON card) THROWS:', (e as Error).message);
  }
  const hydrated = { ...fromDb, dueAt: new Date(fromDb.dueAt), lastReviewAt: fromDb.lastReviewAt ? new Date(fromDb.lastReviewAt) : null };
  const r3 = s.review({ card: hydrated, grade: Rating.Good as any, now: new Date(now.getTime() + 11 * 60000) });
  console.log('review(hydrated card) OK -> dueAt', r3.card.dueAt.toISOString(), '| state', r3.card.state);

  const p = Array.from(s.preview({ card, now }) as any) as any[];
  console.log('preview() items:', p.length, '| grades:', p.map((x) => x.grade).join(','), '| item keys:', Object.keys(p[0]).join(','));
  console.log('model.forgettingCurve exists:', typeof (s as any).model?.forgettingCurve, '| chrono.difference:', typeof (s as any).chrono?.difference);
}
