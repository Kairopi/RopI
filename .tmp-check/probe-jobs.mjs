import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
for (const col of ['deadline','interview_date','job_url','ats_score','status']) {
  const r = await fetch(`${url}/rest/v1/job_applications?select=${col}&limit=0`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  console.log(col.padEnd(16), r.status, r.ok ? 'exists' : (await r.text()).slice(0,120));
}
