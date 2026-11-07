import { immutableCopy, type AnalysisSuccess, type Design, type InvalidResult, type NodeId, type ValidationIssue } from '../shared';
import { analyze } from '../structures';

export interface VehicleAxle {
  /** Horizontal distance from the vehicle center. Negative is toward the rear. */
  readonly offsetMm: number;
  /** Downward axle load, expressed as a positive number. */
  readonly loadN: number;
}

export interface Vehicle {
  readonly id: string;
  readonly label: string;
  readonly axles: readonly VehicleAxle[];
}

export interface DistributedNodeLoad {
  readonly nodeId: NodeId;
  /** Always zero for the current vertical vehicle model. */
  readonly fxN: 0;
  /** Downward loads are negative. */
  readonly fyN: number;
}

export interface MemberStress {
  readonly memberId: string;
  readonly forceN: number;
  /** N/mm² is numerically equal to MPa. Positive is tension. */
  readonly stressNPerMm2: number;
  readonly mode: 'tension' | 'compression' | 'zero';
}

export interface VehiclePositionSuccess {
  readonly status: 'ok';
  readonly vehicle: Vehicle;
  readonly centerXMm: number;
  readonly axlePositionsMm: readonly number[];
  readonly nodalLoads: readonly DistributedNodeLoad[];
  readonly analysis: AnalysisSuccess;
  readonly memberStresses: Readonly<Record<string, MemberStress>>;
  readonly criticalMember: MemberStress;
}

export type VehiclePositionResult = VehiclePositionSuccess | InvalidResult;

export interface VehiclePassSuccess {
  readonly status: 'ok';
  readonly frames: readonly VehiclePositionSuccess[];
  readonly worstFrameIndex: number;
  readonly worst: VehiclePositionSuccess;
}

export type VehiclePassResult = VehiclePassSuccess | InvalidResult;

const invalid = (message: string, path: string): InvalidResult => ({
  status: 'invalid',
  issues: [{ code: 'invalid-load', message, path } satisfies ValidationIssue],
});

function deckNodes(design: Design, ids: readonly NodeId[]) {
  const nodes = new Map(design.nodes.map((node) => [node.id, node]));
  const selected = ids.map((id) => nodes.get(id));
  if (selected.some((node) => node === undefined)) return null;
  const sorted = selected.map((node) => node!).sort((a, b) => a.x - b.x);
  if (sorted.length < 2 || new Set(sorted.map(({ id }) => id)).size !== sorted.length) return null;
  const y = sorted[0]!.y;
  if (sorted.some((node, index) => !Number.isFinite(node.x) || node.y !== y || (index > 0 && node.x <= sorted[index - 1]!.x))) return null;
  return sorted;
}

/**
 * Distributes axle loads to adjacent deck joints, then superposes point-load analyses.
 * This is a quasi-static influence-line model, not an impact or vibration simulation.
 */
