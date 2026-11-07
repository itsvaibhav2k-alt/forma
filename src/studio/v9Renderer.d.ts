/** Typed boundary around the handoff's pure presentation renderer. */
export interface V9Node { id: string; x: number; y: number }
export interface V9Member { id: string; a: number; b: number; extra: boolean; force: number }
export interface V9Solution { nodes: V9Node[]; members: V9Member[] }
export interface V9RenderOptions {
  instanceId: string;
  width: number;
  height: number;
  pick: number;
  load: number;
  lift: boolean | number;
  orbit: number;
  pitch?: number;
  zoom: number;
  panX: number;
  panY: number;
  detail: boolean;
  locked: boolean;
  solution: V9Solution;
  referenceMember?: V9Member;
  referenceLayer?: 'forces' | 'layout';
  isolatedPart?: string;
  showLabels: boolean;
  showDimensions: boolean;
}
export interface V9LightingGeometry {
  width: number; height: number; azimuth: number; elevation: number;
  origin: number[]; axes: number[][];
  faces: { vertices: number[][]; color: string; extra: string }[];
}
export function createV9LightingWorker(): Worker;
export function renderV9Assembly(options: V9RenderOptions): { svgInner: string; viewBox: string; ariaLabel: string; lighting: V9LightingGeometry | null };
