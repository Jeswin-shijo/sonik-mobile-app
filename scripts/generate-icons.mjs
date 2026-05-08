import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, '../assets');

// ─── Palette ─────────────────────────────────────────────────────────────────
const BG        = '#120f18';
const GOLD      = '#f5c15d';
const ORANGE    = '#ff8c69';
const TEAL      = '#55d6c2';

// ─── Bar geometry ─────────────────────────────────────────────────────────────
// 5 bars, symmetric, all centred at cy
function barsAt({ cx, cy, barW, gap, heights, gradId }) {
  const count  = heights.length;
  const total  = count * barW + (count - 1) * gap;
  const startX = cx - total / 2;
  const r      = barW / 2;

  return heights.map((h, i) => {
    const x = startX + i * (barW + gap);
    const y = cy - h / 2;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="${r}" fill="url(#${gradId})"/>`;
  }).join('\n  ');
}

// ─── Main icon (1024×1024, dark bg) ──────────────────────────────────────────
function iconSvg(size) {
  const cx = size / 2;
  const cy = size / 2;
  const unit = size / 10;            // scale unit

  const barW   = unit * 0.85;
  const gap    = unit * 0.55;
  const heights = [
    unit * 2.2,
    unit * 3.6,
    unit * 5.0,
    unit * 3.6,
    unit * 2.2,
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"   stop-color="${GOLD}"/>
      <stop offset="0.5" stop-color="${ORANGE}"/>
      <stop offset="1"   stop-color="${TEAL}"/>
    </linearGradient>
    <radialGradient id="bg" cx="50%" cy="50%" r="60%">
      <stop offset="0"   stop-color="#1e1829"/>
      <stop offset="1"   stop-color="${BG}"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  ${barsAt({ cx, cy, barW, gap, heights, gradId: 'g' })}
</svg>`;
}

// ─── Adaptive foreground (1024×1024, transparent bg, bars in safe zone) ──────
function adaptiveSvg(size) {
  // Android safe zone = inner 72 % → radius 36 % from centre
  const cx = size / 2;
  const cy = size / 2;
  const safe = size * 0.54;          // usable height in safe zone
  const unit = safe / 5;

  const barW   = unit * 0.85;
  const gap    = unit * 0.55;
  const heights = [
    unit * 2.2,
    unit * 3.6,
    unit * 5.0,
    unit * 3.6,
    unit * 2.2,
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"   stop-color="${GOLD}"/>
      <stop offset="0.5" stop-color="${ORANGE}"/>
      <stop offset="1"   stop-color="${TEAL}"/>
    </linearGradient>
  </defs>
  ${barsAt({ cx, cy, barW, gap, heights, gradId: 'g' })}
</svg>`;
}

// ─── Favicon (48×48, rounded, dark bg) ───────────────────────────────────────
function faviconSvg(size) {
  const cx = size / 2;
  const cy = size / 2;
  const unit = size / 10;

  const barW   = unit * 0.8;
  const gap    = unit * 0.5;
  const heights = [
    unit * 2.0,
    unit * 3.2,
    unit * 4.6,
    unit * 3.2,
    unit * 2.0,
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0"   stop-color="${GOLD}"/>
      <stop offset="0.5" stop-color="${ORANGE}"/>
      <stop offset="1"   stop-color="${TEAL}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${BG}"/>
  ${barsAt({ cx, cy, barW, gap, heights, gradId: 'g' })}
</svg>`;
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function render(svg, outPath) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
  const png   = resvg.render().asPng();
  writeFileSync(outPath, png);
  console.log(`✓  ${outPath}`);
}

// ─── Generate ─────────────────────────────────────────────────────────────────
render(iconSvg(1024),     `${ASSETS}/sonik-icon.png`);
render(adaptiveSvg(1024), `${ASSETS}/sonik-adaptive-icon.png`);
render(iconSvg(1024),     `${ASSETS}/sonik-splash-icon.png`);
render(faviconSvg(48),    `${ASSETS}/sonik-favicon.png`);

console.log('\nAll icons generated.');
