import { useState } from 'react';
import type { Reading } from '../../shared';
import { assessReading, blankMeasurementDraft, matchesReading, recordMeasurement, type MeasurementCase } from './engine';
import type { useMeasurements } from './useMeasurements';
import './measurements.css';

type Props = ReturnType<typeof useMeasurements> & { cases: readonly MeasurementCase[] };
export function MeasurementWorkbench({ cases, readings, drafts, selectedKey, setSelectedKey, setDraft, addReading, removeReading }: Props) {
  const target = cases.find(item => item.key === selectedKey) ?? cases[0];
  const [feedback, setFeedback] = useState<{ key: string; errors: readonly string[]; saved: boolean } | null>(null);
  if (!target) return <section className="measurement-empty"><h2>Select a saved trial first</h2><p>Commit a prediction or restore a saved trial to record measurements for its original and braced designs. No measurement recorded.</p></section>;
  const draft = drafts[target.key] ?? blankMeasurementDraft(target);
  const update = (patch: Partial<typeof draft>) => { setDraft(target.key, { ...draft, ...patch }); setFeedback(null); };
  const matching = readings.filter(reading => cases.some(item => matchesReading(reading, item)));
  function save() {
    const result = recordMeasurement(draft, target!, crypto.randomUUID());
    if (result.status === 'error') setFeedback({ key: target!.key, errors: result.errors, saved: false });
    else { addReading(result.reading); setDraft(target!.key, { ...draft, raw: '' }); setFeedback({ key: target!.key, errors: [], saved: true }); }
  }
  const currentFeedback = feedback?.key === target.key ? feedback : null;
  return <div className="measurement-workbench">
    <p className="measurement-intro">Enter actual observations only. Vertical movement is positive downward and negative upward. This form records a test; it does not certify agreement with the model. Inputs and saved readings stay in this session.</p>
    <section className="workspace-card measurement-editor" aria-labelledby="measurement-heading"><div className="card-heading"><h2 id="measurement-heading">Record a physical test</h2><span className="tag">Optional evidence</span></div><div className="measurement-fields">
      <label htmlFor="measurement-case">Design and load case</label><select id="measurement-case" value={target.key} onChange={event => { setSelectedKey(event.target.value); setFeedback(null); }}>{cases.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
      <p className="input-hint">{target.design.id} · {target.design.presetVersion} · applied load ({target.load.fxN}, {target.load.fyN}) N at {target.load.nodeId}. Record actual load sharing and supports below.</p>
      <div className="measurement-grid"><div><label htmlFor="measurement-joint">Measured joint</label><select id="measurement-joint" value={draft.measuredNodeId} onChange={event => update({ measuredNodeId: event.target.value, raw: '', resolution: '' })}>{target.design.nodes.map(node => <option key={node.id}>{node.id}</option>)}</select></div><div><label htmlFor="measurement-unit">Reading units</label><select id="measurement-unit" value={draft.units} onChange={event => update({ units: event.target.value as Reading['units'] })}><option>mm</option><option>cm</option><option>in</option></select></div></div>
      <p className="input-hint">Changing the measured joint clears unsaved readings and resolution. Changing units reinterprets the entries; it does not convert them.</p>
      <label htmlFor="measurement-raw">Raw vertical readings (one per line)</label><textarea id="measurement-raw" rows={4} value={draft.raw} onChange={event => update({ raw: event.target.value })} placeholder="Enter observations, one per line" aria-describedby="measurement-raw-help" /><p id="measurement-raw-help" className="input-hint">Use up to 20 readings in {draft.units}; decimal/scientific notation, no comma grouping. Zero is an observation; blank means no observation. The saved displacement is their mean.</p>
      <div className="measurement-grid"><div><label htmlFor="measurement-resolution">Instrument resolution ({draft.units})</label><input id="measurement-resolution" inputMode="decimal" value={draft.resolution} onChange={event => update({ resolution: event.target.value })} placeholder="Unknown" /></div><div><label htmlFor="measurement-method">Measurement method</label><input id="measurement-method" value={draft.method} onChange={event => update({ method: event.target.value })} placeholder="Instrument and procedure" /></div></div>
      <label htmlFor="measurement-notes">Physical test conditions</label><textarea id="measurement-notes" rows={3} value={draft.notes} onChange={event => update({ notes: event.target.value })} placeholder="Prototype, materials and joints, supports, applied load, load sharing and uncertainty" />
      {currentFeedback && currentFeedback.errors.length > 0 && <div role="alert" className="measurement-feedback"><h3>Check the measurement</h3><ul>{currentFeedback.errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
      <button type="button" className="primary-button" onClick={save}>Save measurement</button><p role="status">{currentFeedback?.saved ? 'Measurement saved. Raw values and conditions are preserved.' : ''}</p>
    </div></section>
    <section className="measurement-records" aria-labelledby="measurement-records-heading"><h2 id="measurement-records-heading">Saved physical observations</h2><p>Matching cases appear in a new decision sheet. Retest readings require the retest to be included. Long evidence can exceed one page; full readings remain in the snapshot JSON.</p>
      {matching.length === 0 && <p>No measurement recorded for these cases.</p>}
      {matching.map((reading, index) => { const item = cases.find(value => matchesReading(reading, value))!; const assessment = assessReading(reading, item); return <article className="workspace-card measurement-record" key={reading.id} aria-label={`Measurement ${index + 1}`}><div className="card-heading"><h3>{item.label} · joint {reading.measuredNodeId}</h3><button type="button" className="text-button" aria-label={`Remove measurement ${index + 1}`} onClick={() => removeReading(reading.id)}>Remove</button></div><div className="measurement-record-body"><p><strong>Mean: {reading.displacement.toPrecision(6)} {reading.units}</strong> · {reading.method}</p><p>Raw readings: {reading.rawReadings.join(', ')} {reading.units}. Resolution: {reading.instrumentResolution === null ? 'unknown' : `${reading.instrumentResolution} ${reading.units}`}.</p><p>{reading.notes}</p><p>Model vertical movement at this joint: {assessment.predictionMm.toFixed(6)} mm downward. Predicted brace-induced change: {assessment.changeMm.toFixed(6)} mm.</p><p><strong>{assessment.status === 'inconclusive' ? 'Inconclusive for resolving the predicted change.' : 'Agreement with the model remains unassessed.'}</strong> {assessment.reasons.join(' ')}</p></div></article>; })}
      {readings.length > matching.length && <p>{readings.length - matching.length} saved observation(s) belong to other design/load cases and are not shown or included here.</p>}
    </section>
  </div>;
}
