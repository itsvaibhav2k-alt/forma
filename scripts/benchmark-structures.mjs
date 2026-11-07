import { performance } from 'node:perf_hooks';
import { createServer } from 'vite';

// Separate from correctness tests: a shared runner's timing should not make CI flaky.
// Uses production modules; never loads the independent regression fixtures.
const server = await createServer({ server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
try {
  const { createBridgePreset, rankBraces } = await server.ssrLoadModule('/src/structures/index.ts');
  const design = createBridgePreset();
  const loads = ['B1', 'B2', 'B3'].map(nodeId => ({ nodeId, fxN: 0, fyN: -10 }));
  const timings = [];
  const warmups = 300;
  const samples = 3000;
  for (let i = 0; i < warmups + samples; i += 1) {
    const start = performance.now();
    const result = rankBraces(design, loads[i % loads.length]);
    const elapsed = performance.now() - start;
    if (result.status !== 'ok') throw new Error(result.message);
    if (i >= warmups) timings.push(elapsed);
  }
  timings.sort((a, b) => a - b);
  const percentile = p => timings[Math.ceil(p * timings.length) - 1];
  const p95 = percentile(0.95);
  console.log(JSON.stringify({
    runtime: process.version, platform: `${process.platform}/${process.arch}`, samples, warmups,
    operation: 'baseline + four independent candidate solves + validation + immutable ranking snapshot',
    medianMs: percentile(0.5), p95Ms: p95, p99Ms: percentile(0.99), maxMs: timings.at(-1),
    p95TargetMs: 8, meetsTarget: p95 < 8,
    scope: 'Local Node/Vite module benchmark; presentation-laptop and browser input-to-paint latency remain separate Phase 6 checks.',
  }, null, 2));
} finally {
  await server.close();
}
