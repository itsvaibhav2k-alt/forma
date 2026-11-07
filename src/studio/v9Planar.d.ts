export interface PlanarNode { id: string; x: number; y: number; ux: number; uy: number }
export interface PlanarMember { id: string; a: number; b: number; extra: boolean; force: number }
export interface PlanarSolution { nodes: PlanarNode[]; members: PlanarMember[]; reactions: Record<string, { x: number; y: number }> }
export interface PlanarOptions {
  width: number; height: number; load: number; brace: number; locked: boolean;
  layer: 'deformation' | 'forces' | 'layout'; original: PlanarSolution; modified: PlanarSolution;
  member: string | null; showOriginal: boolean; showModified: boolean;
  showLabels: boolean; showGrid: boolean; showDimensions: boolean; zoom: number; panX: number; panY: number;
  onPick: (panel: number) => void; onLoad: (joint: number) => void; onMember: (key: string) => void;
}
export function renderPlanarV4(svg: SVGSVGElement, state: PlanarOptions): void;
