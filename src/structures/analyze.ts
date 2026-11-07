import type { Analysis, Analyze, Vector2 } from '../shared';
import { analysisError } from './errors';
import { solveStiffness } from './linear-system';
import { validateDesign, validateLoadCase } from './validation';

export const SOLVER_VERSION = 'forma-truss-2d-v1';
const RESIDUAL_TOLERANCE = 1e-9;

/** Linear-elastic, small-displacement, axial-only 2D pin-jointed truss analysis. */
export const analyze: Analyze = (design, load) => {
  const invalidDesign = validateDesign(design);
  if (invalidDesign) return invalidDesign;
  const invalidLoad = validateLoadCase(design, load);
  if (invalidLoad) return invalidLoad;

  const dofCount = design.nodes.length * 2;
  const nodeIndex = new Map(design.nodes.map((node, i) => [node.id, i]));
  const stocks = new Map(design.stocks.map(stock => [stock.id, stock]));
  const stiffness = Array.from({ length: dofCount }, () => new Float64Array(dofCount));
  const elements: { id: string; dofs: number[]; direction: number[]; rigidity: number }[] = [];
  for (const member of design.members) {
    const startIndex = nodeIndex.get(member.startNodeId)!;
    const endIndex = nodeIndex.get(member.endNodeId)!;
    const start = design.nodes[startIndex]!;
    const end = design.nodes[endIndex]!;
    const dx = end.xMm - start.xMm;
    const dy = end.yMm - start.yMm;
    const length = Math.hypot(dx, dy);
    const stock = stocks.get(member.stockId)!;
    const rigidity = stock.elasticModulusNPerMm2 * stock.areaMm2 / length;
    if (!Number.isFinite(rigidity) || rigidity <= 0) {
      return analysisError('NUMERICAL_FAILURE', 'Member axial stiffness is outside the supported numerical range.', [], [member.id]);
    }
    const direction = [-dx / length, -dy / length, dx / length, dy / length];
    const dofs = [2 * startIndex, 2 * startIndex + 1, 2 * endIndex, 2 * endIndex + 1];
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        const row = stiffness[dofs[i]!]!;
        row[dofs[j]!] = row[dofs[j]!]! + rigidity * direction[i]! * direction[j]!;
      }
    }
    elements.push({ id: member.id, dofs, direction, rigidity });
  }
  if (stiffness.some(row => row.some(value => !Number.isFinite(value)))) {
    return analysisError('NUMERICAL_FAILURE', 'Assembled stiffness exceeds the supported numerical range.');
  }

  const force = new Float64Array(dofCount);
  const loadedIndex = nodeIndex.get(load.nodeId)!;
  force[2 * loadedIndex] = load.fxN;
  force[2 * loadedIndex + 1] = load.fyN;
  const free: number[] = [];
  design.nodes.forEach((node, i) => {
    if (!node.restrained.x) free.push(2 * i);
    if (!node.restrained.y) free.push(2 * i + 1);
  });
  const reduced = free.map(i => Float64Array.from(free, j => stiffness[i]![j]!));
  const solved = solveStiffness(reduced, Float64Array.from(free, i => force[i]!));
  if (!(solved instanceof Float64Array)) return solved;
  const displacement = new Float64Array(dofCount);
  free.forEach((dof, i) => { displacement[dof] = solved[i]!; });

  // Check equilibrium against the original, unscaled system. Do not report an
  // apparent success after overflow, excessive cancellation or a failed solve.
  const internal = new Float64Array(dofCount);
  const forceScale = Math.max(Math.abs(load.fxN), Math.abs(load.fyN));
  const freeSet = new Set(free);
  for (let i = 0; i < dofCount; i += 1) {
    let sum = 0;
    let absoluteSum = 0;
    for (let j = 0; j < dofCount; j += 1) {
      const term = stiffness[i]![j]! * displacement[j]!;
      sum += term;
      absoluteSum += Math.abs(term);
    }
    if (!Number.isFinite(sum) || !Number.isFinite(absoluteSum) ||
        (freeSet.has(i) && Math.abs(sum - force[i]!) > RESIDUAL_TOLERANCE * Math.max(forceScale, absoluteSum))) {
      return analysisError('NUMERICAL_FAILURE', 'The displacement solution did not pass the equilibrium residual check.');
    }
    internal[i] = sum;
  }

  // Null-prototype maps preserve arbitrary valid string IDs, including __proto__.
  const displacementMmByNode: Record<string, Vector2> = Object.create(null);
  const reactionNByNode: Record<string, Vector2> = Object.create(null);
  const axialForceNByMember: Record<string, number> = Object.create(null);
  design.nodes.forEach((node, i) => {
    displacementMmByNode[node.id] = { x: displacement[2 * i]!, y: displacement[2 * i + 1]! };
    if (node.restrained.x || node.restrained.y) {
      reactionNByNode[node.id] = {
        x: node.restrained.x ? internal[2 * i]! - force[2 * i]! : 0,
        y: node.restrained.y ? internal[2 * i + 1]! - force[2 * i + 1]! : 0,
      };
    }
  });
  for (const element of elements) {
    let extension = 0;
    element.dofs.forEach((dof, i) => { extension += element.direction[i]! * displacement[dof]!; });
    const axialForce = element.rigidity * extension;
    if (!Number.isFinite(axialForce)) return analysisError('NUMERICAL_FAILURE', 'A member force is not finite.', [], [element.id]);
    axialForceNByMember[element.id] = axialForce;
  }
  if (Object.values(reactionNByNode).some(value => !Number.isFinite(value.x) || !Number.isFinite(value.y))) {
    return analysisError('NUMERICAL_FAILURE', 'A support reaction is not finite.');
  }
  return {
    status: 'ok', solverVersion: SOLVER_VERSION, displacementMmByNode, reactionNByNode,
    axialForceNByMember, loadedJointDisplacementMm: Math.abs(displacement[2 * loadedIndex + 1]!),
  } satisfies Analysis;
};
