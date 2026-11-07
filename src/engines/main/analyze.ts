import type { Analyze, AnalysisSuccess, Design, LoadCase, ValidationIssue, Vector2 } from './types';

const issue = (code: ValidationIssue['code'], message: string, path: string): ValidationIssue => ({ code, message, path });
const validId = (id: string): boolean => typeof id === 'string' && id.trim().length > 0;

function validate(design: Design, load: LoadCase): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const stockIds = new Set<string>();
  const memberIds = new Set<string>();
  if (design.nodes.length === 0) issues.push(issue('invalid-geometry', 'The design has no nodes.', 'nodes'));
  for (const node of design.nodes) {
    if (!validId(node.id) || nodeIds.has(node.id)) issues.push(issue('invalid-geometry', 'Node IDs must be nonempty and unique.', `nodes.${node.id}`));
    nodeIds.add(node.id);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) issues.push(issue('invalid-geometry', 'Node coordinates must be finite millimeters.', `nodes.${node.id}`));
  }
  for (const stock of design.stocks) {
    if (!validId(stock.id) || stockIds.has(stock.id)) issues.push(issue('invalid-stock', 'Stock IDs must be nonempty and unique.', `stocks.${stock.id}`));
    stockIds.add(stock.id);
    if (!Number.isFinite(stock.areaMm2) || stock.areaMm2 <= 0 ||
        !Number.isFinite(stock.elasticModulusNPerMm2) || stock.elasticModulusNPerMm2 <= 0) {
      issues.push(issue('invalid-stock', 'Area and elastic modulus must be finite and positive.', `stocks.${stock.id}`));
    }
  }
  const nodes = new Map(design.nodes.map((node) => [node.id, node]));
  for (const member of design.members) {
    if (!validId(member.id) || memberIds.has(member.id)) issues.push(issue('invalid-geometry', 'Member IDs must be nonempty and unique.', `members.${member.id}`));
    memberIds.add(member.id);
    const start = nodes.get(member.startNodeId);
    const end = nodes.get(member.endNodeId);
    if (!start || !end || !stockIds.has(member.stockId)) {
      issues.push(issue('missing-reference', 'Member endpoints and stock must exist.', `members.${member.id}`));
    } else {
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (!Number.isFinite(length) || length <= 0) issues.push(issue('invalid-geometry', 'Member length must be finite and greater than zero.', `members.${member.id}`));
    }
  }
  const supported = new Set<string>();
  for (const support of design.supports) {
    if (!nodeIds.has(support.nodeId)) issues.push(issue('missing-reference', 'Support node must exist.', `supports.${support.nodeId}`));
    if (supported.has(support.nodeId) || typeof support.fixedX !== 'boolean' || typeof support.fixedY !== 'boolean' || (!support.fixedX && !support.fixedY)) {
      issues.push(issue('invalid-support', 'Each supported node needs one support entry with at least one fixed direction.', `supports.${support.nodeId}`));
    }
    supported.add(support.nodeId);
  }
  if (!nodeIds.has(load.nodeId) || !Number.isFinite(load.fxN) || !Number.isFinite(load.fyN)) {
    issues.push(issue('invalid-load', 'Point load must act at an existing node with finite components in newtons.', 'loadCase'));
  }
  return issues;
}

/** Solve symmetric positive-definite stiffness after diagonal equilibration. */
function solve(stiffness: number[][], forces: number[]): number[] | null {
  const count = forces.length;
  if (count === 0) return [];
  const scale = stiffness.map((row, i) => Math.sqrt(row[i]!));
  if (scale.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  const lower = Array.from({ length: count }, () => Array<number>(count).fill(0));
  for (let i = 0; i < count; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let value = stiffness[i]![j]! / scale[i]! / scale[j]!;
      for (let k = 0; k < j; k += 1) value -= lower[i]![k]! * lower[j]![k]!;
      if (!Number.isFinite(value)) return null;
      if (i === j) {
        // Relative to equilibrated unit diagonals: mechanisms and near mechanisms.
        if (value <= 1e-12) return null;
        lower[i]![j] = Math.sqrt(value);
      } else lower[i]![j] = value / lower[j]![j]!;
    }
  }
  const forward = Array<number>(count).fill(0);
  for (let i = 0; i < count; i += 1) {
    let value = forces[i]! / scale[i]!;
    for (let j = 0; j < i; j += 1) value -= lower[i]![j]! * forward[j]!;
    forward[i] = value / lower[i]![i]!;
  }
  const scaledSolution = Array<number>(count).fill(0);
  for (let i = count - 1; i >= 0; i -= 1) {
    let value = forward[i]!;
    for (let j = i + 1; j < count; j += 1) value -= lower[j]![i]! * scaledSolution[j]!;
    scaledSolution[i] = value / lower[i]![i]!;
  }
  return scaledSolution.map((value, i) => value / scale[i]!);
}

