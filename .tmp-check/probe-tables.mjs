import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
for (const t of ['replan_log','activity_log','agent_intentions','verified_actions','action_history','receipts','sources','source_chunks','quiz_attempts','review_sessions','concept_cards','topics','conversations']) {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${t}?select=*&limit=0`, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` } });
  console.log(t.padEnd(18), r.status, r.ok ? 'exists' : (await r.text()).slice(0,90));
}
