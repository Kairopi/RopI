// Meta search grounding (Responses API + web_search): does it work with our key, and from a browser origin?
import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const KEY = env.VITE_MUSE_API_KEY;
const BASE = env.VITE_META_API_BASE_URL || 'https://api.meta.ai/v1';

const pre = await fetch(`${BASE}/responses`, {
  method: 'OPTIONS',
  headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
});
console.log('preflight', pre.status, 'allow-origin', pre.headers.get('access-control-allow-origin'), 'allow-headers', pre.headers.get('access-control-allow-headers'));

const t = Date.now();
const r = await fetch(`${BASE}/responses`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({
    model: 'muse-spark-1.3',
    input: 'What is the latest news this week about project management certifications (PMP, CAPM)? Two short sentences, cite sources.',
    tools: [{ type: 'web_search', search_context_size: 'low' }],
    reasoning: { effort: 'low' },
  }),
});
const j = await r.json();
console.log('status', r.status, 'acao', r.headers.get('access-control-allow-origin'), `${Date.now() - t}ms`);
if (!r.ok) console.log(JSON.stringify(j).slice(0, 500));
for (const item of j.output ?? []) {
  if (item.type === 'web_search_call') console.log('  search:', item.status);
  if (item.type === 'message')
    for (const b of item.content ?? []) {
      if (b.type === 'output_text') {
        console.log('  text:', b.text.slice(0, 400));
        for (const a of b.annotations ?? []) if (a.type === 'url_citation') console.log('   cite:', a.title?.slice(0, 70), '|', a.url);
      }
    }
}
