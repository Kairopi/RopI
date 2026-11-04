// Exact fields and search behaviour per source, for "product manager"
const get = async (u) => (await fetch(u, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })).json();
const show = (name, list, pick) => {
  console.log(`\n== ${name}: ${list.length}`);
  for (const j of list.slice(0, 3)) console.log('  ', JSON.stringify(pick(j)).slice(0, 300));
};

const remotive = await get('https://remotive.com/api/remote-jobs?search=product%20manager&limit=20');
show('remotive', remotive.jobs, (j) => ({ id: j.id, title: j.title, company: j.company_name, loc: j.candidate_required_location, date: j.publication_date, url: j.url, salary: j.salary, desc: j.description?.length }));

const ok = await get('https://remoteok.com/api');
console.log('remoteok[0] keys', Object.keys(ok[0]), String(ok[0].legal ?? '').slice(0, 160));
const okJobs = ok.slice(1).filter((j) => /product manager/i.test(j.position));
show('remoteok (filtered of ' + (ok.length - 1) + ')', okJobs, (j) => ({ id: j.id, title: j.position, company: j.company, loc: j.location, date: j.date, url: j.url, apply: j.apply_url, desc: j.description?.length }));

const jobicy = await get('https://jobicy.com/api/v2/remote-jobs?count=20&tag=product%20manager');
show('jobicy', jobicy.jobs ?? [], (j) => ({ id: j.id, title: j.jobTitle, company: j.companyName, geo: j.jobGeo, date: j.pubDate, url: j.url, desc: j.jobDescription?.length }));

const arbeit = await get('https://www.arbeitnow.com/api/job-board-api');
const aJobs = arbeit.data.filter((j) => /product manager/i.test(j.title));
show('arbeitnow (filtered of ' + arbeit.data.length + ', links: ' + JSON.stringify(arbeit.links ?? {}).slice(0, 120) + ')', aJobs, (j) => ({ slug: j.slug, title: j.title, company: j.company_name, loc: j.location, remote: j.remote, date: j.created_at, url: j.url, desc: j.description?.length }));

const muse = await get('https://www.themuse.com/api/public/jobs?page=0&category=Product%20Management&descending=true');
show('themuse (page_count ' + muse.page_count + ')', muse.results ?? [], (j) => ({ id: j.id, title: j.name, company: j.company?.name, locs: j.locations?.map((l) => l.name), date: j.publication_date, url: j.refs?.landing_page, desc: j.contents?.length }));
