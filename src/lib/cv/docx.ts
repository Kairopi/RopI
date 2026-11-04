/**
 * The CV as a Word document (.docx) you can keep editing, built with `docx`.
 * One column with real headings, so it reads well in application systems.
 * Loaded only when you press Download.
 */
import { AlignmentType, BorderStyle, Document, ExternalHyperlink, Packer, Paragraph, TabStopPosition, TabStopType, TextRun } from 'docx';
import type { CV, CvTemplate } from './cv';

const dates = (a: string, b: string) => [a, b].filter(Boolean).join(' – ');
const href = (l: string) => (/^https?:\/\//i.test(l) ? l : `https://${l}`);

export async function cvDocxBlob(cv: CV, template: CvTemplate, accent: string): Promise<Blob> {
  const color = template === 'classic' ? '111111' : accent.replace('#', '');
  const center = template === 'classic';
  const FONT = 'Calibri';

  const heading = (text: string) =>
    new Paragraph({
      spacing: { before: 240, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 2 } },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color, font: FONT, characterSpacing: 20 })],
    });
  const bullet = (text: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 30 }, children: [new TextRun({ text, size: 20, font: FONT })] });
  const titleLine = (left: TextRun[], right: string) =>
    new Paragraph({
      spacing: { before: 120, after: 30 },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      children: [...left, ...(right ? [new TextRun({ text: `\t${right}`, size: 18, color: '666666', font: FONT })] : [])],
    });

  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: cv.name || 'Your name', bold: true, size: 44, color: template === 'classic' ? '111111' : color, font: FONT })],
    })
  );
  if (cv.headline) children.push(new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: cv.headline, size: 22, color: '444444', font: FONT })] }));
  const contact = [cv.email, cv.phone, cv.location].filter(Boolean);
  if (contact.length || cv.links.length) {
    const runs: (TextRun | ExternalHyperlink)[] = [new TextRun({ text: contact.join('  ·  '), size: 18, color: '555555', font: FONT })];
    cv.links.forEach((l, i) =>
      runs.push(
        new TextRun({ text: contact.length || i ? '  ·  ' : '', size: 18, color: '555555', font: FONT }),
        new ExternalHyperlink({ link: href(l), children: [new TextRun({ text: l.replace(/^https?:\/\/(www\.)?/, ''), size: 18, color, font: FONT })] })
      )
    );
    children.push(new Paragraph({ alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 60 }, children: runs }));
  }

  if (cv.summary) children.push(heading('Summary'), new Paragraph({ children: [new TextRun({ text: cv.summary, size: 20, font: FONT })] }));

  const exp = cv.experience.filter((e) => e.role || e.company);
  if (exp.length) {
    children.push(heading('Experience'));
    for (const e of exp) {
      children.push(
        titleLine(
          [
            new TextRun({ text: e.role, bold: true, size: 21, font: FONT }),
            new TextRun({ text: [e.role && e.company ? ', ' : '', e.company, e.location ? `, ${e.location}` : ''].join(''), size: 21, font: FONT }),
          ],
          dates(e.start, e.end)
        )
      );
      for (const b of e.bullets.filter(Boolean)) children.push(bullet(b));
    }
  }

  const edu = cv.education.filter((e) => e.school || e.degree);
  if (edu.length) {
    children.push(heading('Education'));
    for (const e of edu) {
      children.push(
        titleLine(
          [new TextRun({ text: e.degree || e.school, bold: true, size: 21, font: FONT }), new TextRun({ text: e.degree && e.school ? `, ${e.school}` : '', size: 21, font: FONT })],
          dates(e.start, e.end)
        )
      );
      if (e.detail) children.push(new Paragraph({ children: [new TextRun({ text: e.detail, size: 20, font: FONT })] }));
    }
  }

  if (cv.skills.length) children.push(heading('Skills'), new Paragraph({ children: [new TextRun({ text: cv.skills.join('  ·  '), size: 20, font: FONT })] }));
  if (cv.certifications.length) children.push(heading('Certifications'), ...cv.certifications.map(bullet));
  const proj = cv.projects.filter((p) => p.name);
  if (proj.length) {
    children.push(heading('Projects'));
    for (const p of proj) {
      children.push(
        new Paragraph({
          spacing: { before: 100 },
          children: [
            new TextRun({ text: p.name, bold: true, size: 21, font: FONT }),
            ...(p.link ? [new TextRun({ text: '  ', size: 20 }), new ExternalHyperlink({ link: href(p.link), children: [new TextRun({ text: p.link, size: 18, color, font: FONT })] })] : []),
          ],
        })
      );
      if (p.detail) children.push(new Paragraph({ children: [new TextRun({ text: p.detail, size: 20, font: FONT })] }));
    }
  }

  const doc = new Document({
    creator: 'Ropi',
    title: `${cv.name || 'CV'} – CV`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 760, bottom: 760, left: 880, right: 880 } } }, children }],
  });
  return Packer.toBlob(doc);
}
