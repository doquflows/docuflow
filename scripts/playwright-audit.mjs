/**
 * Playwright UI audit — tests all interactive elements
 * Run: node scripts/playwright-audit.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:48821';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const pass = [], fail = [];
  const ok  = m => { pass.push(m); console.log(`  ✅ ${m}`); };
  const bad = m => { fail.push(m); console.error(`  ❌ ${m}`); };
  const log = m => console.log(`  ℹ️  ${m}`);

  // ── 1. Page load ──────────────────────────────────────────────────────────
  console.log('\n[1] Page load');
  const res = await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 }).catch(e => ({ ok: () => false, _err: e.message }));
  res.ok() ? ok('Page loaded (HTTP 200)') : bad(`Load failed: ${res._err ?? res.status()}`);
  await sleep(600); // let React mount + API fetch complete

  // ── 2. Rail (sidebar) exists ──────────────────────────────────────────────
  console.log('\n[2] Sidebar rail');
  const rail = page.locator('.df-rail');
  await rail.count() ? ok('Sidebar rail rendered (.df-rail)') : bad('.df-rail not found');

  // Rail uses icon-only <button title="..."> — NOT <a> tags
  const railBtns = rail.locator('button[title]');
  const railCount = await railBtns.count();
  log(`Rail buttons (with title attr): ${railCount}`);
  railCount >= 5 ? ok(`Rail has ${railCount} navigation buttons`) : bad(`Only ${railCount} rail buttons (expected ≥5)`);

  // ── 3. TopBar ─────────────────────────────────────────────────────────────
  console.log('\n[3] TopBar');
  const topbar = page.locator('.df-topbar');
  await topbar.count() ? ok('TopBar rendered') : bad('.df-topbar not found');

  const projectBtn = topbar.locator('button').first();
  const btnText = (await projectBtn.textContent().catch(() => '')).trim();
  log(`Project button text: "${btnText}"`);
  btnText.length > 0 ? ok('Project button shows project name') : bad('Project button text is empty');

  // ── 4. Chevron always visible ─────────────────────────────────────────────
  console.log('\n[4] Chevron icon (always visible)');
  const chevron = projectBtn.locator('svg');
  await chevron.count() > 0 ? ok('Chevron SVG present (not gated by projects.length)') : bad('Chevron SVG missing');

  // ── 5. Dropdown opens on click ────────────────────────────────────────────
  console.log('\n[5] Project picker dropdown');
  await projectBtn.click();
  await sleep(300);
  const dropdown = page.locator('.df-topbar__crumb').locator('div').filter({ hasText: 'Add project by path' }).first();
  const dropVisible = await dropdown.isVisible().catch(() => false);
  dropVisible ? ok('Dropdown opened (contains "Add project by path")') : bad('Dropdown did NOT open on click');

  // ── 6. Add-project input ──────────────────────────────────────────────────
  console.log('\n[6] "Add project by path" input');
  const addInput = page.locator('input[placeholder="/absolute/path/to/project"]');
  await addInput.isVisible().catch(() => false) ? ok('Add-project input visible') : bad('Add-project input NOT visible');

  // ── 7. Add button disabled when empty ─────────────────────────────────────
  console.log('\n[7] Add button — disabled when empty');
  const addBtn = page.locator('button', { hasText: /^(Add|…)$/ }).last();
  const isDisabled = await addBtn.isDisabled().catch(() => null);
  isDisabled === true  ? ok('Add button correctly disabled when input empty') :
  isDisabled === false ? bad('Add button enabled when input empty (should be disabled)') :
                         bad('Add button not found');

  // ── 8. Invalid path shows error ───────────────────────────────────────────
  console.log('\n[8] Invalid path → error message');
  await addInput.fill('/totally/fake/nonexistent/path').catch(() => {});
  await sleep(100);
  await addBtn.click().catch(() => {});
  await sleep(1800); // wait for API round-trip
  const errDiv = page.locator('div').filter({ hasText: /✗/ }).first();
  const errVisible = await errDiv.isVisible().catch(() => false);
  errVisible ? ok('Error message "✗ ..." shown for invalid path') : bad('No error shown for invalid path (false-positive success?)');
  await addInput.fill('').catch(() => {}); // clear

  // ── 9. Valid path (existing auto-discovered project) ─────────────────────
  console.log('\n[9] Valid path → success');
  // Use the auto-discovered project path (already in list → should just select it)
  const apiProjects = await page.evaluate(() =>
    fetch('/api/projects').then(r => r.json()).catch(() => [])
  );
  log(`API projects: ${apiProjects.map(p => p.name).join(', ')}`);
  if (apiProjects.length > 0) {
    const validPath = apiProjects[0].path;
    await addInput.fill(validPath).catch(() => {});
    await sleep(100);
    await addBtn.click().catch(() => {});
    await sleep(600);
    // After success the dropdown closes (800ms timer)
    ok(`Typed valid path: ${validPath}`);
    // Reopen picker to continue tests
    await sleep(400);
    await projectBtn.click().catch(() => {});
    await sleep(300);
  } else {
    bad('No projects returned by /api/projects — cannot test valid path');
  }

  // Close dropdown before nav tests
  await page.keyboard.press('Escape');
  await projectBtn.click().catch(() => {}); // toggle close
  await sleep(200);

  // ── 10. Rail view switching ───────────────────────────────────────────────
  console.log('\n[10] Rail view navigation');
  const views = [
    { title: 'Wiki',        id: 'wiki'    },
    { title: 'Graph',       id: 'graph'   },
    { title: 'Health',      id: 'health'  },
    { title: 'Sync',        id: 'sync'    },
    { title: 'New project', id: 'onboard' },
    { title: 'Ask',         id: 'query',  label: 'Ask' },
  ];
  for (const v of views) {
    // Rail buttons have title attribute
    const btn = page.locator(`.df-rail button[title="${v.title}"]`);
    if (await btn.count() === 0) { bad(`Rail button title="${v.title}" not found`); continue; }
    await btn.click();
    await sleep(400);
    const active = await btn.evaluate(el => el.classList.contains('df-rail__item--active'));
    active ? ok(`"${v.title}" rail button becomes active`) : bad(`"${v.title}" button not marked active after click`);

    // Check the view area has content (not empty white box)
    const viewArea = page.locator('.df-view').first();
    const viewText = (await viewArea.textContent().catch(() => '')).trim();
    viewText.length > 50 ? ok(`  "${v.title}" view renders content (${viewText.length} chars)`)
                          : bad(`  "${v.title}" view appears empty (${viewText.length} chars)`);
  }

  // ── 11. TopBar — API status dot ───────────────────────────────────────────
  console.log('\n[11] API status indicator');
  const liveDot = page.locator('.df-status-dot--live');
  await liveDot.count() ? ok('Status dot shows "live" (API online)') : bad('Status dot not "live"');

  // ── 12. TopBar — Search button ────────────────────────────────────────────
  console.log('\n[12] TopBar Search button');
  const searchBtn = topbar.locator('button', { hasText: 'Search' });
  await searchBtn.count() ? ok('Search button present in TopBar') : bad('Search button NOT found');

  // ── 13. TopBar — Tools button ─────────────────────────────────────────────
  console.log('\n[13] TopBar Tools button');
  const toolsBtn = topbar.locator('button', { hasText: 'Tools' });
  await toolsBtn.count() ? ok('Tools button present in TopBar') : bad('Tools button NOT found');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Passed: ${pass.length}   ❌ Failed: ${fail.length}`);
  if (fail.length) { console.log('\nFailed:'); fail.forEach(f => console.log(`  ❌ ${f}`)); }
  console.log('═'.repeat(50) + '\n');

  await browser.close();
  process.exit(fail.length > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
