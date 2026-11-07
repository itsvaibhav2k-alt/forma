import type { Design, Trial, TrussNode } from '../../shared';
import { snapshot } from '../../shared/snapshot';

export interface AssemblyPattern {
  readonly design: Design;
  readonly trialId: string;
  readonly label: string;
  readonly addedMemberId: string | null;
  readonly minX: number;
  readonly maxY: number;
  readonly spanMm: number;
  readonly heightMm: number;
  readonly members: readonly { id: string; start: string; end: string; lengthMm: number; group: string }[];
  readonly crossings: readonly { x: number; y: number; dx: number; dy: number }[];
}

export function buildAssemblyPattern(trial: Trial, braced: boolean): AssemblyPattern {
  const original = trial.results.baseline.design;
  const design = braced ? trial.results.candidates[trial.chosenPanelId].design : original;
  if (!design.nodes.length || design.nodes.some(node => !Number.isFinite(node.xMm) || !Number.isFinite(node.yMm))) throw new Error('Template geometry must contain finite node coordinates.');
  const nodes = new Map(design.nodes.map(node => [node.id, node]));
  if (nodes.size !== design.nodes.length) throw new Error('Template node IDs must be unique.');
  const minX = Math.min(...design.nodes.map(node => node.xMm)), maxX = Math.max(...design.nodes.map(node => node.xMm));
  const minY = Math.min(...design.nodes.map(node => node.yMm)), maxY = Math.max(...design.nodes.map(node => node.yMm));
  if (Math.abs(maxX - minX - 240) > 1e-6 || Math.abs(maxY - minY - 40) > 1e-6) throw new Error('This Letter pattern supports the fixed 240 × 40 mm preset only.');
  const additions = design.members.filter(member => !original.members.some(item => item.id === member.id));
  if (braced && additions.length !== 1) throw new Error('A braced pattern must contain exactly one added member.');
  const addedMemberId = additions[0]?.id ?? null;
  const endpoints = (id: string): TrussNode => { const node = nodes.get(id); if (!node) throw new Error('Template member endpoint is missing.'); return node; };
  const members = design.members.map(member => {
    const a = endpoints(member.startNodeId), b = endpoints(member.endNodeId);
    const lengthMm = Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
    if (!Number.isFinite(lengthMm) || lengthMm <= 0) throw new Error('Template member lengths must be positive and finite.');
    return { id: member.id, start: a.id, end: b.id, lengthMm, group: member.id === addedMemberId ? 'Added brace' : a.yMm === b.yMm ? 'Horizontal members' : a.xMm === b.xMm ? 'Vertical members' : 'Original diagonals' };
  });
  const crossings: { x: number; y: number; dx: number; dy: number }[] = [];
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
    const first = members[i]!, second = members[j]!;
    if ([first.start, first.end].some(id => id === second.start || id === second.end)) continue;
    const a = endpoints(first.start), b = endpoints(first.end), c = endpoints(second.start), d = endpoints(second.end);
    const rx = b.xMm - a.xMm, ry = b.yMm - a.yMm, sx = d.xMm - c.xMm, sy = d.yMm - c.yMm;
    const denominator = rx * sy - ry * sx;
    if (Math.abs(denominator) < 1e-12) continue;
    const t = ((c.xMm - a.xMm) * sy - (c.yMm - a.yMm) * sx) / denominator;
    const u = ((c.xMm - a.xMm) * ry - (c.yMm - a.yMm) * rx) / denominator;
    if (t > 0 && t < 1 && u > 0 && u < 1) crossings.push({ x: a.xMm + t * rx, y: a.yMm + t * ry, dx: rx / first.lengthMm, dy: ry / first.lengthMm });
  }
  return snapshot({ design, trialId: trial.id, label: braced ? `With brace ${trial.chosenPanelId}` : 'Original baseline', addedMemberId, minX, maxY, spanMm: maxX - minX, heightMm: maxY - minY, members, crossings });
}
