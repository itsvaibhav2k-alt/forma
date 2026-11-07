import type { AnalysisError, Design } from '../shared';
import { analysisError } from './errors';

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Validate untrusted data before any stiffness assembly; return no performance fields. */
export function validateDesign(design: unknown): AnalysisError | null {
  if (!record(design) || !identifier(design.id) || !identifier(design.presetVersion) ||
      !Array.isArray(design.nodes) || !design.nodes.length ||
      !Array.isArray(design.members) || !design.members.length ||
      !Array.isArray(design.stocks) || !design.stocks.length) {
    return analysisError('INVALID_INPUT', 'A design needs an ID, preset version, nodes, members, and stock definitions.');
  }

  const nodes = new Map<string, { x: number; y: number }>();
  for (const node of design.nodes) {
    if (!record(node) || !identifier(node.id)) return analysisError('INVALID_INPUT', 'Every node needs a nonempty ID.');
    if (nodes.has(node.id)) return analysisError('INVALID_INPUT', 'Node IDs must be unique.', [node.id]);
    if (!finite(node.xMm) || !finite(node.yMm)) return analysisError('INVALID_INPUT', 'Node coordinates must be finite millimeters.', [node.id]);
    if (!record(node.restrained) || typeof node.restrained.x !== 'boolean' || typeof node.restrained.y !== 'boolean') {
      return analysisError('INVALID_INPUT', 'Each node needs boolean x and y restraints.', [node.id]);
    }
    nodes.set(node.id, { x: node.xMm, y: node.yMm });
  }

  const stockIds = new Set<string>();
  for (const stock of design.stocks) {
    if (!record(stock) || !identifier(stock.id) || stockIds.has(stock.id) ||
        !finite(stock.areaMm2) || stock.areaMm2 <= 0 ||
        !finite(stock.elasticModulusNPerMm2) || stock.elasticModulusNPerMm2 <= 0) {
      return analysisError('INVALID_STOCK', 'Stocks need unique IDs and finite positive area and modulus.');
    }
    stockIds.add(stock.id);
  }

  const memberIds = new Set<string>();
  const edges = new Set<string>();
  for (const member of design.members) {
    if (!record(member) || !identifier(member.id)) return analysisError('INVALID_INPUT', 'Every member needs a nonempty ID.');
    if (memberIds.has(member.id)) return analysisError('DUPLICATE_MEMBER', 'Member IDs must be unique.', [], [member.id]);
    memberIds.add(member.id);
    if (!identifier(member.startNodeId) || !identifier(member.endNodeId)) {
      return analysisError('MISSING_ENDPOINT', 'Members need valid endpoint IDs.', [], [member.id]);
    }
    const missing = [member.startNodeId, member.endNodeId].filter(id => !nodes.has(id));
    if (missing.length) return analysisError('MISSING_ENDPOINT', 'A member endpoint is not present in the design.', missing, [member.id]);
    if (!identifier(member.stockId) || !stockIds.has(member.stockId)) {
      return analysisError('INVALID_STOCK', 'A member references an unknown stock.', [], [member.id]);
    }
    const start = nodes.get(member.startNodeId)!;
    const end = nodes.get(member.endNodeId)!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length === 0) return analysisError('ZERO_LENGTH_MEMBER', 'Member endpoints must be at different positions.', [member.startNodeId, member.endNodeId], [member.id]);
    if (!Number.isFinite(length)) return analysisError('NUMERICAL_FAILURE', 'Member geometry exceeds the supported numerical range.', [member.startNodeId, member.endNodeId], [member.id]);
    const edge = JSON.stringify([member.startNodeId, member.endNodeId].sort());
    if (edges.has(edge)) return analysisError('DUPLICATE_MEMBER', 'Two members connect the same node pair.', [member.startNodeId, member.endNodeId], [member.id]);
    edges.add(edge);
  }
  return null;
}

/** Call after validating the design. General analysis accepts horizontal, upward and zero loads. */
export function validateLoadCase(design: Design, load: unknown): AnalysisError | null {
  if (!record(load) || !identifier(load.nodeId) || !finite(load.fxN) || !finite(load.fyN)) {
    return analysisError('INVALID_INPUT', 'A point load needs a node ID and finite force components in newtons.');
  }
  if (!design.nodes.some(node => node.id === load.nodeId)) {
    return analysisError('INVALID_INPUT', 'The loaded node is not present in the design.', [load.nodeId]);
  }
  return null;
}
