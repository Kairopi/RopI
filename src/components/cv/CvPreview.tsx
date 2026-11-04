/**
 * Live preview of the CV, laid out like the PDF (A4, 794 px wide at 96 dpi),
 * scaled to fit its column.
 */
import { useEffect, useRef, useState } from 'react';
import type { CV, CvTemplate } from '@/lib/cv/cv';

const dates = (a: string, b: string) => [a, b].filter(Boolean).join(' – ');
const bare = (l: string) => l.replace(/^https?:\/\/(www\.)?/, '');

export function CvPreview({ cv, template, accent }: { cv: CV; template: CvTemplate; accent: string }) {
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(1123);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / 794)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (page.current) setHeight(Math.max(1123, page.current.scrollHeight));
  });

  const modern = template === 'modern';
  const h = (t: string) => (
    <h3
      className="mb-1.5 pb-0.5 text-[12.5px] font-bold uppercase tracking-[0.1em]"
      style={{ color: modern || template === 'sidebar' ? accent : '#111', borderBottom: template === 'classic' ? '1px solid #222' : modern ? `1.6px solid ${accent}` : 'none' }}
    >
      {t}
    </h3>
  );
  const exp = cv.experience.filter((e) => e.role || e.company);
  const edu = cv.education.filter((e) => e.school || e.degree);
  const proj = cv.projects.filter((p) => p.name);
  const contact = [cv.email, cv.phone, cv.location].filter(Boolean);

  const Experience = exp.length > 0 && (
    <section className="mt-4">
      {h('Experience')}
      {exp.map((e, i) => (
        <div key={i} className="mb-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <span className="font-bold">{e.role}</span>
              <span className="text-[#333]">{[e.role && e.company ? ', ' : '', e.company, e.location ? `, ${e.location}` : ''].join('')}</span>
            </div>
            <span className="shrink-0 text-[12px] text-[#666]">{dates(e.start, e.end)}</span>
          </div>
          <ul className="mt-0.5 space-y-0.5">
            {e.bullets.filter(Boolean).map((b, j) => (
              <li key={j} className="flex gap-2">
                <span style={{ color: modern ? accent : '#333' }}>•</span>
                <span className="flex-1">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
  const Education = edu.length > 0 && (
    <section className="mt-4">
      {h('Education')}
      {edu.map((e, i) => (
        <div key={i} className="mb-2">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <span className="font-bold">{e.degree || e.school}</span>
              {e.degree && e.school && <span className="text-[#333]">, {e.school}</span>}
            </div>
            <span className="shrink-0 text-[12px] text-[#666]">{dates(e.start, e.end)}</span>
          </div>
          {e.detail && <p>{e.detail}</p>}
        </div>
      ))}
    </section>
  );
  const Projects = proj.length > 0 && (
    <section className="mt-4">
      {h('Projects')}
      {proj.map((p, i) => (
        <div key={i} className="mb-2">
          <span className="font-bold">{p.name}</span>
          {p.link && <span className="ml-2 text-[12px]" style={{ color: accent }}>{bare(p.link)}</span>}
          {p.detail && <p>{p.detail}</p>}
        </div>
      ))}
    </section>
  );

  return (
    <div ref={box} className="w-full overflow-hidden" style={{ height: height * scale }}>
      <div
        ref={page}
        className="origin-top-left bg-white text-[13px] leading-[1.42] text-[#1f2328] shadow-[0_2px_16px_hsl(225_20%_8%/0.12)]"
        style={{ width: 794, minHeight: 1123, transform: `scale(${scale})`, fontFamily: 'Helvetica, Arial, sans-serif' }}
        aria-label="CV preview"
      >
        {template === 'sidebar' ? (
          <div className="flex min-h-[1123px]">
            <aside className="w-[224px] shrink-0 bg-[#f4f5f7] px-6 py-12">
              <div className="text-[24px] font-bold leading-tight tracking-[-0.01em]" style={{ color: accent }}>
                {cv.name || 'Your name'}
              </div>
              {cv.headline && <div className="mt-1 text-[13px] text-[#444]">{cv.headline}</div>}
              <Side title="Contact" accent={accent} items={[...contact, ...cv.links.map(bare)]} />
              <Side title="Skills" accent={accent} items={cv.skills} />
              <Side title="Certifications" accent={accent} items={cv.certifications} />
            </aside>
            <main className="flex-1 py-12 pl-8 pr-12">
              {cv.summary && (
                <section>
                  {h('Profile')}
                  <p>{cv.summary}</p>
                </section>
              )}
              {Experience}
              {Education}
              {Projects}
            </main>
          </div>
        ) : (
          <div className="px-[58px] py-[50px]">
            <div className={template === 'classic' ? 'text-center' : ''}>
              <div className="font-bold leading-tight tracking-[-0.01em]" style={{ fontSize: modern ? 32 : 28, color: modern ? accent : '#111' }}>
                {cv.name || 'Your name'}
              </div>
              {cv.headline && <div className="mt-1 text-[14.5px] text-[#444]">{cv.headline}</div>}
              {(contact.length > 0 || cv.links.length > 0) && (
                <div className="mt-1.5 text-[12px] text-[#555]">
                  {[...contact, ...cv.links.map(bare)].join('  ·  ')}
                </div>
              )}
            </div>
            {cv.summary && (
              <section className="mt-4">
                {h('Summary')}
                <p>{cv.summary}</p>
              </section>
            )}
            {Experience}
            {Education}
            {cv.skills.length > 0 && (
              <section className="mt-4">
                {h('Skills')}
                <p>{cv.skills.join('  ·  ')}</p>
              </section>
            )}
            {cv.certifications.length > 0 && (
              <section className="mt-4">
                {h('Certifications')}
                <ul>
                  {cv.certifications.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span>•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {Projects}
          </div>
        )}
      </div>
    </div>
  );
}

function Side({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.1em]" style={{ color: accent }}>
        {title}
      </div>
      {items.map((t, i) => (
        <div key={i} className="mb-0.5 break-words text-[12px] text-[#333]">
          {t}
        </div>
      ))}
    </div>
  );
}
