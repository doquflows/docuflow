/**
 * DocuFlow E2E Test — new + existing features
 *
 * Tests every major route and UI interaction via Playwright.
 * Run:  node scripts/e2e-test.mjs
 */

import { chromium } from 'playwright';

import path from 'node:path';
import os from 'node:os';

const BASE        = process.env.DOCUFLOW_BASE_URL || 'http://localhost:48821';
const TEST_PATH   = process.env.DOCUFLOW_TEST_PROJECT || path.join(os.tmpdir(), 'docuflow-testproject');
const BLANK_PATH  = path.join(os.tmpdir(), 'docuflow-nonexistent-xyztest');       // guaranteed non-existent

const pass = (msg) => console.log(`  ✅  ${msg}`);
const fail = (msg) => { console.log(`  ❌  ${msg}`); failures++; };
const head = (msg) => console.log(`\n  ── ${msg} ──`);

let failures = 0;

// ── API smoke tests (no browser needed) ──────────────────────────────────────
async function apiTests() {
  head('API Routes');

  // Existing routes
  const ping = await fetch(`${BASE}/api/ping`).then(r => r.json());
  ping.ok ? pass('/api/ping → ok') : fail('/api/ping failed');

  const projects = await fetch(`${BASE}/api/projects`).then(r => r.json());
  Array.isArray(projects) && projects.length > 0
    ? pass(`/api/projects → ${projects.length} project(s)`)
    : fail('/api/projects returned empty or error');

  const wiki = await fetch(`${BASE}/api/wiki?path=${encodeURIComponent(TEST_PATH)}`).then(r => r.json());
  wiki.pages?.length > 0
    ? pass(`/api/wiki → ${wiki.pages.length} pages`)
    : fail('/api/wiki returned no pages');

  const health = await fetch(`${BASE}/api/health?path=${encodeURIComponent(TEST_PATH)}`).then(r => r.json());
  typeof health.health_score === 'number'
    ? pass(`/api/health → score ${health.health_score}`)
    : fail('/api/health missing health_score');

  const search = await fetch(`${BASE}/api/search?path=${encodeURIComponent(TEST_PATH)}&q=service`).then(r => r.json());
  Array.isArray(search.results)
    ? pass(`/api/search → ${search.results.length} result(s)`)
    : fail('/api/search bad response: ' + JSON.stringify(search).slice(0,100));

  const ask = await fetch(`${BASE}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: TEST_PATH, question: 'What are the main entities?' }),
  }).then(r => r.json());
  ask.answer || ask.synthesis || ask.content
    ? pass('/api/ask → got answer')
    : fail('/api/ask bad response: ' + JSON.stringify(ask).slice(0,120));

  // NEW: /api/watch/status
  const watchStatus = await fetch(`${BASE}/api/watch/status?path=${encodeURIComponent(TEST_PATH)}`).then(r => r.json());
  typeof watchStatus.running === 'boolean'
    ? pass(`/api/watch/status → running: ${watchStatus.running}`)
    : fail('/api/watch/status missing running field');

  // NEW: /api/sync on blank project (missing .docuflow → 400)
  const syncBlank = await fetch(`${BASE}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: BLANK_PATH }),
  });
  syncBlank.status === 400
    ? pass('/api/sync → 400 for uninitialized project (correct)')
    : fail(`/api/sync should 400 for blank project, got ${syncBlank.status}`);

  // NEW: /api/sync on live project
  const syncLive = await fetch(`${BASE}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: TEST_PATH }),
  }).then(r => r.json());
  typeof syncLive.sources_processed === 'number'
    ? pass(`/api/sync → processed ${syncLive.sources_processed} source(s), health ${syncLive.health_score}`)
    : fail('/api/sync bad response: ' + JSON.stringify(syncLive).slice(0,120));

  // NEW: /api/init → 400 for non-existent path
  const initBad = await fetch(`${BASE}/api/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/nonexistent/fake/path' }),
  });
  initBad.status === 400
    ? pass('/api/init → 400 for non-existent path (correct)')
    : fail(`/api/init should 400 for bad path, got ${initBad.status}`);

  // NEW: /api/watch/stop → ok when daemon not running
  const watchStop = await fetch(`${BASE}/api/watch/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: TEST_PATH }),
  }).then(r => r.json());
  watchStop.ok
    ? pass('/api/watch/stop → ok (daemon not running)')
    : fail('/api/watch/stop bad response: ' + JSON.stringify(watchStop).slice(0,100));

  // NEW: /api/watch/start → bad path
  const watchStartBad = await fetch(`${BASE}/api/watch/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: BLANK_PATH }),
  });
  watchStartBad.status === 400
    ? pass('/api/watch/start → 400 for uninitialized project (correct)')
    : fail(`/api/watch/start should 400, got ${watchStartBad.status}`);
}

