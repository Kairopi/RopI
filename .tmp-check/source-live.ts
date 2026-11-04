// Live check (needs the 20261104 migration): receipts + sources + a document quiz with verified quotes
import { supabase } from '/src/lib/supabase.ts';
import { recordReceipt, listReceipts } from '/src/lib/receipts.ts';
import { saveSource, listSources, pickChunks } from '/src/lib/documents/sources.ts';
import { generateSourceQuiz, quoteIsInChunk } from '/src/lib/learning/source-quiz.ts';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(got)?.slice(0, 300)}`);
};

const NOTES = `AWS Lambda limits and behaviour

The maximum timeout for a single Lambda invocation is 900 seconds, which is 15 minutes. Jobs that need longer should use Step Functions, ECS or AWS Batch.

Memory can be set from 128 MB to 10,240 MB. Lambda allocates CPU power in proportion to the memory you configure, so raising memory also makes a function faster.

A cold start happens when Lambda has to create a new execution environment: it downloads your code, starts the runtime and runs your initialisation code before handling the request.

Provisioned concurrency keeps a number of execution environments initialised ahead of time, so requests routed to them do not suffer cold starts. Reserved concurrency only caps or guarantees capacity and does not pre-warm anything.

Standard Lambda pricing has two parts: a charge per request and a charge for duration, measured in GB-seconds. A function with 1 GB of memory that runs for 2 seconds uses 2 GB-seconds.

Lambda layers let you package libraries and other dependencies separately from your function code and share them across functions. A function can use up to five layers.`;

export default async function () {
  const { data, error } = await supabase.auth.signInAnonymously({ options: { data: { display_name: 'Source test' } } });
  if (error || !data.session) throw new Error('Anonymous sign-in failed: ' + error?.message);
  console.log('      signed in as', data.session.user.id);

  // Receipts: insert + read back, and append-only (update must not change it)
  const ok = await recordReceipt({ domain: 'study', kind: 'study.test', actor: 'user', verification: 'system_recorded', title: 'Test receipt', evidence: { n: 1 } });
  check('receipt inserted', ok);
  const { receipts, available } = await listReceipts(5);
  check('receipts table available and readable', available && receipts.some((r) => r.kind === 'study.test'), { available, n: receipts.length });
  if (receipts[0]) {
    await supabase.from('receipts').update({ title: 'tampered' }).eq('id', receipts[0].id);
    const again = await supabase.from('receipts').select('title').eq('id', receipts[0].id).single();
    check('receipts are append-only (update has no effect)', again.data?.title !== 'tampered', again.data);
  }

  // Sources: save, dedupe, chunks, search
  const saved = await saveSource({ title: 'Lambda notes', topic: 'AWS Lambda', fileType: 'text', text: NOTES });
  check('source saved with chunks', saved.chunks >= 1, saved);
  const dup = await saveSource({ title: 'Lambda notes again', topic: 'AWS Lambda', fileType: 'text', text: NOTES });
  check('same text is not saved twice', dup.existing && dup.source.id === saved.source.id, dup);
  const list = await listSources();
  check('listSources shows it', list.available && list.sources.some((s) => s.id === saved.source.id));
  const stored = list.sources.find((s) => s.id === saved.source.id);
  console.log(`      auto-tag: "${stored?.summary}" ${JSON.stringify(stored?.tags)}`);
  check('Muse summary and tags are saved in the database', !!stored?.summary && (stored?.tags?.length ?? 0) >= 2, { summary: stored?.summary, tags: stored?.tags });
  const hits = await pickChunks(saved.source.id, 'cold start provisioned concurrency', 3);
  check('full-text search finds the cold start passage', hits.some((h) => /provisioned concurrency/i.test(h.content)), hits.map((h) => h.content.slice(0, 60)));

  // Document quiz via Meta Muse: every kept question must quote its passage verbatim
  const t0 = Date.now();
  const quiz = await generateSourceQuiz(saved.source.id);
  console.log(`      quiz in ${Date.now() - t0} ms: kept ${quiz.stats.kept}/${quiz.stats.asked}, dropped ${quiz.stats.droppedUnverified} unverified`);
  check('quiz has at least 3 verified questions', quiz.questions.length >= 3, quiz.stats);
  const { data: chunks } = await supabase.from('source_chunks').select('id, content').eq('source_id', saved.source.id);
  const byId = new Map((chunks ?? []).map((c: any) => [c.id, c.content]));
  check(
    'every question quote is really in its cited passage',
    quiz.questions.every((q) => q.source && quoteIsInChunk(q.source.quote, byId.get(q.source.chunkId) ?? '')),
    quiz.questions.map((q) => q.source?.quote)
  );
  quiz.questions.slice(0, 3).forEach((q) => console.log(`      Q: ${q.question}\n         "${q.source?.quote}"`));

  // Focused practice on a weak spot uses full-text search
  const focused = await generateSourceQuiz(saved.source.id, 'cold starts');
  check('focused document quiz works', focused.questions.length >= 3, focused.stats);

  console.log(`\n${pass}/${pass + fail} live source checks pass`);
  if (fail) process.exitCode = 1;
}
