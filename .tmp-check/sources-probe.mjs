// Which free, no-key sources can a browser call directly (CORS), and what do they return?
const ORIGIN = 'http://localhost:5173';
const probes = {
  // Jobs
  remotive: 'https://remotive.com/api/remote-jobs?search=product%20manager&limit=5',
  arbeitnow: 'https://www.arbeitnow.com/api/job-board-api',
  remoteok: 'https://remoteok.com/api?tag=product',
  themuse: 'https://www.themuse.com/api/public/jobs?page=0&category=Product%20Management',
  jobicy: 'https://jobicy.com/api/v2/remote-jobs?count=5&tag=product',
  himalayas: 'https://himalayas.app/jobs/api?limit=5',
  greenhouse: 'https://boards-api.greenhouse.io/v1/boards/monzo/jobs',
  lever: 'https://api.lever.co/v0/postings/spotify?mode=json&limit=5',
  ashby: 'https://api.ashbyhq.com/posting-api/job-board/ramp',
  // News
  hn: 'https://hn.algolia.com/api/v1/search_by_date?query=aws%20lambda&tags=story&hitsPerPage=5',
  gdelt: 'https://api.gdeltproject.org/api/v2/doc/doc?query=%22project%20management%22&mode=artlist&maxrecords=5&format=json&sort=datedesc',
  wikipedia: 'https://en.wikipedia.org/api/rest_v1/page/summary/Project_management',
  // Podcasts
  itunes: 'https://itunes.apple.com/search?term=project%20management&media=podcast&limit=5',
};

for (const [name, url] of Object.entries(probes)) {
  try {
    const t = Date.now();
    const r = await fetch(url, { headers: { Origin: ORIGIN, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    const acao = r.headers.get('access-control-allow-origin');
    const text = await r.text();
    let shape = '';
    try {
      const j = JSON.parse(text);
      const arr = Array.isArray(j) ? j : j.jobs ?? j.data ?? j.results ?? j.hits ?? j.articles ?? j.jobPostings ?? null;
      shape = Array.isArray(arr) ? `array(${arr.length}) keys=${Object.keys(arr[Array.isArray(j) && name === 'remoteok' ? 1 : 0] ?? {}).slice(0, 14).join(',')}` : `keys=${Object.keys(j).slice(0, 12).join(',')}`;
    } catch {
      shape = `not json: ${text.slice(0, 80).replace(/\s+/g, ' ')}`;
    }
    console.log(`${name.padEnd(10)} ${r.status} cors=${acao ?? '-'} ${Date.now() - t}ms ${shape}`);
  } catch (e) {
    console.log(`${name.padEnd(10)} ERROR ${e.message}`);
  }
}
