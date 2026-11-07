import { describe, expect, it } from 'vitest';
import type { Reading, ReportInputs } from '../../shared';
import { commitPrediction, DEFAULT_LOAD } from '../../app/experiment/state';
import { createBridgePreset, rankBraces } from '../../structures';
import { compareQuotes } from '../costs';
import { fictionalQuoteDraft, quoteInputsFromDraft } from '../costs/draft';
import { buildDecisionSheet } from './buildDecisionSheet';

const time = '2026-11-07T17:30:00.000Z';
function inputs(): ReportInputs {
  const results = rankBraces(createBridgePreset(), DEFAULT_LOAD);
  if (results.status !== 'ok') throw new Error('Expected working preset');
  const trial = commitPrediction({ trialId: 'saved-b1', roundId: 'round-1', presetVersion: results.baseline.design.presetVersion, load: DEFAULT_LOAD, chosenPanelId: 'P2', results });
  const load = { ...DEFAULT_LOAD, nodeId: 'B2' as const };
  const retestResults = rankBraces(results.baseline.design, load);
  if (retestResults.status !== 'ok') throw new Error('Expected working retest');
  const quotes = quoteInputsFromDraft(fictionalQuoteDraft());
  return { trial, retest: { sourceTrialId: trial.id, chosenPanelId: 'P2', load, results: retestResults }, quotes, costs: compareQuotes(quotes), readings: [], assumptions: ['Verify supplier delivery terms.'] };
}
const reading = (data: ReportInputs): Reading => ({ id: 'reading-1', designId: data.trial.results.candidates.P2.design.id, presetVersion: data.trial.presetVersion, appliedLoad: DEFAULT_LOAD, measuredNodeId: 'B1', displacement: 0.04, units: 'mm', method: 'Dial indicator', instrumentResolution: 0.01, rawReadings: [0.03, 0.04, 0.05], assessment: 'inconclusive', notes: 'Joint slip not characterized.' });

describe('immutable report builder', () => {
  it('captures B1 independently from an included B2 retest with full-precision costs and metadata', () => {
    const data = inputs();
    const report = buildDecisionSheet(data, 'report-1', time);
    expect(report.trial.load.nodeId).toBe('B1');
    expect(report.trial.results.candidates.P2.change).toMatchObject({ kind: 'relative', reductionPercent: expect.closeTo(1.087, 2) });
    expect(report.retest?.load.nodeId).toBe('B2');
    expect(report.retest?.results.bestIds).toEqual(['P2', 'P3']);
    expect(report).toMatchObject({ schemaVersion: 1, reportId: 'report-1', createdAtIso: time });
    expect(report.costs).toEqual(data.costs);
    expect(report.assumptions).toContain('Verify supplier delivery terms.');
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it('deep-copies and freezes every input, including readings and notes', () => {
    const data = structuredClone(inputs()) as any;
    data.readings.push(reading(data));
    const report = buildDecisionSheet(data, 'report-1', time);
    const before = JSON.stringify(report);
    data.trial.results.candidates.P2.analysis.axialForceNByMember['brace-P2'] = 999;
    data.retest.load.nodeId = 'B3'; data.quotes.packages[0].materials.usd = 1;
    data.readings[0].rawReadings[0] = 99; data.assumptions[0] = 'Changed';
    expect(JSON.stringify(report)).toBe(before);
    expect(Object.isFrozen(report.readings[0]!.rawReadings)).toBe(true);
    expect(Object.isFrozen(report.trial.results.candidates.P2.analysis)).toBe(true);
    expect(Object.isFrozen(report.quotes.packages)).toBe(true);
    expect(report).not.toBe(data);
  });

  it('allows unknown inputs and no retest without substituting zeros', () => {
    const data = inputs();
    const quotes = { ...data.quotes, packages: [data.quotes.packages[0], { ...data.quotes.packages[1], annualUpkeep: { status: 'unknown' as const, note: 'Awaiting upkeep estimate.' } }] as const };
    const report = buildDecisionSheet({ ...data, retest: null, quotes, costs: compareQuotes(quotes) }, 'report-1', time);
    expect(report.retest).toBeNull();
    expect(report.costs).toMatchObject({ packages: [{}, { upfront: { status: 'known', usd: 21000 }, presentCost: { status: 'unknown' } }] });
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it('rejects stale financial results and invalid drafts', () => {
    const data = inputs();
    expect(() => buildDecisionSheet({ ...data, quotes: { ...data.quotes, years: 5 } }, 'report-1', time)).toThrow('do not match');
    expect(() => buildDecisionSheet({ ...data, quotes: { ...data.quotes, years: -1 } }, 'report-1', time)).toThrow('financial input');
    expect(() => buildDecisionSheet({ ...data, quotes: { ...data.quotes, realRate: NaN } }, 'report-1', time)).toThrow('finite');
  });

  it.each([
    ['trial load', (data: any) => { data.trial.load.nodeId = 'B3'; }],
    ['solver', (data: any) => { data.trial.solverVersion = 'different'; }],
    ['preset', (data: any) => { data.trial.presetVersion = 'different'; }],
    ['retest source', (data: any) => { data.retest.sourceTrialId = 'other'; }],
    ['retest brace', (data: any) => { data.retest.chosenPanelId = 'P1'; }],
    ['retest geometry', (data: any) => { data.retest.results.candidates.P2.design.nodes[0].xMm += 1; }],
    ['missing force', (data: any) => { delete data.trial.results.candidates.P2.analysis.axialForceNByMember['brace-P2']; }],
    ['missing displacement', (data: any) => { delete data.trial.results.baseline.analysis.displacementMmByNode.B1; }],
    ['nonfinite force', (data: any) => { data.trial.results.candidates.P2.analysis.axialForceNByMember['brace-P2'] = Infinity; }],
  ])('rejects inconsistent %s', (_name, edit) => {
    const data = structuredClone(inputs()); edit(data);
    expect(() => buildDecisionSheet(data, 'report-1', time)).toThrow();
  });

  it('checks reading association, uniqueness, resolution and raw numbers', () => {
    const data = inputs(), valid = reading(data);
    expect(buildDecisionSheet({ ...data, readings: [valid] }, 'report-1', time).readings).toEqual([valid]);
    for (const bad of [{ ...valid, designId: 'wrong' }, { ...valid, measuredNodeId: 'missing' }, { ...valid, presetVersion: 'wrong' }, { ...valid, instrumentResolution: 0 }, { ...valid, rawReadings: [NaN] }]) {
      expect(() => buildDecisionSheet({ ...data, readings: [bad] }, 'report-1', time)).toThrow();
    }
    expect(() => buildDecisionSheet({ ...data, readings: [valid, valid] }, 'report-1', time)).toThrow('unique');
    expect(() => buildDecisionSheet({ ...data, retest: null, readings: [{ ...valid, appliedLoad: data.retest!.load }] }, 'report-1', time)).toThrow('measurement must match');
  });

  it('requires explicit identity/time and deduplicates mandatory assumptions', () => {
    const data = inputs();
    expect(() => buildDecisionSheet(data, '', time)).toThrow('ID');
    expect(() => buildDecisionSheet(data, 'id', 'not a date')).toThrow('timestamp');
    expect(() => buildDecisionSheet(data, 'id', '2026-02-30T00:00:00.000Z')).toThrow('timestamp');
    const first = buildDecisionSheet(data, 'one', time);
    const second = buildDecisionSheet(first, 'two', time);
    expect(second.assumptions).toEqual(first.assumptions);
  });
});
