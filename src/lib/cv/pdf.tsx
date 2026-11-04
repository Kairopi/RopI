/**
 * The CV as a real PDF (selectable text, so application systems can read it),
 * drawn with @react-pdf/renderer. Loaded only when you press Download.
 */
import { Document, Page, Text, View, Link, StyleSheet, pdf } from '@react-pdf/renderer';
import type { CV, CvTemplate } from './cv';

const dates = (a: string, b: string) => [a, b].filter(Boolean).join(' – ');
const has = (cv: CV) => ({
  exp: cv.experience.filter((e) => e.role || e.company),
  edu: cv.education.filter((e) => e.school || e.degree),
  proj: cv.projects.filter((p) => p.name),
});
const href = (l: string) => (/^https?:\/\//i.test(l) ? l : `https://${l}`);

function makeStyles(accent: string, template: CvTemplate) {
  const modern = template === 'modern';
  return StyleSheet.create({
    page: { fontFamily: 'Helvetica', fontSize: 9.8, lineHeight: 1.38, color: '#1f2328', paddingVertical: 38, paddingHorizontal: 44 },
    name: { fontFamily: 'Helvetica-Bold', fontSize: modern ? 24 : 21, color: modern ? accent : '#111', textAlign: template === 'classic' ? 'center' : 'left', letterSpacing: -0.3 },
    headline: { fontSize: 11, color: '#444', marginTop: 3, textAlign: template === 'classic' ? 'center' : 'left' },
    contact: { fontSize: 9, color: '#555', marginTop: 5, textAlign: template === 'classic' ? 'center' : 'left' },
    section: { marginTop: 13 },
    h: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 9.5,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: modern ? accent : '#111',
      paddingBottom: 3,
      marginBottom: 6,
      borderBottomWidth: template === 'classic' ? 0.8 : modern ? 1.4 : 0,
      borderBottomColor: modern ? accent : '#222',
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    role: { fontFamily: 'Helvetica-Bold', fontSize: 10.3 },
    org: { color: '#333' },
    when: { fontSize: 9, color: '#666', marginLeft: 8 },
    item: { marginBottom: 7 },
    bulletRow: { flexDirection: 'row', marginTop: 1.5 },
    dot: { width: 9, color: modern ? accent : '#333' },
    bulletText: { flex: 1 },
    skills: { lineHeight: 1.5 },
    link: { color: accent, textDecoration: 'none' },
    // Sidebar template
    side: { width: 168, backgroundColor: '#f4f5f7', paddingVertical: 38, paddingHorizontal: 18 },
    main: { flex: 1, paddingVertical: 38, paddingLeft: 24, paddingRight: 36 },
    sideH: { fontFamily: 'Helvetica-Bold', fontSize: 8.6, letterSpacing: 1, textTransform: 'uppercase', color: accent, marginTop: 14, marginBottom: 5 },
    sideText: { fontSize: 8.8, color: '#333', marginBottom: 2.5 },
  });
}

type S = ReturnType<typeof makeStyles>;

function Bullets({ items, s }: { items: string[]; s: S }) {
  return (
    <>
      {items.filter(Boolean).map((b, i) => (
        <View key={i} style={s.bulletRow} wrap={false}>
          <Text style={s.dot}>•</Text>
          <Text style={s.bulletText}>{b}</Text>
        </View>
      ))}
    </>
  );
}

function Experience({ cv, s }: { cv: CV; s: S }) {
  const { exp } = has(cv);
  if (!exp.length) return null;
  return (
    <View style={s.section}>
      <Text style={s.h}>Experience</Text>
      {exp.map((e, i) => (
        <View key={i} style={s.item}>
          <View style={s.row} wrap={false}>
            <Text>
              <Text style={s.role}>{e.role}</Text>
              {e.company ? <Text style={s.org}>{`${e.role ? ', ' : ''}${e.company}`}</Text> : null}
              {e.location ? <Text style={s.org}>{`, ${e.location}`}</Text> : null}
            </Text>
            <Text style={s.when}>{dates(e.start, e.end)}</Text>
          </View>
          <Bullets items={e.bullets} s={s} />
        </View>
      ))}
    </View>
  );
}

function Education({ cv, s }: { cv: CV; s: S }) {
  const { edu } = has(cv);
  if (!edu.length) return null;
  return (
    <View style={s.section}>
      <Text style={s.h}>Education</Text>
      {edu.map((e, i) => (
        <View key={i} style={s.item} wrap={false}>
          <View style={s.row}>
            <Text>
              <Text style={s.role}>{e.degree || e.school}</Text>
              {e.degree && e.school ? <Text style={s.org}>{`, ${e.school}`}</Text> : null}
            </Text>
            <Text style={s.when}>{dates(e.start, e.end)}</Text>
          </View>
          {e.detail ? <Text>{e.detail}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function Projects({ cv, s }: { cv: CV; s: S }) {
  const { proj } = has(cv);
  if (!proj.length) return null;
  return (
    <View style={s.section}>
      <Text style={s.h}>Projects</Text>
      {proj.map((p, i) => (
        <View key={i} style={s.item} wrap={false}>
          <Text>
            <Text style={s.role}>{p.name}</Text>
            {p.link ? (
              <Link src={href(p.link)} style={s.link}>
                {`  ${p.link}`}
              </Link>
            ) : null}
          </Text>
          {p.detail ? <Text>{p.detail}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function OneColumn({ cv, s }: { cv: CV; s: S }) {
  const contact = [cv.email, cv.phone, cv.location].filter(Boolean);
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.name}>{cv.name || 'Your name'}</Text>
      {cv.headline ? <Text style={s.headline}>{cv.headline}</Text> : null}
      {(contact.length > 0 || cv.links.length > 0) && (
        <Text style={s.contact}>
          {contact.join('  ·  ')}
          {cv.links.map((l, i) => (
            <Link key={i} src={href(l)} style={s.link}>
              {`${contact.length || i ? '  ·  ' : ''}${l.replace(/^https?:\/\/(www\.)?/, '')}`}
            </Link>
          ))}
        </Text>
      )}
      {cv.summary ? (
        <View style={s.section}>
          <Text style={s.h}>Summary</Text>
          <Text>{cv.summary}</Text>
        </View>
      ) : null}
      <Experience cv={cv} s={s} />
      <Education cv={cv} s={s} />
      {cv.skills.length > 0 && (
        <View style={s.section} wrap={false}>
          <Text style={s.h}>Skills</Text>
          <Text style={s.skills}>{cv.skills.join('  ·  ')}</Text>
        </View>
      )}
      {cv.certifications.length > 0 && (
        <View style={s.section} wrap={false}>
          <Text style={s.h}>Certifications</Text>
          <Bullets items={cv.certifications} s={s} />
        </View>
      )}
      <Projects cv={cv} s={s} />
    </Page>
  );
}

function Sidebar({ cv, s }: { cv: CV; s: S }) {
  return (
    <Page size="A4" style={{ ...s.page, padding: 0, flexDirection: 'row' }}>
      <View style={s.side}>
        <Text style={{ ...s.name, fontSize: 18, textAlign: 'left' }}>{cv.name || 'Your name'}</Text>
        {cv.headline ? <Text style={{ ...s.headline, fontSize: 10, textAlign: 'left' }}>{cv.headline}</Text> : null}
        <Text style={s.sideH}>Contact</Text>
        {[cv.email, cv.phone, cv.location].filter(Boolean).map((c, i) => (
          <Text key={i} style={s.sideText}>
            {c}
          </Text>
        ))}
        {cv.links.map((l, i) => (
          <Link key={`l${i}`} src={href(l)} style={{ ...s.sideText, ...s.link }}>
            {l.replace(/^https?:\/\/(www\.)?/, '')}
          </Link>
        ))}
        {cv.skills.length > 0 && <Text style={s.sideH}>Skills</Text>}
        {cv.skills.map((k, i) => (
          <Text key={`s${i}`} style={s.sideText}>
            {k}
          </Text>
        ))}
        {cv.certifications.length > 0 && <Text style={s.sideH}>Certifications</Text>}
        {cv.certifications.map((c, i) => (
          <Text key={`c${i}`} style={s.sideText}>
            {c}
          </Text>
        ))}
      </View>
      <View style={s.main}>
        {cv.summary ? (
          <View>
            <Text style={s.h}>Profile</Text>
            <Text>{cv.summary}</Text>
          </View>
        ) : null}
        <Experience cv={cv} s={s} />
        <Education cv={cv} s={s} />
        <Projects cv={cv} s={s} />
      </View>
    </Page>
  );
}

export async function cvPdfBlob(cv: CV, template: CvTemplate, accent: string): Promise<Blob> {
  const s = makeStyles(accent, template);
  const doc = (
    <Document title={`${cv.name || 'CV'} – CV`} author={cv.name || undefined} creator="Ropi" producer="Ropi">
      {template === 'sidebar' ? <Sidebar cv={cv} s={s} /> : <OneColumn cv={cv} s={s} />}
    </Document>
  );
  return pdf(doc).toBlob();
}
