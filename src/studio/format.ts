import { PANEL_IDS, type DeflectionChange, type PanelId, type RankedBraces } from '../shared';

export const formatMm = (value: number) => value.toFixed(6);
export const formatChange = (change: DeflectionChange) => change.kind === 'relative'
  ? `${change.reductionPercent.toFixed(2)}%` : `${formatMm(change.reductionMm)} mm`;
export const formatForce = (value: number) => Math.abs(value) < 1e-9 ? '0.000 N · zero'
  : `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(3)} N · ${value > 0 ? 'tension' : 'compression'}`;

export function panelRank(results: RankedBraces, panel: PanelId): number {
  const best = Math.min(...PANEL_IDS.map(id => results.candidates[id].analysis.loadedJointDisplacementMm));
  const tolerance = Math.max(1e-9, 1e-6 * best);
  const chosen = results.candidates[panel].analysis.loadedJointDisplacementMm;
  return 1 + PANEL_IDS.filter(id => results.candidates[id].analysis.loadedJointDisplacementMm < chosen - tolerance).length;
}
