import type { BraceEvaluation, PanelId, RankBraces } from './types';
import { analyze } from './analyze';

const PANELS: readonly PanelId[] = ['panel-1', 'panel-2', 'panel-3', 'panel-4'];
const edgeKey = (start: string, end: string): string => JSON.stringify([start, end].sort());

export const rankBraces: RankBraces = (design, loadCase) => {
  if (loadCase.fxN !== 0 || !Number.isFinite(loadCase.fyN) || loadCase.fyN >= 0) return {
    status: 'invalid', issues: [{ code: 'invalid-load', message: 'Brace comparison requires a finite, strictly downward load.', path: 'loadCase' }],
  };
  if (design.braceOptions.length !== 4 || PANELS.some((panelId) => design.braceOptions.filter((option) => option.panelId === panelId).length !== 1) ||
      new Set(design.braceOptions.map(({ member }) => member.id)).size !== 4) return {
    status: 'invalid', issues: [{ code: 'invalid-brace-options', message: 'Provide one distinct opposite-diagonal addition for each of the four panels.', path: 'braceOptions' }],
  };
  const existingEdges = new Set(design.members.map((member) => edgeKey(member.startNodeId, member.endNodeId)));
  const addedEdges = design.braceOptions.map(({ member }) => edgeKey(member.startNodeId, member.endNodeId));
  if (new Set(addedEdges).size !== 4 || addedEdges.some((edge) => existingEdges.has(edge))) return {
    status: 'invalid', issues: [{ code: 'invalid-brace-options', message: 'Each candidate must add a different new diagonal, not duplicate an existing member.', path: 'braceOptions' }],
  };
  const baseline = analyze(design, loadCase);
  if (baseline.status === 'invalid') return baseline;
  const baselineMm = Math.abs(baseline.displacementsMm[loadCase.nodeId]!.y);
  const alternatives: BraceEvaluation[] = [];
  for (const panelId of PANELS) {
    const option = design.braceOptions.find((candidate) => candidate.panelId === panelId)!;
    const revised = { ...design, id: `${design.id}+${panelId}`, members: [...design.members, option.member] };
    const analysis = analyze(revised, loadCase);
    if (analysis.status === 'invalid') return { status: 'invalid', issues: analysis.issues.map((item) => ({ ...item, path: `braceOptions.${panelId}.${item.path}` })) };
    const revisedMm = Math.abs(analysis.displacementsMm[loadCase.nodeId]!.y);
    const reductionMm = baselineMm - revisedMm;
    const reductionPercent = baselineMm <= 1e-12 ? null : 100 * (reductionMm / baselineMm);
    if (!Number.isFinite(reductionMm) || (reductionPercent !== null && !Number.isFinite(reductionPercent))) return {
      status: 'invalid', issues: [{ code: 'numerical-failure', message: 'Deflection change exceeds numerical range.', path: `braceOptions.${panelId}` }],
    };
    alternatives.push({ panelId, design: revised, analysis, deflection: { baselineMm, revisedMm, reductionMm, reductionPercent } });
  }
  const best = Math.min(...alternatives.map(({ deflection }) => deflection.revisedMm));
  const tolerance = Math.max(1e-9, 1e-8 * Math.abs(best));
  return {
    status: 'ok', loadCase: { ...loadCase }, baselineDesign: design, baseline, baselineDeflectionMm: baselineMm,
    alternatives, bestPanelIds: alternatives.filter(({ deflection }) => Math.abs(deflection.revisedMm - best) <= tolerance).map(({ panelId }) => panelId),
  };
};
