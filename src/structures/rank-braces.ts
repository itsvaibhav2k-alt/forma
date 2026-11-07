import { FIXED_LOAD_FY_N, LOAD_NODE_IDS, PANEL_IDS, PRESET_VERSION, type BraceCandidate, type DeflectionChange, type PanelId, type RankBraces } from '../shared';
import { snapshot } from '../shared/snapshot';
import { analyze } from './analyze';
import { analysisError } from './errors';
import { createBraceMember, createBridgePreset } from './preset';
import { validateDesign, validateLoadCase } from './validation';

/** Magnitudes are full-precision absolute vertical displacements in mm. */
export function deflectionChange(baselineMm: number, candidateMm: number): DeflectionChange {
  const reductionMm = baselineMm - candidateMm;
  return baselineMm === 0
    ? { kind: 'absolute-only', reductionMm }
    : { kind: 'relative', reductionMm, reductionPercent: 100 * (reductionMm / baselineMm) };
}

export function bestPanelIds(displacementMm: Readonly<Record<PanelId, number>>): PanelId[] {
  const best = Math.min(...PANEL_IDS.map(id => displacementMm[id]));
  const tolerance = Math.max(1e-9, 1e-6 * best);
  return PANEL_IDS.filter(id => Math.abs(displacementMm[id] - best) <= tolerance);
}

/** Fixed-preset judging API. General or edited trusses use analyze directly. */
export const rankBraces: RankBraces = (baseline, load) => {
  const invalidDesign = validateDesign(baseline);
  if (invalidDesign) return invalidDesign;
  const invalidLoad = validateLoadCase(baseline, load);
  if (invalidLoad) return invalidLoad;
  if (!(LOAD_NODE_IDS as readonly string[]).includes(load.nodeId) || load.fxN !== 0 || load.fyN !== FIXED_LOAD_FY_N) {
    return analysisError('INVALID_INPUT', 'Judging requires a 10 N downward load at B1, B2 or B3.', [load.nodeId]);
  }
  const canonical = createBridgePreset();
  const nodes = new Map(baseline.nodes.map(node => [node.id, node]));
  const members = new Map(baseline.members.map(member => [member.id, member]));
  const stock = baseline.stocks[0]!;
  const expectedStock = canonical.stocks[0]!;
  if (baseline.presetVersion !== PRESET_VERSION || baseline.nodes.length !== canonical.nodes.length ||
      baseline.members.length !== canonical.members.length || baseline.stocks.length !== 1 ||
      stock.id !== expectedStock.id || stock.areaMm2 !== expectedStock.areaMm2 || stock.elasticModulusNPerMm2 !== expectedStock.elasticModulusNPerMm2 ||
      canonical.nodes.some(expected => {
        const actual = nodes.get(expected.id);
        return !actual || actual.xMm !== expected.xMm || actual.yMm !== expected.yMm ||
          actual.restrained.x !== expected.restrained.x || actual.restrained.y !== expected.restrained.y;
      }) || canonical.members.some(expected => {
        const actual = members.get(expected.id);
        return !actual || actual.stockId !== expected.stockId || !(
          (actual.startNodeId === expected.startNodeId && actual.endNodeId === expected.endNodeId) ||
          (actual.startNodeId === expected.endNodeId && actual.endNodeId === expected.startNodeId));
      })) {
    return analysisError('INVALID_INPUT', 'Brace ranking requires the unmodified four-panel baseline preset.');
  }

  const baselineAnalysis = analyze(baseline, load);
  if (baselineAnalysis.status === 'error') return baselineAnalysis;
  const candidates = {} as Record<PanelId, BraceCandidate>;
  const deflections = {} as Record<PanelId, number>;
  for (const panelId of PANEL_IDS) {
    const design = { ...baseline, id: `${baseline.id}+${panelId}`, members: [...baseline.members, createBraceMember(panelId)] };
    const analysis = analyze(design, load);
    if (analysis.status === 'error') return analysis;
    candidates[panelId] = { panelId, design, analysis, change: deflectionChange(baselineAnalysis.loadedJointDisplacementMm, analysis.loadedJointDisplacementMm) };
    deflections[panelId] = analysis.loadedJointDisplacementMm;
  }
  return snapshot({ status: 'ok', load, baseline: { design: baseline, analysis: baselineAnalysis }, candidates, bestIds: bestPanelIds(deflections) });
};