export const analyze: Analyze = (design, loadCase) => {
  const issues = validate(design, loadCase);
  if (issues.length) return { status: 'invalid', issues };
  const invalidNumerics = (path: string) => ({
    status: 'invalid' as const,
    issues: [issue('numerical-failure', 'Inputs exceed reliable numerical range; performance results are unavailable.', path)],
  });
  const count = design.nodes.length * 2;
  const indices = new Map(design.nodes.map((node, i) => [node.id, i * 2]));
  const nodes = new Map(design.nodes.map((node) => [node.id, node]));
  const stocks = new Map(design.stocks.map((stock) => [stock.id, stock]));
  const stiffness = Array.from({ length: count }, () => Array<number>(count).fill(0));
  const elements: { id: string; indices: number[]; direction: number[]; stiffness: number }[] = [];
  for (const member of design.members) {
    const a = nodes.get(member.startNodeId)!;
    const b = nodes.get(member.endNodeId)!;
    const stock = stocks.get(member.stockId)!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const c = (b.x - a.x) / length;
    const s = (b.y - a.y) / length;
    const axialStiffness = stock.areaMm2 * stock.elasticModulusNPerMm2 / length;
    if (!Number.isFinite(axialStiffness) || axialStiffness <= 0) return invalidNumerics(`members.${member.id}`);
    const aIndex = indices.get(a.id)!;
    const bIndex = indices.get(b.id)!;
    const dofs = [aIndex, aIndex + 1, bIndex, bIndex + 1];
    const direction = [-c, -s, c, s];
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        stiffness[dofs[i]!]![dofs[j]!]! += axialStiffness * direction[i]! * direction[j]!;
      }
    }
    elements.push({ id: member.id, indices: dofs, direction, stiffness: axialStiffness });
  }
  if (stiffness.some((row) => row.some((value) => !Number.isFinite(value)))) return invalidNumerics('stiffness');
  const force = Array<number>(count).fill(0);
  const loadIndex = indices.get(loadCase.nodeId)!;
  force[loadIndex] = loadCase.fxN;
  force[loadIndex + 1] = loadCase.fyN;
  const fixed = new Set<number>();
  for (const support of design.supports) {
    const index = indices.get(support.nodeId)!;
    if (support.fixedX) fixed.add(index);
    if (support.fixedY) fixed.add(index + 1);
  }
  const free = Array.from({ length: count }, (_, i) => i).filter((i) => !fixed.has(i));
  const reduced = free.map((i) => free.map((j) => stiffness[i]![j]!));
  const solved = solve(reduced, free.map((i) => force[i]!));
  if (solved === null) return {
    status: 'invalid',
    issues: [issue('singular-system', 'The layout is unstable or too close to a mechanism to analyze reliably.', 'design')],
  };
  if (solved.some((value) => !Number.isFinite(value))) return invalidNumerics('displacements');
  const displacement = Array<number>(count).fill(0);
  free.forEach((index, i) => { displacement[index] = solved[i]!; });
  const internal = stiffness.map((row) => row.reduce((total, value, j) => total + value * displacement[j]!, 0));
  if (internal.some((value) => !Number.isFinite(value))) return invalidNumerics('reactions');
  // Backward-error check on unconstrained equations, normalized to each row's scale.
  for (const index of free) {
    const denominator = Math.abs(force[index]!) + stiffness[index]!.reduce((total, value, j) => total + Math.abs(value * displacement[j]!), 0);
    if (!Number.isFinite(denominator) || Math.abs(internal[index]! - force[index]!) > 1e-9 * Math.max(denominator, Number.MIN_VALUE)) {
      return invalidNumerics('equilibrium');
    }
  }
  const displacementsMm: Record<string, Vector2> = Object.fromEntries(design.nodes.map((node, i) => [
    node.id, { x: displacement[2 * i]!, y: displacement[2 * i + 1]! },
  ]));
  const memberForcesN: Record<string, number> = Object.fromEntries(elements.map((element) => [
    element.id, element.stiffness * element.indices.reduce((extension, index, i) => extension + element.direction[i]! * displacement[index]!, 0),
  ]));
  if (Object.values(memberForcesN).some((value) => !Number.isFinite(value))) return invalidNumerics('memberForces');
  const reactionsN: Record<string, Vector2> = Object.fromEntries(design.supports.map((support) => {
    const index = indices.get(support.nodeId)!;
    return [support.nodeId, {
      x: support.fixedX ? internal[index]! - force[index]! : 0,
      y: support.fixedY ? internal[index + 1]! - force[index + 1]! : 0,
    }];
  }));
  if (Object.values(reactionsN).some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) return invalidNumerics('reactions');
  return { status: 'ok', displacementsMm, memberForcesN, reactionsN } satisfies AnalysisSuccess;
};
