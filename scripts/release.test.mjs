import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReleaseHandler, startRelease } from './release-server.mjs';
import { auditAssets, fileInventory, verifyCandidate } from './release-audit.mjs';

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'forma-release-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist/assets'), { recursive: true });
  await writeFile(join(root, 'dist/index.html'), '<link href="/assets/app.css" rel="stylesheet"><script type="module" src="/assets/app.js"></script>');
  await writeFile(join(root, 'dist/assets/app.js'), 'document.title = "Forma";');
  await writeFile(join(root, 'dist/assets/app.css'), 'body { color: black; }');
  return root;
}

test('production audit resolves local assets and inventories exact bytes', async t => {
  const root = await workspace(t);
  const result = await auditAssets(join(root, 'dist'));
  assert.equal(result.referencesChecked, 2);
  assert.equal(Object.keys(result.files).length, 3);
  assert.match(result.files['assets/app.js'].sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.totalBytes, Object.values(result.files).reduce((sum, entry) => sum + entry.bytes, 0));
});

test('asset audit rejects missing, external and escaping references', async t => {
  const root = await workspace(t);
  for (const reference of ['https://cdn.example.test/app.js', '//cdn.example.test/a.js', '/missing.js', '../outside.js']) {
    await writeFile(join(root, 'dist/index.html'), `<script src="${reference}"></script>`);
    await assert.rejects(auditAssets(join(root, 'dist')));
  }
  await writeFile(join(root, 'dist/index.html'), '<link href="/assets/app.css">');
  await writeFile(join(root, 'dist/assets/app.css'), '@import "https://fonts.example.test/font.css";');
  await assert.rejects(auditAssets(join(root, 'dist')), /Remote/);
});

test('candidate verification detects changed, extra and removed files', async t => {
  const root = await workspace(t);
  const original = 'document.title = "Forma";';
  await writeFile(join(root, 'candidate.json'), JSON.stringify({ schemaVersion: 1, files: await fileInventory(root) }));
  await verifyCandidate(root);
  await writeFile(join(root, '.DS_Store'), 'Finder metadata');
  await writeFile(join(root, 'desktop.ini'), 'Explorer metadata');
  await verifyCandidate(root);
  await writeFile(join(root, 'dist/assets/app.js'), 'changed');
  await assert.rejects(verifyCandidate(root), /checksum mismatch/);
  await writeFile(join(root, 'dist/assets/app.js'), original);
  await writeFile(join(root, 'extra.txt'), 'extra');
  await assert.rejects(verifyCandidate(root), /checksum mismatch/);
  await rm(join(root, 'extra.txt'));
  await rm(join(root, 'dist/assets/app.js'));
  await assert.rejects(verifyCandidate(root), /checksum mismatch/);
});

test('candidate inventory rejects symlinks', async t => {
  const root = await workspace(t);
  await symlink(join(root, 'dist/index.html'), join(root, 'dist/link.html'));
  await assert.rejects(fileInventory(root), /Symlinks/);
});

test('in-memory HTTP handler returns exact assets, MIME, CSP and missing-file errors', async t => {
  const root = await workspace(t);
  await writeFile(join(root, 'secret.txt'), 'outside-dist');
  const handler = createReleaseHandler(join(root, 'dist'));
  async function request(url, method = 'GET') {
    const result = { headers: {}, status: 0, body: '' };
    await handler({ url, method }, {
      setHeader: (key, value) => { result.headers[key.toLowerCase()] = value; },
      writeHead: (status, headers) => { result.status = status; for (const [key, value] of Object.entries(headers)) result.headers[key.toLowerCase()] = value; },
      end: body => { result.body = body?.toString() ?? ''; },
    });
    return result;
  }
  const html = await request('/');
  assert.equal(html.status, 200);
  assert.match(html.headers['content-type'], /text\/html/);
  assert.match(html.headers['content-security-policy'], /connect-src 'self'/);
  assert.equal(html.headers['cache-control'], 'no-store');
  const js = await request('/assets/app.js');
  assert.match(js.headers['content-type'], /text\/javascript/);
  assert.equal(js.body, 'document.title = "Forma";');
  assert.equal((await request('/assets/missing.js')).status, 404);
  assert.equal((await request('/%2e%2e%2fsecret.txt')).status, 404);
  assert.equal((await request('/', 'POST')).status, 405);
  assert.equal((await request('/', 'HEAD')).body, '');
  assert.equal((await request('/%zz')).status, 400);
});

test('launcher fails clearly for missing builds and invalid ports before listening', async t => {
  const root = await workspace(t);
  await assert.rejects(startRelease(join(root, 'absent'), 4173));
  await assert.rejects(startRelease(join(root, 'dist'), NaN), /PORT/);
  for (const port of [0, -1, 65536, 1.5]) await assert.rejects(startRelease(join(root, 'dist'), port), /PORT/);
});
