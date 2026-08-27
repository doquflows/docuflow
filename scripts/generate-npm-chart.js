#!/usr/bin/env node
/**
 * generate-npm-chart.js
 *
 * Fetches download stats for the @doquflow v2.0 packages from the npm
 * downloads API, then writes a self-contained SVG line chart to docs/stats/npm-downloads.svg.
 *
 * Designed to run inside a GitHub Actions workflow on a schedule.
 * No external dependencies — uses Node.js built-in https module only.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PACKAGES = ['@doquflow/cli', '@doquflow/core', '@doquflow/studio'];
const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'stats', 'npm-downloads.svg');

// ── helpers ───────────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse failed for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

async function fetchRange(pkg) {
  const url = `https://api.npmjs.org/downloads/range/last-month/${encodeURIComponent(pkg)}`;
  const data = await get(url);
  return (data.downloads || []).map(d => ({ date: d.day, count: d.downloads }));
}

// ── chart generation ──────────────────────────────────────────────────────────

function generateSVG(datasets, updatedAt) {
  const W = 860, H = 280;
  const PAD = { top: 48, right: 24, bottom: 56, left: 64 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  // Merge dates from all datasets
  const allDates = [...new Set(datasets.flatMap(d => d.points.map(p => p.date)))].sort();

  // For each dataset, build a map date→count and fill gaps with 0
  const series = datasets.map(d => {
    const map = Object.fromEntries(d.points.map(p => [p.date, p.count]));
    return {
      label: d.label,
      color: d.color,
      fill: d.fill,
      values: allDates.map(date => map[date] ?? 0),
      total: d.points.reduce((s, p) => s + p.count, 0),
    };
  });

  const maxVal = Math.max(1, ...series.flatMap(s => s.values));
  const n = allDates.length;

  // Scale helpers
  const scaleX = (i) => PAD.left + (i / Math.max(n - 1, 1)) * chartW;
  const scaleY = (v) => PAD.top + chartH - (v / maxVal) * chartH;

  // Build polyline points
  function polyPoints(values) {
    return values.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(' ');
  }

  // Build area polygon (line + baseline)
  function areaPoints(values) {
    const line = values.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`);
    const base = [
      `${scaleX(n - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)}`,
      `${scaleX(0).toFixed(1)},${(PAD.top + chartH).toFixed(1)}`,
    ];
    return [...line, ...base].join(' ');
  }

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  // X-axis labels: show ~6 evenly spaced dates
  const labelStep = Math.max(1, Math.floor(n / 6));
  const xLabels = allDates
    .map((d, i) => ({ date: d, i }))
    .filter(({ i }) => i % labelStep === 0 || i === n - 1);

  // Format date: "Apr 16" style
  function fmtDate(s) {
    const [, m, d] = s.split('-');
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[+m]} ${+d}`;
  }

  // Dots for latest data points
  const dots = series.map(s => ({
    color: s.color,
    x: scaleX(n - 1),
    y: scaleY(s.values[n - 1] ?? 0),
    val: s.values[n - 1] ?? 0,
  }));

  // Gradient defs
  const gradientDefs = series.map((s, idx) => `
    <linearGradient id="grad${idx}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${s.fill}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${s.fill}" stop-opacity="0.02"/>
    </linearGradient>`).join('');

  // Area fills
  const areas = series.map((s, idx) => `
    <polygon points="${areaPoints(s.values)}" fill="url(#grad${idx})"/>`).join('');

  // Lines
  const lines = series.map(s => `
    <polyline points="${polyPoints(s.values)}"
      fill="none" stroke="${s.color}" stroke-width="2.2"
      stroke-linejoin="round" stroke-linecap="round"/>`).join('');

  // Y-axis gridlines + labels
  const yGrid = yTicks.map(v => {
    const y = scaleY(v).toFixed(1);
    return `
    <line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}"
      stroke="#e5e7eb" stroke-width="1"/>
    <text x="${PAD.left - 8}" y="${y}" text-anchor="end" dominant-baseline="middle"
      font-size="11" fill="#6b7280">${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}</text>`;
  }).join('');

  // X-axis labels
  const xAxis = xLabels.map(({ date, i }) => `
    <text x="${scaleX(i).toFixed(1)}" y="${PAD.top + chartH + 18}"
      text-anchor="middle" font-size="11" fill="#6b7280">${fmtDate(date)}</text>`).join('');

  // Legend
  const legendItems = series.map((s, i) => {
    const x = PAD.left + i * 220;
    return `
    <rect x="${x}" y="12" width="12" height="12" rx="3" fill="${s.color}"/>
    <text x="${x + 18}" y="22" font-size="13" fill="#374151" font-weight="600">
      ${s.label}
    </text>
    <text x="${x + 18}" y="36" font-size="11" fill="#6b7280">
      ${s.total.toLocaleString()} last 30 days
    </text>`;
  }).join('');

  // Hover dots (last point)
  const endDots = dots.map(d => `
    <circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="4"
      fill="${d.color}" stroke="#fff" stroke-width="2">
      <title>${d.val} downloads</title>
    </circle>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
  viewBox="0 0 ${W} ${H}" style="background:#fff;border-radius:12px;font-family:system-ui,sans-serif">
  <defs>${gradientDefs}
  </defs>

  <!-- Y grid + labels -->
  ${yGrid}

  <!-- Areas -->
  ${areas}

  <!-- Lines -->
  ${lines}

  <!-- X axis labels -->
  ${xAxis}

  <!-- End-point dots -->
  ${endDots}

  <!-- Legend (top-left) -->
  ${legendItems}

  <!-- Updated timestamp (bottom-right) -->
  <text x="${W - PAD.right}" y="${H - 8}" text-anchor="end"
    font-size="10" fill="#9ca3af">Updated ${updatedAt}</text>

  <!-- Axes -->
  <line x1="${PAD.left}" y1="${PAD.top}" x2="${PAD.left}" y2="${PAD.top + chartH}"
    stroke="#d1d5db" stroke-width="1"/>
  <line x1="${PAD.left}" y1="${PAD.top + chartH}" x2="${W - PAD.right}" y2="${PAD.top + chartH}"
    stroke="#d1d5db" stroke-width="1"/>
</svg>`;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📊 Fetching npm download stats...');

  const colors = [
    { color: '#6366f1', fill: '#818cf8' }, // indigo  — cli
    { color: '#10b981', fill: '#34d399' }, // emerald — core
    { color: '#f59e0b', fill: '#fbbf24' }, // amber   — studio
  ];

  const datasets = await Promise.all(
    PACKAGES.map(async (pkg, i) => {
      const points = await fetchRange(pkg);
      const total = points.reduce((s, p) => s + p.count, 0);
      console.log(`  ${pkg}: ${total} downloads in last 30 days`);
      return {
        label: pkg,
        points,
        color: colors[i].color,
        fill: colors[i].fill,
      };
    })
  );

  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const svg = generateSVG(datasets, now);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, svg, 'utf8');
  console.log(`✅ Chart written to ${OUTPUT_PATH}`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
