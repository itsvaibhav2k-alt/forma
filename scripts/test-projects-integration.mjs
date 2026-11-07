import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { createServer } from 'vite';

// Local only; credentials stay in memory and are never logged or written to disk.
const local = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(local.API_URL, 'http://127.0.0.1:55321', 'Integration tests only target Forma local Supabase.');
const options = { realtime: { transport: WebSocket }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, options);
const anon = createClient(local.API_URL, local.PUBLISHABLE_KEY ?? local.ANON_KEY, options);
const users = [];
const vite = await createServer({ server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
try {
  const { projectRepository } = await vite.ssrLoadModule('/src/projects/repository.ts');
  const { createExperimentState, commitPrediction } = await vite.ssrLoadModule('/src/app/experiment/state.ts');
  const { createBridgePreset, rankBraces } = await vite.ssrLoadModule('/src/structures/index.ts');
  const { fictionalQuoteDraft, quoteInputsFromDraft } = await vite.ssrLoadModule('/src/community/costs/draft.ts');
  const { compareQuotes } = await vite.ssrLoadModule('/src/community/costs/index.ts');
  const { buildDecisionSheet } = await vite.ssrLoadModule('/src/community/report/buildDecisionSheet.ts');
  const { buildAssemblyPattern } = await vite.ssrLoadModule('/src/community/template/pattern.ts');
  const { recordMeasurement, measurementCases } = await vite.ssrLoadModule('/src/community/measurements/engine.ts');
  async function account() {
    const client = createClient(local.API_URL, local.PUBLISHABLE_KEY ?? local.ANON_KEY, options);
    const email = `forma-test-${randomUUID()}@example.test`, password = randomUUID();
    const result = await client.auth.signUp({ email, password });
    assert.ifError(result.error); assert.ok(result.data.session); users.push(result.data.user.id);
    return { client, email, password };
  }
  const a = await account(), b = await account();
  const repoA = projectRepository(a.client), repoB = projectRepository(b.client);
  const design = createBridgePreset(), load = { nodeId: 'B1', fxN: 0, fyN: -10 };
  const results = rankBraces(design, load);
  const trial = commitPrediction({ trialId: randomUUID(), roundId: randomUUID(), presetVersion: design.presetVersion, load, chosenPanelId: 'P2', results });
  const quotes = fictionalQuoteDraft(), inputs = quoteInputsFromDraft(quotes);
  const observation = recordMeasurement({ measuredNodeId: 'B1', units: 'mm', raw: '0.04\n0.041\n0.039', resolution: '0.01', method: 'Synthetic integration test', notes: 'No physical test performed.' }, measurementCases(trial)[1], randomUUID());
  assert.equal(observation.status, 'ok');
  const readings = [observation.reading];
  const report = buildDecisionSheet({ trial, retest: null, quotes: inputs, costs: compareQuotes(inputs), readings, assumptions: [] }, randomUUID(), new Date().toISOString());
  const workspace = { schemaVersion: 1, experiment: { ...createExperimentState(randomUUID()), trials: [trial], selectedTrialId: trial.id, round: { phase: 'revealed', trialId: trial.id, roundId: trial.roundId } }, quotes, measurements: { readings, drafts: {}, selectedKey: '' }, report, pattern: buildAssemblyPattern(trial, true), includeRetest: false };
  const write = { id: randomUUID(), name: 'Integration test project', workspace, expectedVersion: null, writeId: randomUUID() };
  const created = await repoA.save(write); assert.equal(created.version, 1);
  const retried = await repoA.save(write); assert.equal(retried.version, 1); assert.equal((await repoA.list()).length, 1);
  assert.deepEqual((await repoA.open(created.id)).workspace, workspace);
  console.log('PASS create + retry + complete workspace round-trip (including report, readings and pattern)');

  const restored = createClient(local.API_URL, local.PUBLISHABLE_KEY ?? local.ANON_KEY, options);
  assert.ifError((await restored.auth.signInWithPassword({ email: a.email, password: a.password })).error);
  assert.equal((await projectRepository(restored).open(created.id)).workspace.report.reportId, report.reportId);
  console.log('PASS reopen from a new authenticated client');

  assert.deepEqual(await repoB.list(), []);
  await assert.rejects(repoB.open(created.id));
  await assert.rejects(repoB.save({ ...write, expectedVersion: 1, writeId: randomUUID() }));
  assert.deepEqual((await anon.from('projects').select('*')).data ?? [], []);
  assert.ok((await anon.rpc('save_project', { project_id: randomUUID(), project_name: 'denied', project_workspace: workspace, expected_version: null, write_id: randomUUID() })).error);
  assert.ok((await a.client.from('projects').update({ owner_id: users[1] }).eq('id', created.id)).error);
  assert.ok((await a.client.from('projects').insert({ id: randomUUID(), owner_id: users[1], name: 'denied', workspace, last_write_id: randomUUID() })).error);
  assert.ok((await a.client.from('projects').delete().eq('id', created.id)).error);
  console.log('PASS anonymous and cross-account denial; direct insert/update/delete blocked');

  const changes = await Promise.allSettled([repoA.save({ ...write, name: 'Tab one', expectedVersion: 1, writeId: randomUUID() }), repoA.save({ ...write, name: 'Tab two', expectedVersion: 1, writeId: randomUUID() })]);
  assert.equal(changes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(changes.filter(r => r.status === 'rejected').length, 1);
  assert.equal((await repoA.open(created.id)).project.version, 2);
  console.log('PASS concurrent writes: exactly one wins, stale version cannot overwrite');

  for (const invalid of [{}, { ...workspace, schemaVersion: 2 }, { ...workspace, extra: 'x'.repeat(2_100_000) }]) {
    const { error } = await a.client.rpc('save_project', { project_id: randomUUID(), project_name: 'invalid', project_workspace: invalid, expected_version: null, write_id: randomUUID() });
    assert.ok(error);
  }
  assert.ok((await a.client.rpc('save_project', { project_id: randomUUID(), project_name: ' ', project_workspace: workspace, expected_version: null, write_id: randomUUID() })).error);
  console.log('PASS database envelope, name and size constraints');

  const recoveryLink = await admin.auth.admin.generateLink({ type: 'recovery', email: b.email });
  assert.ifError(recoveryLink.error);
  const recovering = createClient(local.API_URL, local.PUBLISHABLE_KEY ?? local.ANON_KEY, options);
  assert.ifError((await recovering.auth.verifyOtp({ token_hash: recoveryLink.data.properties.hashed_token, type: 'recovery' })).error);
  const replacement = randomUUID();
  assert.ifError((await recovering.auth.updateUser({ password: replacement })).error);
  const recovered = createClient(local.API_URL, local.PUBLISHABLE_KEY ?? local.ANON_KEY, options);
  assert.ifError((await recovered.auth.signInWithPassword({ email: b.email, password: replacement })).error);
  console.log('PASS local recovery token and password update (disposable account only)');

  assert.ifError((await restored.auth.signOut()).error);
  await assert.rejects(projectRepository(restored).open(created.id));
  console.log('PASS signed-out session cannot reopen private work');
} finally {
  for (const id of users) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
  await vite.close();
  console.log('Local integration accounts and their project rows cleaned up.');
}
