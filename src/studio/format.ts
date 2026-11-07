import { PANEL_IDS, type DeflectionChange, type LoadNodeId, type PanelId, type RankedBraces } from '../shared';

export const formatMm = (value: number) => Number.isFinite(value) ? value.toFixed(6) : 'Unknown';
export const formatChange = (change: DeflectionChange) => change.kind === 'relative'
  ? Number.isFinite(change.reductionPercent) ? `${change.reductionPercent.toFixed(2)}%` : 'Unknown' : `${formatMm(change.reductionMm)} mm`;
export const formatForce = (value: number | undefined) => value === undefined || !Number.isFinite(value) ? 'Unknown' : Math.abs(value) < 1e-9 ? '0.000 N · zero'
  : `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(3)} N · ${value > 0 ? 'tension' : 'compression'}`;

export function panelRank(results: RankedBraces, panel: PanelId): number {
  const best = Math.min(...PANEL_IDS.map(id => results.candidates[id].analysis.loadedJointDisplacementMm));
  // Match the pinned main engine; display rounding must not create extra ties.
  const tolerance = Math.max(1e-9, 1e-8 * Math.abs(best));
  const chosen = results.candidates[panel].analysis.loadedJointDisplacementMm;
  return 1 + PANEL_IDS.filter(id => results.candidates[id].analysis.loadedJointDisplacementMm < chosen - tolerance).length;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th'] as const;
const joinNames = (names: readonly string[]) => names.length <= 1 ? names[0] ?? ''
  : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
/** "10.46% less deflection", "3.00% more deflection" or "0.000100 mm less deflection". */
export const changePhrase = (change: DeflectionChange) => change.kind === 'relative'
  ? `${Math.abs(change.reductionPercent).toFixed(2)}% ${change.reductionPercent < 0 ? 'more' : 'less'} deflection`
  : `${formatMm(Math.abs(change.reductionMm))} mm ${change.reductionMm < 0 ? 'more' : 'less'} deflection`;

/** One-sentence verdict for the judge: best, tied best, or rank of four. Wording only. */
export function verdictLead(results: RankedBraces, panel: PanelId, loadNodeId: LoadNodeId): string {
  const change = changePhrase(results.candidates[panel].change);
  if (results.bestIds.includes(panel)) {
    return results.bestIds.length > 1
      ? `${joinNames(results.bestIds)} tie for best at ${loadNodeId}: ${change}.`
      : `${panel} is the best placement at ${loadNodeId}: ${change}.`;
  }
  const rank = ORDINALS[panelRank(results, panel) - 1] ?? `${panelRank(results, panel)}th`;
  return `${panel} ranks ${rank} of ${PANEL_IDS.length} at ${loadNodeId}: ${change}.`;
}
