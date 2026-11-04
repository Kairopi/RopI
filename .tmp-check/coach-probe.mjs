// Coach data sources: podcast search + latest episodes (playable audio), news, from a browser origin
const H = { headers: { Origin: 'http://localhost:5173' } };
const pod = await fetch('https://itunes.apple.com/search?term=product%20management&media=podcast&entity=podcast&limit=3', H);
const pj = await pod.json();
console.log('itunes search', pod.status, pod.headers.get('access-control-allow-origin'), pj.results.map((p) => `${p.collectionName} | ${p.artistName} | ${p.collectionId}`));
const id = pj.results[0].collectionId;
const ep = await fetch(`https://itunes.apple.com/lookup?id=${id}&media=podcast&entity=podcastEpisode&limit=3`, H);
const ej = await ep.json();
console.log('itunes episodes', ep.status, ep.headers.get('access-control-allow-origin'));
for (const e of ej.results.filter((r) => r.wrapperType === 'podcastEpisode')) console.log('  ', e.trackName, '|', e.releaseDate, '|', Math.round((e.trackTimeMillis ?? 0) / 60000), 'min |', String(e.episodeUrl).slice(0, 80));

const since = Math.floor(Date.now() / 1000) - 30 * 86400;
const hn = await fetch(`https://hn.algolia.com/api/v1/search?query=project%20management&tags=story&numericFilters=created_at_i>${since},points>5&hitsPerPage=5`, H);
const hj = await hn.json();
console.log('hn', hn.status, hn.headers.get('access-control-allow-origin'), hj.nbHits);
for (const h of hj.hits) console.log('  ', h.title, '|', h.points, 'pts |', h.created_at, '|', h.url);

const wiki = await fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=project%20scope&format=json&origin=*&srlimit=2', H);
const wj = await wiki.json();
console.log('wiki search', wiki.status, wiki.headers.get('access-control-allow-origin'), wj.query?.search?.map((s) => s.title));
