import { useState } from 'react';
import { LOAD_NODE_IDS, PANEL_IDS, type AnalysisError, type Design, type Load, type LoadNodeId, type PanelId, type RankedBraces, type Trial } from '../shared';
import { BridgeCanvas, DEFORMATION_SCALE } from './BridgeCanvas';
import { formatChange, formatMm, panelRank } from './format';
import { Results } from './Results';

interface ExperimentProps {
  baseline: Design;
  load: Load;
  panelId: PanelId | null;
  results: RankedBraces | null;
  error: AnalysisError | null;
  trial: Trial | undefined;
  trials: readonly Trial[];
  isRetest: boolean;
  projectStorage?: boolean;
  onLoadChange: (id: LoadNodeId) => void;
  onPanelChange: (id: PanelId) => void;
  onCommit: () => void;
  onStart: () => void;
  onSelectTrial: (id: string) => void;
}

export function Experiment({ baseline, load, panelId, results, error, trial, trials, isRetest, projectStorage, onLoadChange, onPanelChange, onCommit, onStart, onSelectTrial }: ExperimentProps) {
  const [comparison, setComparison] = useState<'both' | 'original' | 'modified'>('both');
  const [showDeformation, setShowDeformation] = useState(true);
  const [showForces, setShowForces] = useState(false);
  const locked = trial !== undefined;
  const trialNumber = trial ? trials.findIndex(item => item.id === trial.id) + 1 : null;
  const announcement = results && panelId
    ? `${isRetest ? 'Retest' : 'Prediction saved'}. ${panelId} ranks ${panelRank(results, panelId)} of 4 at ${load.nodeId}. Reduction ${formatChange(results.candidates[panelId].change)}. ${results.bestIds.length > 1 ? 'Tied best' : 'Best'}: ${results.bestIds.join(' and ')}.`
    : '';

  return <div className="experiment">
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
    <section className="workspace-grid" aria-label="Bridge experiment">
      <div className="workspace-card">
        <div className="card-heading"><h2>Bridge workspace</h2><span className="tag">{locked ? isRetest ? 'Same brace · New load' : `Saved trial ${trialNumber}` : 'Make your prediction'}</span></div>
        <BridgeCanvas baseline={baseline} loadNodeId={load.nodeId} panelId={panelId} results={results}
          comparison={results ? comparison : 'both'} showDeformation={Boolean(results) && showDeformation} showForces={Boolean(results) && showForces}
          locked={locked} onLoadChange={onLoadChange} onPanelChange={onPanelChange} />
        <div className="bridge-legend"><span><i className="legend-line baseline" />Original members</span><span><i className="legend-line brace" />{locked ? 'Your brace' : 'Brace preview'}</span><span>B0 pin · B4 roller</span></div>
        {results && <div className="view-controls">
          <fieldset className="segmented-control"><legend>Compare designs</legend>{(['both', 'original', 'modified'] as const).map(value => <label key={value}><input type="radio" name="comparison" checked={comparison === value} onChange={() => setComparison(value)} /><span>{value === 'both' ? 'Both' : value === 'original' ? 'Original' : 'With brace'}</span></label>)}</fieldset>
          <div className="overlay-toggles"><label><input type="checkbox" checked={showDeformation} onChange={event => setShowDeformation(event.target.checked)} />Deformed shape</label><label><input type="checkbox" checked={showForces} onChange={event => setShowForces(event.target.checked)} />Axial force colors</label></div>
          {showDeformation && <div className="bridge-legend deformation-legend"><span><i className="legend-line original" />Original</span><span><i className="legend-line modified" />With brace</span><strong>Displacements ×{DEFORMATION_SCALE} for both</strong></div>}
          {showForces && <p className="force-legend"><span className="tension-text">Tension (+)</span> · <span className="compression-text">Compression (−)</span> · Gray = zero. Colors show {comparison === 'original' ? 'original' : 'your braced design'} forces; signed values are below.</p>}
        </div>}
        <dl className="preset-facts"><div><dt>Span</dt><dd>240 <span>mm</span></dd></div><div><dt>Height</dt><dd>40 <span>mm</span></dd></div><div><dt>Downward load</dt><dd>10 <span>N</span></dd></div><div><dt>Brace allowance</dt><dd>1</dd></div></dl>
      </div>
      <aside className="sequence-card" aria-labelledby="controls-heading">
        <p className="eyebrow">{locked ? 'CHALLENGE YOUR CHOICE' : 'THE EXPERIMENT'}</p>
        <h2 id="controls-heading">{locked ? 'Same brace. A different load.' : 'One brace. Your call.'}</h2>
        <fieldset className="choice-fieldset"><legend><span>01</span> Position the load</legend>
          <div className="load-options">{LOAD_NODE_IDS.map((id, i) => <label className="choice-tile" key={id}><input type="radio" name="load-position" value={id} checked={load.nodeId === id} onChange={() => onLoadChange(id)} /><span><strong>{id}</strong>{' '}<small>{['Left', 'Center', 'Right'][i]}</small><i className="choice-check" aria-hidden="true">✓</i></span></label>)}</div>
          <p>Drag the arrow, use arrow keys, or choose a joint. Load stays at 10 N.</p>
        </fieldset>
        <fieldset className="choice-fieldset" disabled={locked}><legend><span>02</span> {locked ? 'Your brace is fixed' : 'Choose a panel'}</legend>
          <div className="panel-options">{PANEL_IDS.map(id => <label className="choice-tile" key={id}><input type="radio" name="brace-panel" value={id} checked={panelId === id} onChange={() => onPanelChange(id)} /><span><strong>{id}</strong><i className="choice-check" aria-hidden="true">✓</i></span></label>)}</div>
          <p>{locked ? `${panelId} stays in place during retests. Start another prediction to change it.` : 'Each panel adds one equal-length diagonal. Choose before seeing the results.'}</p>
        </fieldset>
        <button className="primary-button" type="button" disabled={locked || !panelId} onClick={onCommit}>{locked ? 'Prediction saved' : error ? 'Retry prediction' : 'Commit prediction'}</button>
        <p className="availability">{locked ? 'Move the load to retest. Your original trial is saved.' : panelId ? 'Your choice will be saved before results are revealed.' : 'Select a panel to unlock your prediction.'}</p>
        {locked && <button className="outline-button new-round-button" type="button" onClick={onStart}>Start another prediction</button>}
      </aside>
    </section>

    {error && <section className="analysis-error" role="alert"><h2>Analysis unavailable for {load.nodeId}</h2><p>{error.message}</p><p>{[...error.nodeIds, ...error.memberIds].length > 0 ? `Affected: ${[...error.nodeIds, ...error.memberIds].join(', ')}. ` : ''}No results are shown for this scenario. Saved trials are unchanged.</p>{locked && <button className="outline-button" type="button" onClick={() => onLoadChange(load.nodeId)}>Retry retest</button>}</section>}

    {results && panelId && <Results results={results} panelId={panelId} isRetest={isRetest} />}
    {!results && !error && <div className="prediction-note"><span className="step-number">03</span><div><h3>Predict first. Then see what changes.</h3><p>Displacements, forces and all four rankings will appear after you commit.</p></div><span className="hidden-badge">Results hidden</span></div>}

    {trial && <section className="saved-prediction" aria-labelledby="saved-heading"><div><p className="eyebrow">ORIGINAL COMMIT · TRIAL {String(trialNumber).padStart(2, '0')}</p><h2 id="saved-heading">Saved prediction: {trial.chosenPanelId} at {trial.load.nodeId}</h2><p>{formatMm(trial.results.baseline.analysis.loadedJointDisplacementMm)} → {formatMm(trial.results.candidates[trial.chosenPanelId].analysis.loadedJointDisplacementMm)} mm · {formatChange(trial.results.candidates[trial.chosenPanelId].change)} reduction</p><p className="saved-note">This first result stays fixed while you retest.</p></div><button className="outline-button" type="button" onClick={() => onSelectTrial(trial.id)}>Show saved result</button></section>}

    <section className="trial-history" aria-labelledby="history-heading"><div className="section-heading"><h2 id="history-heading">Your trials <span>{trials.length.toString().padStart(2, '0')}</span></h2><p>{projectStorage ? 'Save a project once; further edits autosave' : 'Saved for this session · Reloading clears history'}</p></div>
      {trials.length === 0 ? <p className="history-empty">Your first committed prediction will appear here.</p> : <ol>{trials.map((item, index) => <li key={item.id}><button type="button" aria-label={`Trial ${String(index + 1).padStart(2, '0')} · Load ${item.load.nodeId} · Brace ${item.chosenPanelId} · ${formatChange(item.results.candidates[item.chosenPanelId].change)} reduction`} aria-pressed={trial?.id === item.id} onClick={() => onSelectTrial(item.id)}><span className="trial-number">Trial {String(index + 1).padStart(2, '0')}</span><strong>{item.load.nodeId} / {item.chosenPanelId}</strong><span>{formatChange(item.results.candidates[item.chosenPanelId].change)} reduction</span><span className="history-action">{trial?.id === item.id ? 'Selected' : 'View trial'} ↗</span></button></li>)}</ol>}
    </section>
    <details className="model-assumptions"><summary>Model and drawing assumptions</summary><p>One planar truss side, ideal pin joints, linear elastic members and small displacements. Only labeled nodes are joints; crossed diagonals are unconnected. E = 10,000 N/mm²; A = 10 mm². Deflection means absolute vertical movement at the loaded joint.</p><p>This tabletop model excludes joint slip, bending, buckling and out-of-plane motion. It does not predict failure load. Magnified deformation is illustrative; numerical results retain their actual units.</p></details>
  </div>;
}
