import { expectTypeOf, it } from 'vitest';
import type {
  AnalysisResult, Analyze, BraceRankingResult, CommitPrediction, CommitPredictionResult,
  CompareQuotes, FinanceResult, InvalidResult, PredictingState, RankBraces,
} from '../src/shared';

it('locks public calculation return types to discriminated data-only results', () => {
  expectTypeOf<ReturnType<Analyze>>().toEqualTypeOf<AnalysisResult>();
  expectTypeOf<ReturnType<RankBraces>>().toEqualTypeOf<BraceRankingResult>();
  expectTypeOf<ReturnType<CommitPrediction>>().toEqualTypeOf<CommitPredictionResult>();
  expectTypeOf<ReturnType<CompareQuotes>>().toEqualTypeOf<FinanceResult>();
  expectTypeOf<Extract<AnalysisResult, { status: 'invalid' }>>().toEqualTypeOf<InvalidResult>();
  expectTypeOf<Extract<BraceRankingResult, { status: 'invalid' }>>().toEqualTypeOf<InvalidResult>();
});

/** Negative compile checks run by typecheck, without invoking invalid operations. */
function enforceUnrevealedAndInvalidBoundaries(invalid: InvalidResult, draft: PredictingState) {
  // @ts-expect-error Invalid results cannot carry old displacements.
  void invalid.displacementsMm;
  // @ts-expect-error Invalid results cannot carry old rankings.
  void invalid.alternatives;
  // @ts-expect-error A new draft round cannot expose a live ranking.
  void draft.currentResult;
  // @ts-expect-error History is append-only through the trial engine, not UI mutation.
  draft.history.push({});
  // @ts-expect-error UI cannot mutate the canonical load.
  draft.currentLoad.fyN = -2;
}
void enforceUnrevealedAndInvalidBoundaries;
