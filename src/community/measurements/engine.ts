import type { Analysis, Design, Load, Reading, Retest, Trial } from '../../shared';
import { snapshot } from '../../shared/snapshot';

export interface MeasurementCase {
  readonly key: string;
  readonly label: string;
  readonly design: Design;
  readonly load: Load;
  readonly analysis: Analysis;
  readonly original: Analysis;
  readonly modified: Analysis;
}
const sameLoad = (a: Reading['appliedLoad'], b: Load) => a.nodeId === b.nodeId && a.fxN === b.fxN && a.fyN === b.fyN;
export function measurementCases(trial: Trial, retest: Retest | null = null): readonly MeasurementCase[] {
  if (retest && (retest.sourceTrialId !== trial.id || retest.chosenPanelId !== trial.chosenPanelId)) throw new Error('Retest must belong to the selected trial.');
  const cases: MeasurementCase[] = [];
  for (const [scenario, value] of [['Saved', trial], ['Retest', retest]] as const) {
    if (!value) continue;
    const original = value.results.baseline;
    const modified = value.results.candidates[trial.chosenPanelId];
    for (const [label, target] of [['Original', original], [`With brace ${trial.chosenPanelId}`, modified]] as const) {
      const key = JSON.stringify([target.design.id, target.design.presetVersion, value.load.nodeId, value.load.fxN, value.load.fyN]);
      if (!cases.some(item => item.key === key)) cases.push({ key, label: `${scenario} ${value.load.nodeId} · ${label}`, design: target.design, load: value.load, analysis: target.analysis, original: original.analysis, modified: modified.analysis });
    }
  }
  return cases;
}
export const matchesReading = (reading: Reading, target: MeasurementCase) => reading.designId === target.design.id && reading.presetVersion === target.design.presetVersion && sameLoad(reading.appliedLoad, target.load) && target.design.nodes.some(node => node.id === reading.measuredNodeId);
export const readingsForCases = (readings: readonly Reading[], cases: readonly MeasurementCase[]) => readings.filter(reading => cases.some(target => matchesReading(reading, target)));
const unitFactor = { mm: 1, cm: 10, in: 25.4 } as const;
export const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value / values.length, 0);
export function measurementNumber(raw: string) {
  const trimmed = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return NaN;
  const value = Number(trimmed);
  return value === 0 && /[1-9]/.test(trimmed.split(/[eE]/)[0]!) ? NaN : value;
}

export interface MeasurementDraft {
  readonly measuredNodeId: string;
  readonly units: Reading['units'];
  readonly raw: string;
  readonly resolution: string;
  readonly method: string;
  readonly notes: string;
}
export const blankMeasurementDraft = (target: MeasurementCase): MeasurementDraft => ({ measuredNodeId: target.load.nodeId, units: 'mm', raw: '', resolution: '', method: '', notes: '' });

export function validateReading(reading: Reading, target: MeasurementCase): readonly string[] {
  const errors: string[] = [];
  if (!matchesReading(reading, target)) errors.push('The measurement must match this design, version, load and measured joint.');
  if (!reading.id.trim() || !reading.method.trim() || typeof reading.notes !== 'string') errors.push('Provide a measurement ID, method and text notes.');
  if (!Object.hasOwn(unitFactor, reading.units)) return [...errors, 'Use mm, cm or in.'];
  const scale = unitFactor[reading.units];
  if (!Number.isFinite(reading.displacement * scale)) errors.push('Enter finite vertical displacements in the selected unit.');
  if (reading.instrumentResolution !== null && (!Number.isFinite(reading.instrumentResolution * scale) || reading.instrumentResolution * scale <= 0)) errors.push('Resolution must be positive and finite, or left blank for unknown.');
  if (!Array.isArray(reading.rawReadings) || reading.rawReadings.length > 20 || reading.rawReadings.some(value => !Number.isFinite(value * scale))) errors.push('Use at most 20 finite raw readings.');
  else if (reading.rawReadings.length && Math.abs(mean(reading.rawReadings) - reading.displacement) > 1e-12 * Math.max(1, Math.abs(reading.displacement))) errors.push('Recorded displacement must equal the mean of the raw readings.');
  return errors;
}

/** A resolution screen, never an automatic claim of physical agreement with the model. */
export function assessReading(reading: Reading, target: MeasurementCase) {
  const errors = validateReading(reading, target);
  if (errors.length) throw new Error(errors.join(' '));
  const node = reading.measuredNodeId;
  const predictionMm = -target.analysis.displacementMmByNode[node]!.y;
  const changeMm = Math.abs(target.original.displacementMmByNode[node]!.y - target.modified.displacementMmByNode[node]!.y);
  const resolutionMm = reading.instrumentResolution === null ? null : reading.instrumentResolution * unitFactor[reading.units];
  const spreadMm = reading.rawReadings.length ? (Math.max(...reading.rawReadings) - Math.min(...reading.rawReadings)) * unitFactor[reading.units] : null;
  if (![predictionMm, changeMm].every(Number.isFinite) || (spreadMm !== null && !Number.isFinite(spreadMm))) throw new Error('Measurement comparison exceeds the supported numerical range.');
  const reasons: string[] = [];
  let status: 'unassessed' | 'inconclusive' = 'unassessed';
  if (changeMm <= 1e-12) { status = 'inconclusive'; reasons.push('The model predicts no resolvable brace-induced vertical change at this joint.'); }
  if (resolutionMm !== null && resolutionMm >= changeMm) { status = 'inconclusive'; reasons.push('Instrument resolution is at least as large as the predicted brace-induced change.'); }
  if (spreadMm !== null && spreadMm > 0 && spreadMm >= changeMm) { status = 'inconclusive'; reasons.push('Repeat spread is at least as large as the predicted brace-induced change.'); }
  if (resolutionMm === null) reasons.push('Instrument resolution is unknown.');
  if (reading.rawReadings.length < 3) reasons.push('Fewer than three repeat readings were recorded.');
  if (!reasons.length) reasons.push('Resolution and repeat spread do not rule out observing this change; matched physical tests and an uncertainty review are still needed.');
  return { status, reasons, predictionMm, changeMm, resolutionMm, spreadMm };
}

export function recordMeasurement(draft: MeasurementDraft, target: MeasurementCase, id: string): { status: 'ok'; reading: Reading } | { status: 'error'; errors: readonly string[] } {
  const rawReadings = draft.raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(measurementNumber);
  const reading: Reading = { id, designId: target.design.id, presetVersion: target.design.presetVersion, appliedLoad: target.load, measuredNodeId: draft.measuredNodeId, units: draft.units, rawReadings, displacement: mean(rawReadings), instrumentResolution: draft.resolution.trim() ? measurementNumber(draft.resolution) : null, method: draft.method.trim(), notes: draft.notes.trim(), assessment: 'unassessed' };
  const errors = [...validateReading(reading, target)];
  if (!rawReadings.length) errors.push('Enter at least one raw reading, one per line.');
  if (!reading.notes) errors.push('Describe the physical test conditions.');
  if (errors.length) return { status: 'error', errors };
  try { return { status: 'ok', reading: snapshot({ ...reading, assessment: assessReading(reading, target).status }) }; }
  catch (error) { return { status: 'error', errors: [error instanceof Error ? error.message : 'Invalid measurement.'] }; }
}
