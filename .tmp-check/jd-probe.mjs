// Job Seek keeps each description at {R2}/job/{id}/{locale}/latest.html (apps/web/src/lib/services/search.ts).
// Try the public assets host used for company icons, from a browser-like origin.
const s = await (await fetch('https://jseek.co/api/v1/search?q=Product%20Manager&locale=en&loc=london-england-united-kingdom')).json();
const ids = s.companies.flatMap((c) => c.topPostings.slice(0, 2).map((p) => ({ id: p.id, title: p.title, company: c.name })));
let ok = 0;
for (const { id, title, company } of ids.slice(0, 6)) {
  for (const loc of ['en']) {
    const url = `https://jobseek-assets.colophon-group.org/job/${id}/${loc}/latest.html`;
    const r = await fetch(url, { headers: { Origin: 'http://localhost:5173' } });
    const html = r.ok ? await r.text() : '';
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (r.ok) ok++;
    console.log(r.status, 'acao', r.headers.get('access-control-allow-origin'), `${company}: ${title}`, '|', text.slice(0, 160));
  }
}
console.log(`${ok}/${Math.min(6, ids.length)} descriptions readable`);
