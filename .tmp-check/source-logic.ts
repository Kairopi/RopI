// Chunker + quote verification checks (no network)
import { chunkDocument, normalizeText } from '/src/lib/documents/sources.ts';
import { quoteIsInChunk } from '/src/lib/learning/source-quiz.ts';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, got?: unknown) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(got)}`);
};

export default async function () {
  const para = (n: number, word: string) => Array.from({ length: n }, (_, i) => `${word}${i}`).join(' ');
  const text = [para(120, 'alpha'), para(200, 'beta'), para(90, 'gamma'), para(400, 'delta')].join('\n\n');
  const chunks = chunkDocument(text);
  const words = chunks.map((c) => c.content.split(' ').length);
  console.log(`      ${chunks.length} chunks, words per chunk: ${words.join(', ')}`);
  check('no chunk over 345 words (300 + overlap)', words.every((w) => w <= 345), words);
  check('chunks overlap (last words repeat at next start)', chunks.length > 1 && chunks[1].content.startsWith(chunks[0].content.split(' ').slice(-45).join(' ')));
  check('every source word is in some chunk', text.split(/\s+/).every((w) => chunks.some((c) => c.content.includes(w))));
  check('indexes are sequential', chunks.every((c, i) => c.chunk_index === i));

  const paged = chunkDocument('', ['Lambda functions time out after 900 seconds at most.\n\nCold starts happen when a new environment is created.', 'Provisioned concurrency keeps environments initialised ahead of time so requests avoid cold starts.']);
  check('tiny doc kept whole, pages recorded', paged.length >= 1 && paged[0].page === 1, paged);

  const chunk = 'A cold start happens when Lambda must create a new execution environment:\ndownload the code, start the runtime and run your init code.';
  check('exact quote across a line break', quoteIsInChunk('create a new execution environment: download the code', chunk));
  check('curly quotes and case normalised', quoteIsInChunk('A Cold Start happens when Lambda must create', chunk));
  check('paraphrase is rejected', !quoteIsInChunk('Lambda builds a fresh environment for the function', chunk));
  check('too-short quote rejected (under 4 words)', !quoteIsInChunk('cold start', chunk));
  check('invented detail rejected', !quoteIsInChunk('a new execution environment in under 50 ms', chunk));
  check('normalizeText collapses whitespace', normalizeText('a\n\n b\t c') === 'a b c');

  console.log(`\n${pass}/${pass + fail} source checks pass`);
  if (fail) process.exitCode = 1;
}
