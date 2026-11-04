// News for any topic, from the browser: GDELT (all news, 1 request / 5 s) vs Hacker News (tech)
const H = { headers: { Origin: 'http://localhost:5173' } };
const g = await fetch('https://api.gdeltproject.org/api/v2/doc/doc?query=%22project%20management%22%20sourcelang:english&mode=artlist&maxrecords=5&format=json&sort=datedesc&timespan=14d', H);
console.log('gdelt', g.status, 'cors', g.headers.get('access-control-allow-origin'));
const gt = await g.text();
try {
  const gj = JSON.parse(gt);
  for (const a of gj.articles ?? []) console.log('  ', a.seendate, '|', a.domain, '|', a.title.slice(0, 90));
} catch {
  console.log('  ', gt.slice(0, 160));
}
const since = Math.floor(Date.now() / 1000) - 60 * 86400;
const hn = await fetch(`https://hn.algolia.com/api/v1/search?query=aws%20lambda&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=3`, H);
const hj = await hn.json();
console.log('hn aws lambda (60d)', hj.nbHits, hj.hits.map((h) => h.title));
