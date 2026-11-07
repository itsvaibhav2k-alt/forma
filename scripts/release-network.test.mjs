// Explicit optional check: requires permission to bind local ports. Not part of the sandbox-safe suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { createReleaseServer, startRelease } from './release-server.mjs';

test('launcher binds loopback, serves HTTP and rejects an occupied port', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'forma-network-test-'));
  await writeFile(join(directory, 'index.html'), '<h1>Forma network probe</h1>');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const server = createReleaseServer(directory);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(done => { server.closeAllConnections(); server.close(done); }));
  const address = server.address();
  assert.equal(address.address, '127.0.0.1');
  const response = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<h1>Forma network probe</h1>');
  await assert.rejects(startRelease(directory, address.port), { code: 'EADDRINUSE' });
});
