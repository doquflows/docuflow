// DocuFlow UI walkthrough — Playwright recording script.
// Uses project-local playwright from packages/ui/node_modules.
// Outputs: screenshots to /tmp/docuflow-screenshots/, video to /tmp/docuflow-video/

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SHOTS_DIR = '/tmp/docuflow-screenshots';
const VIDEO_DIR = '/tmp/docuflow-video';
const UI_URL    = 'http://localhost:5173';
const PROJECT   = 'docuflow-testproject';

for (const dir of [SHOTS_DIR, VIDEO_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const shot = (name) => join(SHOTS_DIR, name);

// Click a rail nav button by its title= attribute
async function clickRail(page, title) {
  await page.locator(`button[title="${title}"]`).first().click();
  await page.waitForTimeout(800); // settle animation
}

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 120 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[browser:error]', msg.text());
  });

  // ── Load app ──────────────────────────────────────────────────────────────
  console.log(`🌐  Opening ${UI_URL} …`);
  await page.goto(UI_URL, { waitUntil: 'networkidle' });

  // Wait for API to respond and TopBar to show real project name
  console.log(`⏳  Waiting for "${PROJECT}" in TopBar …`);
  await page.waitForFunction(
    name => document.body?.innerText?.includes(name),
    PROJECT,
    { timeout: 30_000 }
  );
  await page.waitForTimeout(1000);
  console.log('✓  TopBar shows project name + live status');

  // ── 1. Ask view (default) ─────────────────────────────────────────────────
  console.log('📸  Ask view …');
  await page.screenshot({ path: shot('01-ask.png'), fullPage: true });

  // ── 2. Wiki view ──────────────────────────────────────────────────────────
  console.log('📖  Navigating → Wiki …');
  await clickRail(page, 'Wiki');
  await page.waitForTimeout(1500); // let live wiki tree load from API
  await page.screenshot({ path: shot('02-wiki.png'), fullPage: true });

  // ── 3. Graph view ─────────────────────────────────────────────────────────
  console.log('🕸   Navigating → Graph …');
  await clickRail(page, 'Graph');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot('03-graph.png'), fullPage: true });

  // ── 4. Health view ────────────────────────────────────────────────────────
  console.log('🩺  Navigating → Health …');
  await clickRail(page, 'Health');
  // Wait for live health score (96) to appear from API
  await page.waitForFunction(
    () => /\b9[0-9]\b/.test(document.body.innerText),
    null,
    { timeout: 15_000 }
  ).catch(() => console.log('  (health score did not appear within 15s, continuing)'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot('04-health.png'), fullPage: true });

  // ── 5. Sync view ──────────────────────────────────────────────────────────
  console.log('🔄  Navigating → Sync …');
  await clickRail(page, 'Sync');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: shot('05-sync.png'), fullPage: true });

  // ── 6. Onboard view ───────────────────────────────────────────────────────
  console.log('✨  Navigating → New project (Onboard) …');
  await clickRail(page, 'New project');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: shot('06-onboard.png'), fullPage: true });

  // ── Back to Ask view for final frame ──────────────────────────────────────
  console.log('🏠  Back to Ask …');
  await clickRail(page, 'Ask');
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot('07-ask-final.png'), fullPage: true });

  // ── Close + flush video ───────────────────────────────────────────────────
  console.log('💾  Saving video …');
  await context.close();
  await browser.close();

  console.log('\n✅  Done!');
  console.log(`   Screenshots : ${SHOTS_DIR}/`);
  console.log(`   Video       : ${VIDEO_DIR}/  (look for newest .webm)`);
}

run().catch(async err => {
  console.error('❌ Playwright run failed:', err.message);
  process.exit(1);
});
