// One-time migration: replace raw Tailwind palette colors with ROPI design tokens.
// Usage: node .tmp-check/recolor.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const ROOT = path.resolve('src');

const FAMILY = {
  success: ['emerald', 'green', 'teal', 'lime'],
  warning: ['amber', 'yellow', 'orange'],
  destructive: ['red', 'rose', 'pink'],
  primary: ['blue', 'indigo', 'violet', 'purple', 'sky', 'cyan'],
  neutral: ['gray', 'slate', 'neutral', 'zinc', 'stone'],
};
const familyOf = Object.fromEntries(Object.entries(FAMILY).flatMap(([t, cs]) => cs.map((c) => [c, t])));
const COLORS = Object.keys(familyOf).join('|');

// prefix-color-shade, optional /opacity
const RE = new RegExp(`\\b(bg|text|border|ring|ring-offset|outline|divide|fill|stroke|from|to|via|shadow|accent|caret|decoration)-(${COLORS})-(50|100|200|300|400|500|600|700|800|900|950)(\\/(?:\\d+|\\[[^\\]]+\\]))?\\b`, 'g');

function tint(token, shade) {
  // Light shades become translucent tints of the token
  if (shade <= 50) return `${token}/10`;
  if (shade <= 100) return `${token}/15`;
  if (shade <= 200) return `${token}/25`;
  if (shade <= 300) return `${token}/40`;
  if (shade <= 400) return `${token}/70`;
  return token;
}

function mapOne(prefix, color, shadeStr, opacity) {
  const shade = Number(shadeStr);
  const fam = familyOf[color];

  if (fam === 'neutral') {
    if (prefix === 'text' || prefix === 'fill' || prefix === 'stroke') {
      return `${prefix}-${shade >= 700 ? 'foreground' : 'muted-foreground'}${opacity ?? ''}`;
    }
    if (prefix === 'bg') {
      if (shade <= 100) return `bg-muted${opacity ?? ''}`;
      if (shade <= 300) return `bg-border${opacity ?? ''}`;
      if (shade >= 800) return `bg-foreground${opacity ?? ''}`;
      return `bg-muted-foreground${opacity ?? ''}`;
    }
    return `${prefix}-border${opacity ?? ''}`;
  }

  const token = fam;
  if (prefix === 'text') {
    if (fam === 'warning') return `text-warning-ink${opacity ?? ''}`;
    return `text-${token}${opacity ?? ''}`;
  }
  if (prefix === 'border' || prefix === 'ring' || prefix === 'outline' || prefix === 'divide' || prefix === 'ring-offset') {
    const base = shade <= 200 ? `${token}/25` : shade <= 400 ? `${token}/40` : token;
    return `${prefix}-${opacity && !base.includes('/') ? base + opacity : base}`;
  }
  // bg, fill, stroke, from/to/via, shadow, ...
  if (opacity) return `${prefix}-${token}${opacity}`;
  return `${prefix}-${tint(token, shade)}`;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(tsx|ts)$/.test(e.name) && e.name !== 'icons.tsx' ? [p] : [];
  });
}

let total = 0;
const perFile = [];
for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  let count = 0;
  let out = src.replace(RE, (_m, prefix, color, shade, opacity) => {
    count++;
    return mapOne(prefix, color, shade, opacity);
  });
  // bg-white -> bg-card (panels), keep text-white
  out = out.replace(/\bbg-white\b(?!\/)/g, () => {
    count++;
    return 'bg-card';
  });
  if (count) {
    total += count;
    perFile.push([count, path.relative(ROOT, file)]);
    if (!DRY) fs.writeFileSync(file, out);
  }
}
perFile.sort((a, b) => b[0] - a[0]).forEach(([n, f]) => console.log(String(n).padStart(4), f));
console.log(`${DRY ? 'Would replace' : 'Replaced'} ${total} classes in ${perFile.length} files`);
