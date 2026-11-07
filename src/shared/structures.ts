import type { LOAD_NODE_IDS, PANEL_IDS } from './constants';

export type PanelId = (typeof PANEL_IDS)[number];
export type LoadNodeId = (typeof LOAD_NODE_IDS)[number];
export type NodeId = string;
export type MemberId = string;
export type StockId = string;

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export interface TrussNode {
  readonly id: NodeId;
  readonly xMm: number;
  readonly yMm: number;
  readonly restrained: { readonly x: boolean; readonly y: boolean };
}

export interface Stock {
  readonly id: StockId;
  readonly elasticModulusNPerMm2: number;
  readonly areaMm2: number;
}

export interface Member {
  readonly id: MemberId;
  readonly startNodeId: NodeId;
  readonly endNodeId: NodeId;
  readonly stockId: StockId;
}

export interface Design {
  readonly id: string;
  readonly presetVersion: string;
  readonly nodes: readonly TrussNode[];
  readonly members: readonly Member[];
  readonly stocks: readonly Stock[];
}

/** General point load supports the independent analytic triangle fixture. */
export interface LoadCase {
  readonly nodeId: NodeId;
  readonly fxN: number;
  readonly fyN: number;
}

/** The judging UI permits only these nodes and this fixed magnitude. */
export interface Load extends LoadCase {
  readonly nodeId: LoadNodeId;
  readonly fxN: 0;
  readonly fyN: -10;
}

export interface Analysis {
  readonly status: 'ok';
  readonly solverVersion: string;
  readonly displacementMmByNode: Readonly<Record<NodeId, Vector2>>;
  readonly reactionNByNode: Readonly<Record<NodeId, Vector2>>;
  /** Positive = tension; negative = compression. */
  readonly axialForceNByMember: Readonly<Record<MemberId, number>>;
  readonly loadedJointDisplacementMm: number;
}

export type AnalysisErrorCode =
  | 'INVALID_INPUT'
  | 'MISSING_ENDPOINT'
  | 'DUPLICATE_MEMBER'
  | 'ZERO_LENGTH_MEMBER'
  | 'INVALID_STOCK'
  | 'UNSTABLE'
  | 'NUMERICAL_FAILURE';

/** Error results intentionally carry no analysis or ranking payload. */
export interface AnalysisError {
  readonly status: 'error';
  readonly code: AnalysisErrorCode;
  readonly message: string;
  readonly nodeIds: readonly NodeId[];
  readonly memberIds: readonly MemberId[];
}

export type AnalysisResult = Analysis | AnalysisError;

export type DeflectionChange =
  | { readonly kind: 'relative'; readonly reductionMm: number; readonly reductionPercent: number }
  | { readonly kind: 'absolute-only'; readonly reductionMm: number };

export interface BraceCandidate {
  readonly panelId: PanelId;
  readonly design: Design;
  readonly analysis: Analysis;
  readonly change: DeflectionChange;
}

export interface RankedBraces {
  readonly status: 'ok';
  readonly load: Load;
  readonly baseline: { readonly design: Design; readonly analysis: Analysis };
  readonly candidates: Readonly<Record<PanelId, BraceCandidate>>;
  readonly bestIds: readonly PanelId[];
}

export type RankingResult = RankedBraces | AnalysisError;

/** A committed result is a deep snapshot, never a view onto live controls. */
export interface Trial {
  readonly id: string;
  readonly roundId: string;
  readonly presetVersion: string;
  readonly solverVersion: string;
  readonly load: Load;
  readonly chosenPanelId: PanelId;
  readonly results: RankedBraces;
}

export interface Retest {
  readonly sourceTrialId: string;
  readonly load: Load;
  readonly chosenPanelId: PanelId;
  readonly results: RankedBraces;
}
