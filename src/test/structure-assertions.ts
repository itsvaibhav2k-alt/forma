import { expect } from 'vitest';
import type { Analysis, Design, LoadCase } from '../shared';

/** Independent joint-force balance, without reusing the stiffness assembly. */
export function expectEquilibrium(design: Design, load: LoadCase, analysis: Analysis): void {
  const balance = new Map(design.nodes.map(node => [node.id, { x: 0, y: 0 }]));
  const nodes = new Map(design.nodes.map(node => [node.id, node]));
  for (const member of design.members) {
    const start = nodes.get(member.startNodeId)!;
    const end = nodes.get(member.endNodeId)!;
    const angle = Math.atan2(end.yMm - start.yMm, end.xMm - start.xMm);
    const force = analysis.axialForceNByMember[member.id]!;
    balance.get(start.id)!.x += force * Math.cos(angle);
    balance.get(start.id)!.y += force * Math.sin(angle);
    balance.get(end.id)!.x -= force * Math.cos(angle);
    balance.get(end.id)!.y -= force * Math.sin(angle);
  }
  balance.get(load.nodeId)!.x += load.fxN;
  balance.get(load.nodeId)!.y += load.fyN;
  let netX = load.fxN;
  let netY = load.fyN;
  const loaded = nodes.get(load.nodeId)!;
  let moment = loaded.xMm * load.fyN - loaded.yMm * load.fxN;
  for (const [id, reaction] of Object.entries(analysis.reactionNByNode)) {
    balance.get(id)!.x += reaction.x;
    balance.get(id)!.y += reaction.y;
    netX += reaction.x;
    netY += reaction.y;
    moment += nodes.get(id)!.xMm * reaction.y - nodes.get(id)!.yMm * reaction.x;
  }
  for (const vector of balance.values()) {
    expect(vector.x).toBeCloseTo(0, 9);
    expect(vector.y).toBeCloseTo(0, 9);
  }
  expect(netX).toBeCloseTo(0, 9);
  expect(netY).toBeCloseTo(0, 9);
  expect(moment).toBeCloseTo(0, 7);
}

