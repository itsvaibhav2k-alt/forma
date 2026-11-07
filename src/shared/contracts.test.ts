import { expectTypeOf, it } from 'vitest';
import type { AmountInput, AnalysisError, AnalysisResult, Load, LoadCase, PredictionRound, Trial } from './index';
import type { Analyze } from '../structures';
import type { CompareQuotes } from '../community/costs';
import type { BuildDecisionSheet } from '../community/report';

it('keeps generic solver loads separate from fixed judging controls', () => {
  expectTypeOf<Load['nodeId']>().toEqualTypeOf<'B1' | 'B2' | 'B3'>();
  expectTypeOf<Load['fyN']>().toEqualTypeOf<-10>();
  expectTypeOf<LoadCase['fyN']>().toEqualTypeOf<number>();
  expectTypeOf<Analyze>().returns.toEqualTypeOf<AnalysisResult>();
});

it('shares port signatures across module boundaries', () => {
  expectTypeOf<CompareQuotes>().parameter(0).toHaveProperty('packages');
  expectTypeOf<BuildDecisionSheet>().parameter(0).toHaveProperty('trial');
  expectTypeOf<Trial['results']['candidates']>().toHaveProperty('P4');
});

it('keeps failure, unknown and hidden states free of misleading values', () => {
  expectTypeOf<AnalysisError>().not.toHaveProperty('loadedJointDisplacementMm');
  expectTypeOf<Extract<AmountInput, { status: 'unknown' }>>().not.toHaveProperty('usd');
  expectTypeOf<Extract<PredictionRound, { phase: 'predicting' }>>().not.toHaveProperty('results');
});

/** These negative checks are evaluated by npm run typecheck, never executed. */
function enforceReadonlyContracts(trial: Trial): void {
  // @ts-expect-error Saved load must not mutate with live controls.
  trial.load.nodeId = 'B2';
  // @ts-expect-error Saved candidates must not acquire new members in place.
  trial.results.candidates.P1.design.members.push({});
}
void enforceReadonlyContracts;
