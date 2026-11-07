/**
 * Minimal input shape for drawModel. ModelView adapts the app's Design/Analysis into it, so the
 * renderer stays independent of the app contracts and of the engines.
 */
export type NodeId = string;
export type PanelId = string;
export interface Vector2 { readonly x: number; readonly y: number }
export interface TrussNode extends Vector2 { readonly id: NodeId }
export interface DrawMember {
  readonly id: string;
  readonly startNodeId: NodeId;
  readonly endNodeId: NodeId;
}
export interface Design {
  readonly nodes: readonly TrussNode[];
  readonly members: readonly DrawMember[];
  readonly supports: readonly { readonly nodeId: NodeId; readonly fixedX: boolean; readonly fixedY: boolean }[];
  readonly braceOptions: readonly { readonly panelId: PanelId; readonly label: string; readonly member: DrawMember }[];
}
export interface AnalysisSuccess {
  readonly displacementsMm: Readonly<Record<NodeId, Vector2>>;
  readonly memberForcesN: Readonly<Record<string, number>>;
}
