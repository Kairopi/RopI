import { supabase } from '@/lib/supabase';
import { createConceptCard, saveCardToDatabase } from '@/lib/learning/spaced-repetition';

export default async function () {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return console.log('sign-in failed', error.message);
  const card = await createConceptCard('AWS Lambda', 'Q?', 'A');
  card.subtopic = 'Lambda cold starts';
  try {
    const saved = await saveCardToDatabase(card, data.user!.id);
    console.log('saved card', saved.id);
  } catch (e: any) {
    console.log('SAVE FAILED:', e?.code, e?.message, e?.details ?? '', e?.hint ?? '');
  }
  const cols = await supabase.from('concept_cards').select('*').limit(1);
  console.log('select * ->', cols.error ? cols.error.message : 'ok', cols.data?.[0] ? Object.keys(cols.data[0]).join(',') : '(no rows)');
  await supabase.auth.signOut();
}