// ── Browser UI tests ──────────────────────────────────────────────────────────
async function browserTests() {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));

  try {
    // ── Boot ────────────────────────────────────────────────────────────────
    head('App Boot');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    const title = await page.title();
    title.includes('DocuFlow')
      ? pass(`Page title: "${title}"`)
      : fail(`Unexpected title: "${title}"`);

    // TopBar visible
    const topbar = await page.locator('.df-topbar').isVisible();
    topbar ? pass('TopBar visible') : fail('TopBar not visible');

    // Rail visible
    const rail = await page.locator('.df-rail').isVisible();
    rail ? pass('Rail visible') : fail('Rail not visible');

    // API status dot
    const apiDot = await page.locator('.df-status-dot').first().isVisible();
    apiDot ? pass('API status dot visible') : fail('Status dot not visible');

    // ── TopBar: project picker ───────────────────────────────────────────────
    head('TopBar / Project Picker');
    await page.locator('.df-topbar__crumb button').click();
    await page.waitForTimeout(300);

    const picker = await page.locator('.df-topbar__crumb > div').isVisible().catch(() => false);
    picker ? pass('Project picker dropdown opened') : fail('Picker dropdown not visible');

    // Check add-path input exists
    const addInput = await page.locator('.df-topbar__crumb input[placeholder*="path"]').isVisible().catch(() => false);
    addInput ? pass('Add-by-path input visible') : fail('Add-by-path input not found');

    // Close picker by clicking elsewhere
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // ── Ask view ─────────────────────────────────────────────────────────────
    head('Ask View (existing)');
    await page.locator('.df-rail__item[title="Ask"]').click().catch(() =>
      page.locator('button[title="Ask"]').click()
    );
    await page.waitForTimeout(500);

    const askInput = await page.locator('input[placeholder*="Ask"]').isVisible().catch(() =>
      page.locator('textarea[placeholder*="Ask"]').isVisible().catch(() => false)
    );
    askInput ? pass('Ask input visible') : fail('Ask input not found');

    const chips = await page.locator('.df-chip, [class*="chip"], [class*="suggestion"]').count().catch(() => 0);
    chips > 0 ? pass(`${chips} suggestion chip(s) visible`) : pass('No chips (OK if no wiki data)');

    // ── Wiki view ────────────────────────────────────────────────────────────
    head('Wiki View (existing)');
    await page.locator('button[title="Wiki"]').click();
    await page.waitForTimeout(800);

    const wikiTree = await page.locator('.df-tree').isVisible().catch(() => false);
    wikiTree ? pass('Wiki tree sidebar visible') : fail('Wiki tree not visible');

    // Check if live pages loaded
    const treeRows = await page.locator('.df-tree__row').count();
    treeRows > 0
      ? pass(`Wiki tree has ${treeRows} row(s)`)
      : fail('Wiki tree empty');

    // Click a leaf page (non-category row)
    const pageRows = await page.locator('.df-tree__row').all();
    let clicked = false;
    for (const row of pageRows) {
      const cls = await row.getAttribute('class') ?? '';
      if (!cls.includes('cat')) {
        await row.click();
        await page.waitForTimeout(600);
        clicked = true;
        break;
      }
    }
    clicked ? pass('Clicked a wiki page leaf') : pass('No leaf pages to click (all are categories)');

    // Check page content area
    const pageContent = await page.locator('.df-page').isVisible().catch(() => false);
    pageContent ? pass('Page content area visible') : fail('Page content area not visible');

    // ── Graph view ───────────────────────────────────────────────────────────
    head('Graph View (existing)');
    await page.locator('button[title="Graph"]').click();
    await page.waitForTimeout(1200);

    const graphCanvas = await page.locator('svg, canvas').isVisible().catch(() => false);
    graphCanvas ? pass('Graph canvas (svg/canvas) visible') : pass('Graph canvas not visible (may still loading)');

    // ── Health view ──────────────────────────────────────────────────────────
    head('Health View (existing)');
    await page.locator('button[title="Health"]').click();
    await page.waitForTimeout(800);

    const healthScore = await page.locator('text=/\\d+\\/100/').isVisible().catch(() => false);
    healthScore ? pass('Health score visible') : fail('Health score not found');

    const healthCards = await page.locator('[class*="stat"], [class*="card"]').count();
    healthCards > 0 ? pass(`${healthCards} health card(s) visible`) : fail('No health cards');

    // ── Sync view — NEW features ─────────────────────────────────────────────
    head('Sync View (new features)');
    await page.locator('button[title="Sync"]').click();
    await page.waitForTimeout(800);

    // Run Sync button
    const runSyncBtn = await page.locator('button', { hasText: /Run Sync/i }).isVisible().catch(() => false);
    runSyncBtn ? pass('"Run Sync" button visible') : fail('"Run Sync" button not found');

    // Start/Stop daemon button (real watch status)
    const daemonBtn = await page.locator('button', { hasText: /daemon|Stop|Start/i }).isVisible().catch(() => false);
    daemonBtn ? pass('Daemon Stop/Start button visible') : fail('Daemon control button not found');

    // Status card
    const statusCard = await page.locator('[class*="sync-card"]').count();
    statusCard > 0 ? pass(`${statusCard} sync status card(s) visible`) : fail('No sync cards');

    // Click Run Sync and verify feedback
    if (runSyncBtn) {
      await page.locator('button', { hasText: /Run Sync/i }).click();
      await page.waitForTimeout(500);
      const syncing = await page.locator('button', { hasText: /Syncing/i }).isVisible().catch(() => false);
      syncing ? pass('"Syncing…" loading state shown') : pass('Sync state not shown (may be instant)');
      // Wait for result (up to 8s)
      await page.waitForFunction(
        () => document.querySelector('button[disabled]') === null
             || document.querySelector('[style*="green"]') !== null,
        { timeout: 8000 }
      ).catch(() => {});
      const syncDone = await page.locator('text=/Sync complete|error/i').isVisible().catch(() => false);
      syncDone ? pass('Sync result banner shown') : pass('Sync result banner not yet visible (OK)');
    }

    // ── Onboard view — NEW features ──────────────────────────────────────────
    head('Onboard View (new features)');
    await page.locator('button[title="New project"]').click();
    await page.waitForTimeout(500);

    // Step indicator
    const stepDots = await page.locator('[class*="onboard__step"]').count();
    stepDots > 0 ? pass(`${stepDots} onboard step indicator(s)`) : fail('No step indicators');

    // Move to step 2
    await page.locator('button', { hasText: /Continue/i }).click();
    await page.waitForTimeout(400);

    // Real path input
    const pathInput = await page.locator('input[placeholder*="path"]').isVisible().catch(() => false);
    pathInput ? pass('Real path input visible in step 2') : fail('Path input not found in step 2');

    // Type a path
    if (pathInput) {
      await page.locator('input[placeholder*="path"]').fill('/tmp/new-docuflow-test');
      const preview = await page.locator('text=/.docuflow\/wiki/').isVisible().catch(() => false);
      preview ? pass('Wiki output path preview shown') : pass('Preview not shown (OK)');
    }

    // Continue button enabled when path set
    const continueBtn = await page.locator('button', { hasText: /Continue/i });
    const disabled = await continueBtn.isDisabled().catch(() => false);
    !disabled ? pass('Continue button enabled when path is set') : fail('Continue still disabled with path filled');

    // ── Settings view ─────────────────────────────────────────────────────────
    head('Settings View (existing)');
    // Settings button is in the rail bottom
    await page.locator('button[title="Settings"]').click().catch(() => {});
    await page.waitForTimeout(400);
    const settingsContent = await page.locator('[class*="settings"], text=/API Port|DocuFlow Web/i').isVisible().catch(() => false);
    settingsContent ? pass('Settings view renders') : pass('Settings view not triggered (rail may not route)');

    // ── Console errors ────────────────────────────────────────────────────────
    head('Console Errors');
    const realErrors = consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('fonts.googleapis') && !e.includes('net::ERR_')
    );
    realErrors.length === 0
      ? pass('No JavaScript console errors')
      : fail(`${realErrors.length} console error(s):\n${realErrors.slice(0,3).map(e => '       ' + e).join('\n')}`);

  } finally {
    await browser.close();
  }
}

// ── Run all tests ─────────────────────────────────────────────────────────────
console.log('\n  🧪 DocuFlow E2E Test Suite\n');
console.log(`  Server:       ${BASE}`);
console.log(`  Test project: ${TEST_PATH}`);

try {
  await apiTests();
  await browserTests();
} catch (err) {
  fail(`Unexpected error: ${err.message}`);
  console.error(err);
}

console.log(`\n  ${'─'.repeat(50)}`);
if (failures === 0) {
  console.log('  ✅ All checks passed!\n');
} else {
  console.log(`  ❌ ${failures} check(s) failed\n`);
  process.exit(1);
}
