// Live check (needs 20261104b_library.sql): folders and conversations save to the account, update,
// and stay private to their owner (row-level security).
import { supabase } from '/src/lib/supabase.ts';
import { saveTopic, listTopics, deleteTopic, saveConversation, listConversations, newConversation, storageMode, topicKey } from '/src/lib/library/store.ts';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(got)?.slice(0, 300)}`);
};

export default async function () {
  const a = await supabase.auth.signInAnonymously({ options: { data: { display_name: 'Library A' } } });
  if (a.error || !a.data.session) throw new Error('sign-in failed: ' + a.error?.message);
  const userA = a.data.session.user.id;

  // Folders
  const key = topicKey('Intro to project management');
  const folder = await saveTopic({ match_key: key, name: 'Intro to project management' });
  check('folder saved to the account (not the browser)', storageMode() === 'account' && /^[0-9a-f-]{36}$/.test(folder.id), { mode: storageMode(), id: folder.id });
  const renamed = await saveTopic({ match_key: key, name: 'Project management basics' });
  check('rename keeps the same folder', renamed.id === folder.id && renamed.name === 'Project management basics', renamed);
  const sub = await saveTopic({ match_key: topicKey('Stakeholder mapping'), parent_id: folder.id, name: 'Stakeholder mapping' });
  check('subtopic saved under it', sub.parent_id === folder.id, sub);
  const withLink = await saveTopic({
    match_key: key,
    links: [{ title: 'PMI news', url: 'https://www.pmi.org/', kind: 'article', added_at: new Date().toISOString(), added_by: 'ropi' }],
  });
  check('saved link stored', withLink.links.length === 1 && withLink.links[0].added_by === 'ropi', withLink.links);
  const topics = await listTopics();
  check('list returns folder + subtopic', topics.some((t) => t.id === folder.id) && topics.some((t) => t.id === sub.id), topics.map((t) => t.name));

  // Conversations: first save inserts (browser id -> database id), later saves update the same row
  let c = newConversation('voice');
  c = { ...c, title: 'What is a project charter?', topic_key: key, turns: [{ role: 'you', text: 'What is a project charter?', at: new Date().toISOString() }] };
  const first = await saveConversation(c);
  check('conversation inserted with a database id', /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(first.id), first.id);
  const second = await saveConversation({ ...first, turns: [...first.turns, { role: 'ropi', text: 'It is the document that authorises the project.', at: new Date().toISOString(), kind: 'explain:project charter' }] });
  check('next turn updates the same conversation', second.id === first.id && second.turns.length === 2, { id: second.id, turns: second.turns.length });
  const convos = await listConversations();
  check('conversation listed with both turns and times', convos.some((x) => x.id === first.id && x.turns.length === 2 && !!x.turns[1].at), convos.map((x) => [x.title, x.turns.length]));

  // Privacy: another user sees none of it
  await supabase.auth.signOut();
  const b = await supabase.auth.signInAnonymously({ options: { data: { display_name: 'Library B' } } });
  if (b.error || !b.data.session) throw new Error('second sign-in failed');
  const seenTopics = await supabase.from('topics').select('id').eq('user_id', userA);
  const seenConvos = await supabase.from('conversations').select('id').eq('user_id', userA);
  check("another user can't read your folders", (seenTopics.data ?? []).length === 0, seenTopics.data);
  check("another user can't read your conversations", (seenConvos.data ?? []).length === 0, seenConvos.data);
  const sneaky = await supabase.from('topics').insert({ user_id: userA, name: 'x', match_key: 'x' });
  check("another user can't write into your folders", !!sneaky.error, sneaky.error?.message);

  // Clean up as the owner is not possible from here (anonymous session gone); delete B's nothing.
  await deleteTopic('00000000-0000-0000-0000-000000000000').catch(() => undefined);

  console.log(`\n${pass}/${pass + fail} library checks pass`);
  if (fail) process.exitCode = 1;
}
