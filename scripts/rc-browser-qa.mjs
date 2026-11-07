// Opt-in host QA, outside the application's dependency graph. Supply a local
// @playwright/test module via PLAYWRIGHT_MODULE if it is not installed here.
// Run against a packaged candidate, never Vite. All observations are synthetic.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyCandidate } from './release-audit.mjs';
const { chromium, expect } = await import(process.env.PLAYWRIGHT_MODULE ?? '@playwright/test');
const candidate = resolve(process.argv[2] ?? JSON.parse(await readFile('output/releases/latest.json', 'utf8')).directory);
const manifest = await verifyCandidate(candidate);
const out = resolve('output/previews/rc-qa');
await mkdir(out, { recursive: true });
const port = Number(process.env.PORT ?? 4187), origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve(candidate, 'serve.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
const checks = [], errors = [], external = [], requests = [];
function passed(name) { checks.push(name); console.log(`PASS ${name}`); }
try {
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('Launcher startup timed out')), 10000);
    server.stdout.once('data', () => { clearTimeout(timer); done(); });
    server.once('error', reject);
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Launcher exited ${code}`)); });
    server.stderr.on('data', chunk => errors.push(`launcher: ${chunk}`));
  });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route('**/*', route => {
    const url = route.request().url(); requests.push(url);
    if (new URL(url).origin !== origin) { external.push(url); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
  const response = await page.goto(origin);
  assert.equal(response.status(), 200);
  assert.match(response.headers()['content-security-policy'], /connect-src 'self'/);
  passed('packaged launcher and same-origin CSP');
  const button = name => page.getByRole('button', { name, exact: true });
  const radio = name => page.getByRole('radio', { name, exact: true });
  async function tabTo(locator, limit = 100) {
    for (let i = 0; i < limit; i++) {
      if (await locator.evaluate(node => node === document.activeElement)) return;
      await page.keyboard.press('Tab');
    }
    throw new Error(`Keyboard did not reach ${locator}`);
  }
  async function download(name, file) {
    const pending = page.waitForEvent('download'); await button(name).click();
    const result = await pending; await result.saveAs(resolve(out, file));
    return readFile(resolve(out, file), 'utf8');
  }
  async function narrow(name) {
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375, `${name} document overflow`);
    await page.screenshot({ path: resolve(out, `${name}-375.png`), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await expect(page.getByText('Results hidden', { exact: true })).toBeVisible();
  await tabTo(radio('P1')); await page.keyboard.press('ArrowRight');
  await expect(radio('P2')).toBeChecked();
  await tabTo(button('Commit prediction')); await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('1.09%');
  await tabTo(page.getByRole('slider')); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('region', { name: 'Same-brace retest' })).toContainText('10.46%');
  const retest = await page.getByRole('region', { name: 'Same-brace retest' }).textContent();
  const history = page.getByRole('button', { name: /Trial 01 · Load B1/ });
  await tabTo(history); await page.keyboard.press('Enter');
  await expect(button('Back to current experiment')).toBeFocused();
  await expect(radio('B2 Center')).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(history).toBeFocused();
  assert.equal(await page.getByRole('region', { name: 'Same-brace retest' }).textContent(), retest);
  await button('Start another prediction').click(); await radio('P4').check(); await radio('B3 Right').check();
  await history.click(); await button('Back to current experiment').click();
  await expect(radio('P4')).toBeChecked(); await expect(radio('B3 Right')).toBeChecked();
  await expect(page.getByText('Results hidden', { exact: true })).toBeVisible();
  await narrow('experiment');
  await button('Commit prediction').click(); await radio('B2 Center').check();
  await history.click();
  await expect(page.getByRole('region', { name: 'History inspection' })).toContainText('Trial 01 · P2 at B1');
  passed('keyboard commit/retest/history/return, unfinished draft, multiple trials and hidden new round');

  await button('Compare build options').click(); await button('Load fictional example').click();
  const upkeep = page.getByLabel('Package B Annual upkeep (USD/year)', { exact: true });
  await upkeep.fill('');
  await expect(page.locator('.cost-summary-card').nth(1)).toContainText('Unknown');
  await expect(page.locator('.cost-summary-card').nth(1)).toContainText('$21,000.00');
  await upkeep.fill('0');
  await expect(page.locator('.cost-summary-card').nth(1).locator('.present-cost')).toContainText('$21,000.00');
  await expect(page.getByLabel('Package B Annual upkeep source type', { exact: true })).toHaveValue('user-estimate');
  await page.getByLabel('Package B Annual upkeep source reference', { exact: true }).fill('Synthetic QA zero-cost assumption');
  await upkeep.fill('-1'); await expect(page.getByRole('alert')).toContainText('Check the comparison inputs');
  await expect(page.locator('.cost-results')).toHaveCount(0);
  await button('Load fictional example').click();
  await page.getByLabel('Package B Cash contribution (USD)', { exact: true }).fill('30000');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.cost-summary-card').nth(1)).toContainText('$3,838.59');
  await expect(page.locator('.cost-summary-card').nth(1).locator('dd').first()).toContainText('$0.00');
  await button('Load fictional example').click();
  await page.getByLabel('Horizon (years)', { exact: true }).fill('');
  await expect(button('Decision sheet')).toBeDisabled();
  await page.getByLabel('Horizon (years)', { exact: true }).fill('10');
  await narrow('costs');
  await button('Experiment').click();
  await expect(page.getByRole('region', { name: 'Your prediction, tested' })).toContainText('1.09%');
  await button('Back to current experiment').click();
  await expect(page.getByRole('region', { name: 'Same-brace retest' })).toContainText('P4');
  await history.click();
  passed('unknown versus zero costs, source relabeling, invalid inputs and financial isolation');

  await button('Decision sheet').click();
  const sheet = page.getByRole('article', { name: 'Captured decision sheet' });
  await expect(sheet).toContainText('No measurement recorded.');
  await expect(sheet).not.toContainText('Scenario R');
  await expect(button('Print / Save PDF')).toBeEnabled();
  const normalSnapshot = JSON.parse(await download('Download snapshot JSON', 'decision-sheet.json'));
  assert.equal(normalSnapshot.trial.solverVersion, 'astra-truss-main-9a9c2d8');
  assert.equal(normalSnapshot.trial.chosenPanelId, 'P2'); assert.equal(normalSnapshot.trial.load.nodeId, 'B1'); assert.equal(normalSnapshot.retest, null);
  await page.pdf({ path: resolve(out, 'decision-sheet-letter.pdf'), preferCSSPageSize: true, printBackground: true, scale: 1 });
  await narrow('report');
  passed('historical report provenance and Letter decision-sheet PDF');
  await button('Experiment').click(); await button('Braced assembly template').click();
  const assembly = page.getByRole('article', { name: 'Captured assembly template' });
  await expect(assembly).toContainText(normalSnapshot.trial.id);
  await expect(button('Print assembly template')).toBeEnabled();
  const svg = await download('Download 1:1 SVG', 'assembly.svg');
  assert.match(svg, /width="254mm" height="100mm"/); assert.match(svg, /data-check-bar-mm="100"/);
  assert.equal((svg.match(/data-member-id=/g) ?? []).length, 18);
  await page.pdf({ path: resolve(out, 'assembly-letter-landscape.pdf'), preferCSSPageSize: true, printBackground: true, scale: 1 });
  await narrow('assembly');
  // Fault injection only: the fixed production preset cannot produce long footer content.
  await assembly.locator('footer').evaluate(node => { node.append(document.createTextNode('Synthetic QA long assembly annotation. '.repeat(300))); });
  await expect(button('Print assembly template')).toBeDisabled();
  await expect(assembly.locator('svg')).toHaveAttribute('width', '254mm');
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(assembly).toBeHidden(); await expect(page.getByRole('alert')).toBeVisible();
  await page.emulateMedia({ media: 'screen' }); await expect(assembly).toContainText('Synthetic QA long assembly annotation.');
  passed('Letter-landscape assembly PDF, SVG download and native-print overflow guard without geometry scaling');

  await button('Physical evidence').click();
  await page.getByLabel('Design and load case', { exact: true }).selectOption({ label: 'Saved B1 · With brace P2' });
  await button('Save measurement').click();
  await expect(page.getByRole('alert')).toContainText('at least one raw reading');
  await page.getByLabel('Raw vertical readings (one per line)', { exact: true }).fill('0\n0\n0');
  await page.getByLabel('Measurement method', { exact: true }).fill('Synthetic QA inputs — no physical test');
  await button('Save measurement').click(); await expect(page.getByRole('alert')).toContainText('physical test conditions');
  await page.getByLabel('Physical test conditions', { exact: true }).fill('Synthetic QA only; simulated zero readings, no apparatus or physical test.');
  await button('Save measurement').click();
  await expect(page.getByRole('article', { name: 'Measurement 1', exact: true })).toContainText('Resolution: unknown');
  await narrow('measurements');
  await button('Capture new sheet').click();
  await expect(sheet).toContainText('Synthetic QA');
  const frozen = await sheet.textContent();
  const measured = JSON.parse(await download('Download snapshot JSON', 'synthetic-measurement.json'));
  assert.deepEqual(measured.readings[0].rawReadings, [0, 0, 0]); assert.equal(measured.readings[0].instrumentResolution, null); assert.equal(measured.readings[0].assessment, 'unassessed');
  await button('Physical evidence').click(); await button('Remove measurement 1').click();
  await button('Compare build options').click(); await page.getByLabel('Horizon (years)', { exact: true }).fill('5');
  await button('Captured sheet').click(); assert.equal(await sheet.textContent(), frozen);
  passed('shared evidence rules in form, synthetic zero/unknown resolution, frozen report after measurement/cost edits');

  await button('Physical evidence').click();
  await page.getByLabel('Raw vertical readings (one per line)', { exact: true }).fill('0\n0\n0');
  const longEvidence = 'Synthetic QA long evidence, not a physical observation. '.repeat(150) + 'END OF SYNTHETIC EVIDENCE';
  await page.getByLabel('Physical test conditions', { exact: true }).fill(longEvidence);
  await button('Save measurement').click(); await button('Capture new sheet').click();
  await expect(button('Print / Save PDF')).toBeDisabled(); await expect(sheet).toContainText('END OF SYNTHETIC EVIDENCE');
  const longSnapshot = JSON.parse(await download('Download snapshot JSON', 'long-evidence.json'));
  assert.equal(longSnapshot.readings[0].notes, longEvidence);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(sheet).toBeHidden(); await expect(page.getByRole('alert')).toBeVisible();
  await page.emulateMedia({ media: 'screen' }); await expect(sheet).toBeVisible();
  passed('long evidence retained in full JSON/screen; app and native-print guards block overfull sheet');
  assert.deepEqual(external, []); assert.deepEqual(errors, []);
  await page.reload(); await expect(page.getByText('Results hidden', { exact: true })).toBeVisible();
  await expect(button('Captured sheet')).toHaveCount(0);
  await verifyCandidate(candidate);
  passed('reload clears session, no browser errors/warnings or external requests, package checksums unchanged');
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ candidateId: manifest.candidateId, source: manifest.source, node: process.version, browser: browser.version(), origin, checks, errors, external, requests: [...new Set(requests)], limitations: ['Headless Chromium on this host, not native print-dialog or presentation-laptop acceptance.', 'Synthetic QA only; no physical measurements or printer scale verification.', 'External requests intercepted and counted; no physical internet disconnection or timed rehearsal.'] }, null, 2));
} finally {
  await browser?.close(); server.kill();
}