export function simulateVehicleAtPosition(
  design: Design,
  deckNodeIds: readonly NodeId[],
  vehicle: Vehicle,
  centerXMm: number,
): VehiclePositionResult {
  const deck = deckNodes(design, deckNodeIds);
  if (!deck) return invalid('Deck nodes must be distinct, existing, collinear joints ordered along a nonzero span.', 'deckNodeIds');
  if (!Number.isFinite(centerXMm)) return invalid('Vehicle position must be finite millimeters.', 'centerXMm');
  if (!vehicle.id.trim() || !vehicle.label.trim() || vehicle.axles.length === 0 || vehicle.axles.some(
    ({ offsetMm, loadN }) => !Number.isFinite(offsetMm) || !Number.isFinite(loadN) || loadN <= 0,
  )) return invalid('Vehicle needs an ID, label, and finite positive axle loads at finite offsets.', 'vehicle');

  const firstX = deck[0]!.x;
  const lastX = deck[deck.length - 1]!.x;
  const axlePositionsMm = vehicle.axles.map(({ offsetMm }) => centerXMm + offsetMm);
  if (axlePositionsMm.some((x) => x < firstX || x > lastX)) {
    return invalid('Every axle must be on the modeled bridge span.', 'centerXMm');
  }

  const forces = new Map<NodeId, number>();
  for (const [axleIndex, axle] of vehicle.axles.entries()) {
    const x = axlePositionsMm[axleIndex]!;
    const exact = deck.find((node) => Math.abs(node.x - x) <= 1e-12 * Math.max(1, Math.abs(x)));
    if (exact) {
      forces.set(exact.id, (forces.get(exact.id) ?? 0) - axle.loadN);
      continue;
    }
    const rightIndex = deck.findIndex((node) => node.x > x);
    const left = deck[rightIndex - 1]!;
    const right = deck[rightIndex]!;
    const rightShare = (x - left.x) / (right.x - left.x);
    forces.set(left.id, (forces.get(left.id) ?? 0) - axle.loadN * (1 - rightShare));
    forces.set(right.id, (forces.get(right.id) ?? 0) - axle.loadN * rightShare);
  }
  const nodalLoads: DistributedNodeLoad[] = [...forces.entries()]
    .filter(([, fyN]) => Math.abs(fyN) > Number.EPSILON)
    .sort(([a], [b]) => deck.findIndex(({ id }) => id === a) - deck.findIndex(({ id }) => id === b))
    .map(([nodeId, fyN]) => ({ nodeId, fxN: 0, fyN }));

  const analyses: AnalysisSuccess[] = [];
  for (const load of nodalLoads) {
    const result = analyze(design, load);
    if (result.status === 'invalid') return result;
    analyses.push(result);
  }
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
  const analysis: AnalysisSuccess = {
    status: 'ok',
    displacementsMm: Object.fromEntries(design.nodes.map((node) => [node.id, {
      x: sum(analyses.map(({ displacementsMm }) => displacementsMm[node.id]!.x)),
      y: sum(analyses.map(({ displacementsMm }) => displacementsMm[node.id]!.y)),
    }])),
    memberForcesN: Object.fromEntries(design.members.map((member) => [
      member.id, sum(analyses.map(({ memberForcesN }) => memberForcesN[member.id]!)),
    ])),
    reactionsN: Object.fromEntries(design.supports.map((support) => [support.nodeId, {
      x: sum(analyses.map(({ reactionsN }) => reactionsN[support.nodeId]!.x)),
      y: sum(analyses.map(({ reactionsN }) => reactionsN[support.nodeId]!.y)),
    }])),
  };
  const stocks = new Map(design.stocks.map((stock) => [stock.id, stock]));
  const memberStresses = Object.fromEntries(design.members.map((member) => {
    const forceN = analysis.memberForcesN[member.id]!;
    const stressNPerMm2 = forceN / stocks.get(member.stockId)!.areaMm2;
    return [member.id, {
      memberId: member.id,
      forceN,
      stressNPerMm2,
      mode: Math.abs(stressNPerMm2) < 1e-12 ? 'zero' : stressNPerMm2 > 0 ? 'tension' : 'compression',
    } satisfies MemberStress];
  }));
  const criticalMember = Object.values(memberStresses).reduce((worst, current) =>
    Math.abs(current.stressNPerMm2) > Math.abs(worst.stressNPerMm2) ? current : worst);
  return immutableCopy({
    status: 'ok', vehicle, centerXMm, axlePositionsMm, nodalLoads,
    analysis, memberStresses, criticalMember,
  });
}

export function simulateVehiclePass(
  design: Design,
  deckNodeIds: readonly NodeId[],
  vehicle: Vehicle,
  sampleCount = 49,
): VehiclePassResult {
  const deck = deckNodes(design, deckNodeIds);
  if (!deck) return invalid('Deck nodes must describe a valid bridge span.', 'deckNodeIds');
  if (!Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 10_001) {
    return invalid('Sample count must be a whole number from 2 through 10,001.', 'sampleCount');
  }
  if (vehicle.axles.length === 0 || vehicle.axles.some(({ offsetMm, loadN }) =>
    !Number.isFinite(offsetMm) || !Number.isFinite(loadN) || loadN <= 0)) {
    return invalid('Vehicle needs finite positive axle loads at finite offsets.', 'vehicle');
  }
  const minOffset = Math.min(...vehicle.axles.map(({ offsetMm }) => offsetMm));
  const maxOffset = Math.max(...vehicle.axles.map(({ offsetMm }) => offsetMm));
  const start = deck[0]!.x - minOffset;
  const end = deck[deck.length - 1]!.x - maxOffset;
  if (start > end) return invalid('The vehicle wheelbase is longer than the modeled bridge span.', 'vehicle.axles');
  const frames: VehiclePositionSuccess[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const position = start + (end - start) * index / (sampleCount - 1);
    const frame = simulateVehicleAtPosition(design, deckNodeIds, vehicle, position);
    if (frame.status === 'invalid') return frame;
    frames.push(frame);
  }
  let worstFrameIndex = 0;
  for (let index = 1; index < frames.length; index += 1) {
    if (Math.abs(frames[index]!.criticalMember.stressNPerMm2) > Math.abs(frames[worstFrameIndex]!.criticalMember.stressNPerMm2)) {
      worstFrameIndex = index;
    }
  }
  return immutableCopy({ status: 'ok', frames, worstFrameIndex, worst: frames[worstFrameIndex]! });
}
