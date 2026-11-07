import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// Reproducible, frozen QA inputs through the production modules; never a runtime fallback.
// This prepares HTML/JSON for manual browser PDF checks, not an alternative PDF renderer.
const server = await createServer({ server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
try {
  const { createBridgePreset, rankBraces } = await server.ssrLoadModule('/src/structures/index.ts');
  const { commitPrediction } = await server.ssrLoadModule('/src/app/experiment/state.ts');
  const { fictionalQuoteDraft, quoteInputsFromDraft } = await server.ssrLoadModule('/src/community/costs/draft.ts');
  const { compareQuotes } = await server.ssrLoadModule('/src/community/costs/index.ts');
  const { buildDecisionSheet } = await server.ssrLoadModule('/src/community/report/buildDecisionSheet.ts');
  const { DecisionSheet } = await server.ssrLoadModule('/src/community/report/DecisionSheet.tsx');
  const design = createBridgePreset(), load = { nodeId: 'B1', fxN: 0, fyN: -10 };
  const results = rankBraces(design, load);
  if (results.status !== 'ok') throw new Error(results.message);
  const trial = commitPrediction({ trialId: 'qa-saved-b1-p2', roundId: 'qa-round-1', presetVersion: design.presetVersion, load, chosenPanelId: 'P2', results });
  const movedLoad = { ...load, nodeId: 'B2' }, movedResults = rankBraces(design, movedLoad);
  if (movedResults.status !== 'ok') throw new Error(movedResults.message);
  const retest = { sourceTrialId: trial.id, chosenPanelId: 'P2', load: movedLoad, results: movedResults };
  const baseQuotes = quoteInputsFromDraft(fictionalQuoteDraft());
  const missing = structuredClone(baseQuotes);
  missing.packages[1].annualUpkeep = { status: 'unknown', note: 'No amount entered' };
  missing.packages[0].label = 'Local material package with standard delivery and volunteer installation support';
  missing.packages[1].label = 'Regional material package with scheduled delivery and professional installation';
  const variants = [
    ['selected-trial', baseQuotes, null],
    ['with-retest', baseQuotes, retest],
    ['unknown-upkeep-long-labels', missing, retest],
  ];
  const css = await readFile('src/community/report/report.css', 'utf8');
  const srOnly = '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}';
  await mkdir('tmp/report-qa', { recursive: true });
  for (const [name, quotes, includedRetest] of variants) {
    const report = buildDecisionSheet({ trial, retest: includedRetest, quotes, costs: compareQuotes(quotes), readings: [], assumptions: [] }, `qa-${name}`, '2026-11-07T17:30:00.000Z');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Forma QA - ${name}</title><style>${srOnly}\n${css}</style></head><body><div class="report-actions"><p>QA sample: ${name}. Print on US Letter, portrait, 100%, browser headers and footers off. Verify one page. Generated from a frozen production report payload.</p></div><div class="report-preview">${renderToStaticMarkup(createElement(DecisionSheet, { report }))}</div></body></html>`;
    await writeFile(`tmp/report-qa/${name}.html`, html);
    await writeFile(`tmp/report-qa/${name}.json`, JSON.stringify(report, null, 2));
    console.log(`Prepared tmp/report-qa/${name}.html and .json`);
  }
} finally { await server.close(); }
