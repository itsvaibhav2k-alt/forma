/** Private main-engine boundary only; app/state contracts remain in src/shared.
 * Subset of main src/shared/types.ts at 9a9c2d816d38abfbcab10461e6571d8f591d89e7. */
export type NodeId = string;
export type MemberId = string;
export type StockId = string;
export type PresetVersion = string;
export type PanelId = 'panel-1' | 'panel-2' | 'panel-3' | 'panel-4';
export interface Vector2 { readonly x: number; readonly y: number }
export interface TrussNode extends Vector2 { readonly id: NodeId }
export interface Member {
  readonly id: MemberId;
  readonly startNodeId: NodeId;
  readonly endNodeId: NodeId;
  readonly stockId: StockId;
}
export interface Stock {
  readonly id: StockId;
  readonly areaMm2: number;
  readonly elasticModulusNPerMm2: number;
}
export interface Support {
  readonly nodeId: NodeId;
  readonly fixedX: boolean;
  readonly fixedY: boolean;
}
export interface BraceOption {
  readonly panelId: PanelId;
  readonly label: string;
  readonly member: Member;
}
export interface Design {
  readonly id: string;
  readonly presetVersion: PresetVersion;
  readonly nodes: readonly TrussNode[];
  readonly members: readonly Member[];
  readonly stocks: readonly Stock[];
  readonly supports: readonly Support[];
  readonly braceOptions: readonly BraceOption[];
}
export interface LoadCase {
  readonly nodeId: NodeId;
  readonly fxN: number;
  readonly fyN: number;
}
export interface Preset {
  readonly version: PresetVersion;
  readonly label: string;
  readonly design: Design;
  readonly loadNodeIds: readonly NodeId[];
  readonly defaultLoad: LoadCase;
}
export type IssueCode =
  | 'invalid-geometry' | 'missing-reference' | 'invalid-stock'
  | 'invalid-support' | 'invalid-load' | 'singular-system'
  | 'numerical-failure' | 'invalid-brace-options' | 'unknown-preset'
  | 'invalid-panel' | 'invalid-transition' | 'invalid-quote'
  | 'invalid-budget' | 'invalid-horizon' | 'invalid-rate';
export interface ValidationIssue {
  readonly code: IssueCode;
  readonly message: string;
  readonly path: string;
}
export interface InvalidResult {
  readonly status: 'invalid';
  readonly issues: readonly ValidationIssue[];
}
export interface AnalysisSuccess {
  readonly status: 'ok';
  readonly displacementsMm: Readonly<Record<NodeId, Vector2>>;
  /** Positive is tension; negative is compression. */
  readonly memberForcesN: Readonly<Record<MemberId, number>>;
  /** One entry per supported node; unrestrained components are zero. */
  readonly reactionsN: Readonly<Record<NodeId, Vector2>>;
}
export type AnalysisResult = AnalysisSuccess | InvalidResult;
export interface DeflectionChange {
  readonly baselineMm: number;
  readonly revisedMm: number;
  /** Positive is an improvement; can be negative. */
  readonly reductionMm: number;
  /** Null only when baselineMm is numerically zero. */
  readonly reductionPercent: number | null;
}
export interface BraceEvaluation {
  readonly panelId: PanelId;
  readonly design: Design;
  readonly analysis: AnalysisSuccess;
  readonly deflection: DeflectionChange;
}
export interface BraceRankingSuccess {
  readonly status: 'ok';
  readonly loadCase: LoadCase;
  readonly baselineDesign: Design;
  readonly baseline: AnalysisSuccess;
  readonly baselineDeflectionMm: number;
  /** Panel order, not sorted rank order. */
  readonly alternatives: readonly BraceEvaluation[];
  readonly bestPanelIds: readonly PanelId[];
}
export type BraceRankingResult = BraceRankingSuccess | InvalidResult;
export interface PriceSource {
  readonly kind: 'quoted' | 'user-entered' | 'demonstration' | 'unknown';
  readonly label: string;
}
export interface PriceInput {
  /** Explicit zero means free; null means unknown. USD throughout. */
  readonly amountUSD: number | null;
  readonly source: PriceSource;
}
export interface Quote {
  readonly id: string;
  readonly label: string;
  /** Matching, nonempty scopeId is required to compare packages. */
  readonly scopeId: string;
  readonly scopeLabel: string;
  readonly purchase: PriceInput;
  readonly delivery: PriceInput;
  readonly installation: PriceInput;
  /** Cash available now, applied once to upfront cost only. */
  readonly donation: PriceInput;
  readonly annualUpkeep: PriceInput;
}
export type Amount =
  | { readonly status: 'known'; readonly amountUSD: number }
  | { readonly status: 'unknown'; readonly missingFields: readonly string[] };
export interface QuoteSummary {
  readonly quoteId: string;
  readonly grossUpfront: Amount;
  readonly donationApplied: Amount;
  readonly upfront: Amount;
  readonly fundingGap: Amount;
  readonly annualUpkeep: Amount;
  readonly discountedTotal: Amount;
}
export type BreakEven =
  | { readonly status: 'unknown'; readonly missingFields: readonly string[] }
  | { readonly status: 'equal-upfront'; readonly premiumUSD: 0; readonly annualSavingsRequiredUSD: 0 }
  | {
      readonly status: 'premium';
      readonly higherUpfrontQuoteId: string;
      readonly lowerUpfrontQuoteId: string;
      readonly premiumUSD: number;
      readonly annualSavingsRequiredUSD: number;
    };
export interface FinanceSuccess {
  readonly status: 'ok';
  readonly annuityFactor: number;
  readonly quoteA: QuoteSummary;
  readonly quoteB: QuoteSummary;
  readonly breakEven: BreakEven;
}
export type FinanceResult = FinanceSuccess | InvalidResult;
export interface FinanceInputs {
  readonly quoteA: Quote;
  readonly quoteB: Quote;
  readonly budgetUSD: number;
  readonly years: number;
  /** Annual real discount rate as a decimal: 0.03 = 3%. */
  readonly rate: number;
}
export type Analyze = (design: Design, loadCase: LoadCase) => AnalysisResult;
export type RankBraces = (design: Design, loadCase: LoadCase) => BraceRankingResult;
export type CompareQuotes = (
  quoteA: Quote, quoteB: Quote, budget: number, years: number, rate: number,
) => FinanceResult;
