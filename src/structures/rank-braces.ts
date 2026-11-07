import { FIXED_LOAD_FY_N, LOAD_NODE_IDS, PANEL_IDS, PRESET_VERSION, type BraceCandidate, type PanelId, type RankBraces } from '../shared';
import { snapshot } from '../shared/snapshot';
import { rankBraces as mainRankBraces } from '../engines/main/rankBraces';
import { APP_PANEL, ENGINE_PANEL, fromEngineAnalysis, fromEngineError, toEngineDesign } from './main-adapter';
import { analysisError } from './errors';
import { createBraceMember, createBridgePreset } from './preset';
import { validateDesign, validateLoadCase } from './validation';

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

  const engineDesign = { ...toEngineDesign(baseline), braceOptions: PANEL_IDS.map(panelId => ({ panelId: ENGINE_PANEL[panelId], label: panelId, member: createBraceMember(panelId) })) };
  const result = mainRankBraces(engineDesign, load);
  if (result.status === 'invalid') return fromEngineError(result);
  const candidates = {} as Record<PanelId, BraceCandidate>;
  for (const alternative of result.alternatives) {
    const panelId = APP_PANEL[alternative.panelId];
    const { reductionMm, reductionPercent } = alternative.deflection;
    candidates[panelId] = {
      panelId, design: { ...baseline, id: `${baseline.id}+${panelId}`, members: alternative.design.members },
      analysis: fromEngineAnalysis(alternative.analysis, load),
      change: reductionPercent === null ? { kind: 'absolute-only', reductionMm } : { kind: 'relative', reductionMm, reductionPercent },
    };
  }
  return snapshot({ status: 'ok', load, baseline: { design: baseline, analysis: fromEngineAnalysis(result.baseline, load) }, candidates, bestIds: result.bestPanelIds.map(id => APP_PANEL[id]) });
};
