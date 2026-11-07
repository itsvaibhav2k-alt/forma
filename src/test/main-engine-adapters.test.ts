import { afterEach, expect, it, vi } from 'vitest';
import * as engineAnalysis from '../engines/main/analyze';
import * as engineRanking from '../engines/main/rankBraces';
import * as engineFinance from '../engines/main/finance';
import { analyze, createBridgePreset, rankBraces, SOLVER_VERSION } from '../structures';
import { compareQuotes } from '../community/costs';
import { fictionalQuoteDraft, quoteInputsFromDraft } from '../community/costs/draft';
import { PANEL_IDS, type Load, type QuoteInputs } from '../shared';

afterEach(() => vi.restoreAllMocks());
it.each(['B1', 'B2', 'B3'] as const)('routes %s through main and preserves every displacement, force, reaction and rank', nodeId => {
  const spy = vi.spyOn(engineRanking, 'rankBraces');
  const load: Load = { nodeId, fxN: 0, fyN: -10 };
  const result = rankBraces(createBridgePreset(), load);
  expect(spy).toHaveBeenCalledOnce();
  const [design, passedLoad] = spy.mock.calls[0]!;
  expect(passedLoad).toEqual(load);
  expect(design.stocks[0]).toMatchObject({ areaMm2: 10, elasticModulusNPerMm2: 10000 });
  expect(design.nodes.find(node => node.id === 'T4')).toEqual({ id: 'T4', x: 240, y: 40 });
  expect(design.supports).toEqual([{ nodeId: 'B0', fixedX: true, fixedY: true }, { nodeId: 'B4', fixedX: false, fixedY: true }]);
  const core = spy.mock.results[0]!.value as ReturnType<typeof engineRanking.rankBraces>;
  if (result.status !== 'ok' || core.status !== 'ok') throw new Error('Expected the fixed bridge to solve');
  expect(result.baseline.analysis).toMatchObject({ solverVersion: SOLVER_VERSION, displacementMmByNode: core.baseline.displacementsMm, reactionNByNode: core.baseline.reactionsN, axialForceNByMember: core.baseline.memberForcesN });
  for (const [index, panel] of PANEL_IDS.entries()) {
    const candidate = result.candidates[panel], original = core.alternatives[index]!;
    expect(candidate.analysis.displacementMmByNode).toEqual(original.analysis.displacementsMm);
    expect(candidate.analysis.axialForceNByMember).toEqual(original.analysis.memberForcesN);
    expect(candidate.analysis.reactionNByNode).toEqual(original.analysis.reactionsN);
    expect(candidate.change).toMatchObject({ reductionMm: original.deflection.reductionMm, reductionPercent: original.deflection.reductionPercent });
  }
  expect(result.bestIds).toEqual(core.bestPanelIds.map(id => `P${id.at(-1)}`));
  expect(Object.isFrozen(result.candidates.P2.analysis.displacementMmByNode)).toBe(true);
});

it('propagates main engine failure without a partial result or alternate solver', () => {
  const spy = vi.spyOn(engineAnalysis, 'analyze').mockReturnValue({ status: 'invalid', issues: [{ code: 'numerical-failure', path: 'members.brace-P2', message: 'Controlled main failure' }] });
  expect(analyze(createBridgePreset(), { nodeId: 'B1', fxN: 0, fyN: -10 })).toEqual({ status: 'error', code: 'NUMERICAL_FAILURE', message: 'Controlled main failure', nodeIds: [], memberIds: ['brace-P2'] });
  expect(spy).toHaveBeenCalledOnce();
});

it.each(['normal', 'unknown', 'zero', 'excess contribution'] as const)('routes %s finances through main and preserves its outputs and provenance', scenario => {
  const spy = vi.spyOn(engineFinance, 'compareQuotes');
  const base = quoteInputsFromDraft(fictionalQuoteDraft());
  const b = base.packages[1];
  const input: QuoteInputs = { ...base, packages: [base.packages[0], { ...b,
    ...(scenario === 'unknown' ? { annualUpkeep: { status: 'unknown' as const, note: 'Awaiting supplier' } } : {}),
    ...(scenario === 'zero' ? { annualUpkeep: { status: 'known' as const, usd: 0, source: { kind: 'user-estimate' as const, label: 'Synthetic QA zero' } } } : {}),
    ...(scenario === 'excess contribution' ? { cashContribution: { status: 'known' as const, usd: 30000, source: { kind: 'user-estimate' as const, label: 'Synthetic QA contribution' } } } : {}),
  }] };
  const result = compareQuotes(input);
  expect(spy).toHaveBeenCalledOnce();
  const [aQuote, bQuote, budget, years, rate] = spy.mock.calls[0]!;
  expect([budget, years, rate]).toEqual([20000, 10, 0.03]);
  expect(aQuote.purchase.source.kind).toBe('demonstration');
  if (scenario === 'unknown') expect(bQuote.annualUpkeep).toEqual({ amountUSD: null, source: { kind: 'unknown', label: 'Awaiting supplier' } });
  if (scenario === 'zero') expect(bQuote.annualUpkeep).toEqual({ amountUSD: 0, source: { kind: 'user-entered', label: 'Synthetic QA zero' } });
  const core = spy.mock.results[0]!.value as ReturnType<typeof engineFinance.compareQuotes>;
  if (result.status !== 'ok' || core.status !== 'ok') throw new Error('Expected a valid comparison');
  expect(result.annuityFactor).toBe(core.annuityFactor);
  const mapped = result.packages[1], original = core.quoteB;
  for (const [appAmount, mainAmount] of [[mapped.upfront, original.upfront], [mapped.fundingGap, original.fundingGap], [mapped.presentCost, original.discountedTotal]] as const) {
    expect(appAmount.status).toBe(mainAmount.status);
    if (appAmount.status === 'known' && mainAmount.status === 'known') expect(appAmount.usd).toBe(mainAmount.amountUSD);
  }
  if (result.breakEven.status === 'premium' && core.breakEven.status === 'premium') expect(result.breakEven.requiredAnnualSavingsUsd).toBe(core.breakEven.annualSavingsRequiredUSD);
});
