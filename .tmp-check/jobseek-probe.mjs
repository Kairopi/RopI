// Job Seek: real endpoints per the pinned MCP server (/api/v1/job?id=, /api/v1/resolve?type=locations)
const s = await (await fetch('https://jseek.co/api/v1/search?q=Product%20Manager&locale=en&wm=remote,hybrid')).json();
const id = s.companies[0].topPostings[0].id;
const d = await fetch(`https://jseek.co/api/v1/job?id=${id}&locale=en`);
const dj = await d.json().catch(() => null);
console.log('job', d.status, 'acao', d.headers.get('access-control-allow-origin'), 'keys', dj && Object.keys(dj));
console.log(JSON.stringify(dj)?.slice(0, 1200));
const r = await fetch('https://jseek.co/api/v1/resolve?type=locations&q=London&locale=en');
console.log('resolve', r.status, (await r.text()).slice(0, 400));
