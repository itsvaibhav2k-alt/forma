import { LOAD_NODE_IDS, PANEL_IDS, type Analysis, type BuildDecisionSheet, type Design, type Load, type RankedBraces, type Reading, type Trial } from '../../shared';
import { snapshot } from '../../shared/snapshot';
import { compareQuotes } from '../costs';

export const REPORT_ASSUMPTIONS = [
  'One planar truss side; ideal pin joints, axial members, small displacement and linear elasticity. Crossed bars are not joined. Slip, bending, buckling and out-of-plane behavior are excluded.',
  '10 N acts on this modeled side. Geometry and E/A are illustrative; the ranking concerns loaded-joint deflection under the stated load, not strength or a failure load.',
  'Record physical test conditions, repeats and instrument resolution. Predictions alone do not validate a prototype.',
  'Costs describe a separate equal-service scenario in real USD with constant year-end upkeep; replacement costs and residual value are excluded. Sources, service life and upkeep estimates need verification.',
] as const;

const sameLoad = (a: Load, b: Load) => a.nodeId === b.nodeId && a.fxN === b.fxN && a.fyN === b.fyN;
const requireValue = (condition: unknown, message: string): void => { if (!condition) throw new Error(message); };

// Compare plain contract values independent of object property insertion order.
function equivalent(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.entries(a), right = Object.entries(b);
  return left.length === right.length && left.every(([key, value]) => Object.hasOwn(b, key) && equivalent(value, (b as Record<string, unknown>)[key]));
}

function checkAnalysis(design: Design, analysis: Analysis, trial: Trial) {
  requireValue(design.presetVersion === trial.presetVersion && analysis.status === 'ok' && analysis.solverVersion === trial.solverVersion, 'Report results must match the trial preset and solver versions.');
  requireValue(design.nodes.length > 0 && design.members.length > 0 && analysis.loadedJointDisplacementMm >= 0, 'Report geometry and displacement must be valid.');
  for (const node of design.nodes) {
    requireValue(analysis.displacementMmByNode[node.id], 'Report results need displacements for every node.');
    if (node.restrained.x || node.restrained.y) requireValue(analysis.reactionNByNode[node.id], 'Report results need support reactions.');
  }
  for (const member of design.members) requireValue(typeof analysis.axialForceNByMember[member.id] === 'number', 'Report results need forces for every member.');
}

function checkRanking(results: RankedBraces, load: Load, trial: Trial) {
  requireValue(LOAD_NODE_IDS.includes(load.nodeId) && load.fxN === 0 && load.fyN === -10 && results.status === 'ok' && sameLoad(results.load, load), 'Report results must belong to the stated load case.');
  checkAnalysis(results.baseline.design, results.baseline.analysis, trial);
  for (const panel of PANEL_IDS) {
    const candidate = results.candidates[panel];
    requireValue(candidate?.panelId === panel, 'Report results need all four brace candidates.');
    checkAnalysis(candidate.design, candidate.analysis, trial);
    requireValue(candidate.design.members.filter(member => !results.baseline.design.members.some(original => original.id === member.id)).length === 1, 'Each reported candidate must contain one added brace.');
  }
  requireValue(results.bestIds.length > 0 && results.bestIds.every(id => PANEL_IDS.includes(id)), 'Report results need valid winning panel IDs.');
}

function checkReading(reading: Reading, trial: Trial, cases: readonly { load: Load; results: RankedBraces }[]) {
  const matched = cases.some(item => sameLoad(item.load, reading.appliedLoad as Load) &&
    [item.results.baseline.design, item.results.candidates[trial.chosenPanelId].design].some(design =>
      reading.designId === design.id && reading.presetVersion === design.presetVersion && design.nodes.some(node => node.id === reading.measuredNodeId)));
  requireValue(matched, 'A measurement must match an included original or chosen-brace design, version, load and measured joint.');
  requireValue(reading.id.trim() && reading.method.trim() && ['mm', 'cm', 'in'].includes(reading.units) &&
    ['unassessed', 'inconclusive', 'resolved'].includes(reading.assessment) && typeof reading.notes === 'string' &&
    (reading.instrumentResolution === null || reading.instrumentResolution > 0) && Array.isArray(reading.rawReadings), 'Measurement metadata or resolution is invalid.');
}

/** Internal typed port: validate associations, then clone everything; never read live state or rerun the solver. */
export const buildDecisionSheet: BuildDecisionSheet = (inputs, reportId, createdAtIso) => {
  requireValue(reportId.trim() && /^\d{4}-\d{2}-\d{2}T/.test(createdAtIso) && Number.isFinite(Date.parse(createdAtIso)) && new Date(createdAtIso).toISOString() === createdAtIso, 'Provide a report ID and canonical ISO timestamp.');
  const { trial, retest, quotes, costs, readings, assumptions } = inputs;
  requireValue(trial.id.trim() && trial.roundId.trim() && trial.presetVersion.trim() && trial.solverVersion.trim() && PANEL_IDS.includes(trial.chosenPanelId), 'Select a valid saved trial before creating a report.');
  // Reject nonfinite data before serialization can silently turn it into null.
  const finite = (value: unknown): boolean => typeof value === 'number' ? Number.isFinite(value)
    : value !== null && typeof value === 'object' ? Object.values(value).every(finite) : true;
  requireValue(finite(inputs), 'Report numbers must be finite. Correct invalid inputs before capturing a sheet.');
  checkRanking(trial.results, trial.load, trial);
  if (retest) {
    requireValue(retest.sourceTrialId === trial.id && retest.chosenPanelId === trial.chosenPanelId, 'A retest must belong to the selected trial and retain its brace.');
    checkRanking(retest.results, retest.load, trial);
    requireValue(equivalent(retest.results.baseline.design, trial.results.baseline.design) && PANEL_IDS.every(panel => equivalent(retest.results.candidates[panel].design, trial.results.candidates[panel].design)), 'A retest must preserve the saved trial geometry and stock.');
  }
  const recalculated = compareQuotes(quotes);
  requireValue(recalculated.status === 'ok', 'Correct financial input errors before capturing a sheet. Blank amounts may remain unknown.');
  requireValue(equivalent(recalculated, costs), 'The cost results do not match the selected quote inputs.');
  const ids = new Set<string>();
  for (const reading of readings) {
    requireValue(!ids.has(reading.id), 'Measurement IDs must be unique.'); ids.add(reading.id);
    checkReading(reading, trial, retest ? [trial, retest] : [trial]);
  }
  requireValue(assumptions.every(item => typeof item === 'string' && item.trim()), 'Report assumptions must be nonempty text.');
  return snapshot({ ...inputs, costs: recalculated, assumptions: [...new Set([...REPORT_ASSUMPTIONS, ...assumptions])], schemaVersion: 1, reportId, createdAtIso });
};
