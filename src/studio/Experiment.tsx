import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { LOAD_NODE_IDS, PANEL_IDS, type AnalysisError, type Design, type Load, type LoadNodeId, type PanelId, type RankedBraces, type Trial } from '../shared';
import { BridgeCanvas, DEFORMATION_SCALE } from './BridgeCanvas';
import { ModelView } from './ModelView';
import { formatChange, formatForce, formatMm, panelRank } from './format';
import { Results } from './Results';
import { createBraceMember, SOLVER_VERSION } from '../structures';

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
  inspectedTrialId: string | null;
  onReturn: () => void;
  onLoadChange: (id: LoadNodeId) => void;
  onPanelChange: (id: PanelId) => void;
  onCommit: () => void;
  onStart: () => void;
  onSelectTrial: (id: string) => void;
}

export function Experiment({ baseline, load, panelId, results, error, trial, trials, isRetest, projectStorage, inspectedTrialId, onReturn, onLoadChange, onPanelChange, onCommit, onStart, onSelectTrial }: ExperimentProps) {
  const [representation, setRepresentation] = useState<'assembly' | 'structural'>('assembly');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(false);
  const feedback = useRef<HTMLDivElement>(null);
  const previousResults = useRef(results);
  useLayoutEffect(() => {
    // A mobile commit must bring its answer into view; desktop stays in place.
    if (results && !previousResults.current && !inspectedTrialId) {
      const bounds = feedback.current?.getBoundingClientRect();
      if (window.innerWidth <= 740 && bounds && bounds.bottom > window.innerHeight) feedback.current?.scrollIntoView({ block: 'nearest' });
      else if (window.innerWidth > 740) {
        // Closing the first-use guide can leave the viewport above the scroll position.
        const workspace = feedback.current?.closest<HTMLElement>('.workspace-grid');
        if (workspace && workspace.getBoundingClientRect().top < 0) workspace.scrollIntoView({ block: 'start' });
      }
    }
    previousResults.current = results;
  }, [results, inspectedTrialId]);
  const [comparison, setComparison] = useState<'both' | 'original' | 'modified'>('both');
  const [showDeformation, setShowDeformation] = useState(true);
  const [showForces, setShowForces] = useState(false);
  const inspecting = inspectedTrialId !== null;
  const legacy = !!trial && trial.solverVersion !== SOLVER_VERSION;
  const readOnly = inspecting || legacy;
  const opener = useRef<HTMLButtonElement | null>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  const history = useRef<HTMLElement>(null);
  const lastInspectedId = useRef(inspectedTrialId);
  const wasInspecting = useRef(false);
  useLayoutEffect(() => {
    if (inspectedTrialId) returnButton.current?.focus();
    else if (wasInspecting.current) {
      const savedButton = [...(history.current?.querySelectorAll<HTMLButtonElement>('button[data-trial-id]') ?? [])].find(button => button.dataset.trialId === lastInspectedId.current);
      const target = opener.current?.isConnected ? opener.current : savedButton;
      target?.focus();
    }
    wasInspecting.current = inspectedTrialId !== null;
    lastInspectedId.current = inspectedTrialId;
  }, [inspectedTrialId]);
  function inspect(event: MouseEvent<HTMLButtonElement>, id: string) {
    opener.current = event.currentTarget;
    onSelectTrial(id);
  }
  const locked = trial !== undefined;
  const trialNumber = trial ? trials.findIndex(item => item.id === trial.id) + 1 : null;
  const inspectedDesign = panelId && results && comparison !== 'original' ? results.candidates[panelId].design : baseline;
  const inspectedAnalysis = results ? comparison === 'original' || !panelId ? results.baseline.analysis : results.candidates[panelId].analysis : null;
  const selectedMember = inspectedDesign.members.find(member => member.id === selectedMemberId) ?? (panelId && selectedMemberId === `brace-${panelId}` ? createBraceMember(panelId) : null);
  const selectedStart = selectedMember && baseline.nodes.find(node => node.id === selectedMember.startNodeId);
  const selectedEnd = selectedMember && baseline.nodes.find(node => node.id === selectedMember.endNodeId);
  const memberLength = selectedStart && selectedEnd ? Math.hypot(selectedEnd.xMm - selectedStart.xMm, selectedEnd.yMm - selectedStart.yMm) : null;
  const selectedForce = selectedMember ? inspectedAnalysis?.axialForceNByMember[selectedMember.id] : undefined;
  const selectedStock = selectedMember && baseline.stocks.find(stock => stock.id === selectedMember.stockId);
  const memberExtension = selectedStock && memberLength !== null && selectedForce !== undefined ? selectedForce * memberLength / (selectedStock.elasticModulusNPerMm2 * selectedStock.areaMm2) : null;
  const announcement = results && panelId
    ? `${inspecting ? `Inspecting saved trial ${trialNumber}` : isRetest ? 'Retest' : 'Prediction saved'}. ${panelId} ranks ${panelRank(results, panelId)} of 4 at ${load.nodeId}. Reduction ${formatChange(results.candidates[panelId].change)}. ${results.bestIds.length > 1 ? 'Tied best' : 'Best'}: ${results.bestIds.join(' and ')}.`
    : '';

  return <div className="experiment">
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
    {inspecting && <section className="saved-prediction" aria-label="History inspection"><div><h2>Inspecting saved Trial {String(trialNumber).padStart(2, '0')} · {panelId} at {load.nodeId}</h2><p>Read-only saved result. Your current experiment and retest are preserved.</p></div><button ref={returnButton} className="outline-button" type="button" onClick={onReturn}>Back to current experiment</button></section>}
    {legacy && <section className="saved-prediction" aria-label="Earlier solver result"><div><h2>Saved with an earlier solver</h2><p>These results and captured reports are preserved unchanged. Start another prediction to test with the current solver.</p></div></section>}
    <section className="workspace-grid" aria-label="Bridge experiment">
      <div className="workspace-card viewport-card">
        <div className="card-heading"><div className="viewport-title"><h2>Bridge workspace</h2><span className="tag">{legacy ? 'Earlier solver · Read-only' : locked ? isRetest ? 'Same brace · New load' : `Saved trial ${trialNumber}` : 'Make your prediction'}</span></div>
        <div className="representation-controls" role="group" aria-label="Bridge representation">
          <span className="sr-only">Representation</span>{(['assembly', 'structural'] as const).map(value => <button key={value} type="button" aria-pressed={representation === value} onClick={() => setRepresentation(value)}>{value === 'assembly' ? 'Assembly' : 'Structural'}</button>)}
        </div></div>
        {representation === 'assembly' ? <ModelView baseline={baseline} loadNodeId={load.nodeId} panelId={panelId} results={results} locked={locked} selectedMemberId={selectedMemberId} onSelectMember={setSelectedMemberId} /> : <>
        <div className={showReference ? "structural-split" : "structural-stage"}>
        <BridgeCanvas baseline={baseline} loadNodeId={load.nodeId} panelId={panelId} results={results}
          comparison={results ? comparison : 'both'} showDeformation={Boolean(results) && showDeformation} showForces={Boolean(results) && showForces}
          locked={locked} readOnly={readOnly} onLoadChange={onLoadChange} onPanelChange={onPanelChange} selectedMemberId={selectedMemberId} onSelectMember={setSelectedMemberId} />
        {showReference && <section className="reference-assembly" aria-label="Reference assembly"><ModelView baseline={baseline} loadNodeId={load.nodeId} panelId={panelId} results={results} locked={locked} selectedMemberId={selectedMemberId} onSelectMember={setSelectedMemberId} /></section>}
        </div>
        <label className="reference-toggle"><input type="checkbox" checked={showReference} onChange={event => setShowReference(event.target.checked)} /> Reference assembly</label>
        <div className="bridge-legend"><span><i className="legend-line baseline" />Original members</span><span><i className="legend-line brace" />{locked ? 'Your brace' : 'Brace preview'}</span><span>B0 pin · B4 roller</span></div>
        {results && <details className="view-controls"><summary>Structural overlays and comparison</summary>
          <fieldset className="segmented-control"><legend>Compare designs</legend>{(['both', 'original', 'modified'] as const).map(value => <label key={value}><input type="radio" name="comparison" checked={comparison === value} onChange={() => setComparison(value)} /><span>{value === 'both' ? 'Both' : value === 'original' ? 'Original' : 'With brace'}</span></label>)}</fieldset>
          <div className="overlay-toggles"><label><input type="checkbox" checked={showDeformation} onChange={event => setShowDeformation(event.target.checked)} />Deformed shape</label><label><input type="checkbox" checked={showForces} onChange={event => setShowForces(event.target.checked)} />Axial force colors</label></div>

        </details>}
          {results && showDeformation && <div className="bridge-legend deformation-legend"><span><i className="legend-line original" />Original</span><span><i className="legend-line modified" />With brace</span><strong>Displacements ×{DEFORMATION_SCALE} for both</strong></div>}
          {results && showForces && <p className="force-legend"><span className="tension-text">Tension (+)</span> · <span className="compression-text">Compression (−)</span> · Gray = zero. Colors show {comparison === 'original' ? 'original' : 'your braced design'} forces; signed values are below.</p>}
        </>}

      </div>
      <aside className="sequence-card" aria-labelledby="controls-heading">
        <section className="member-inspector" aria-label="Member inspector">
          <p className="eyebrow">{representation === 'assembly' ? 'ASSEMBLY INSPECTOR' : 'STRUCTURAL INSPECTOR'}</p>
          <h3>{selectedMember ? `${selectedMember.startNodeId}–${selectedMember.endNodeId}` : 'Select a member'}</h3>
          {selectedMember ? <><p>{selectedMember.id} · {selectedMember.id.startsWith('brace-') ? 'Added brace' : 'Front truss member'}</p><dl className="inspector-measurements"><div><dt>Length</dt><dd>{memberLength?.toFixed(2)} mm</dd></div><div><dt>Axial force</dt><dd>{selectedForce === undefined ? 'Commit to reveal' : formatForce(selectedForce)}</dd></div><div><dt>Extension</dt><dd>{memberExtension === null ? 'Commit to reveal' : `${memberExtension >= 0 ? '+' : '−'}${Math.abs(memberExtension).toFixed(6)} mm`}</dd></div></dl></> : <p>Click a bar to inspect its geometry and live analysis. Selection follows the reference assembly.</p>}
          {inspectedAnalysis && <details><summary>Support reactions</summary><dl className="inspector-measurements">{Object.entries(inspectedAnalysis.reactionNByNode).map(([id, reaction]) => <div key={id}><dt>{id} · Rx / Ry</dt><dd>{reaction.x.toFixed(3)} / {reaction.y.toFixed(3)} N</dd></div>)}</dl></details>}
          <p className="inspector-note">Illustrative hardware is separate from the analyzed front truss.</p>
        </section>
        <p className="eyebrow">{readOnly ? 'SAVED RESULT' : locked ? 'CHALLENGE YOUR CHOICE' : 'THE EXPERIMENT'}</p>
        <h2 id="controls-heading">{readOnly ? 'Saved result. Read-only.' : locked ? 'Same brace. A different load.' : 'One brace. Your call.'}</h2>
        <fieldset className="choice-fieldset" disabled={readOnly}><legend><span>01</span> Position the load</legend>
          <div className="load-options">{LOAD_NODE_IDS.map((id, i) => <label className="choice-tile" key={id}><input type="radio" name="load-position" value={id} checked={load.nodeId === id} onChange={() => onLoadChange(id)} /><span><strong>{id}</strong>{' '}<small>{['Left', 'Center', 'Right'][i]}</small><i className="choice-check" aria-hidden="true">✓</i></span></label>)}</div>
          <p>{legacy ? 'The saved load is fixed. Start another prediction to use the current solver.' : inspecting ? 'The saved load is fixed. Return to the current experiment to retest.' : representation === 'structural' ? 'Drag the load, use arrow keys, or choose a joint · 10 N downward.' : 'Choose a joint here. Assembly follows the same 10 N load.'}</p>
        </fieldset>
        <fieldset className="choice-fieldset" disabled={locked}><legend><span>02</span> {locked ? 'Your brace is fixed' : 'Choose a panel'}</legend>
          <div className="panel-options">{PANEL_IDS.map(id => <label className="choice-tile" key={id}><input type="radio" name="brace-panel" value={id} checked={panelId === id} onChange={() => onPanelChange(id)} /><span><strong>{id}</strong><i className="choice-check" aria-hidden="true">✓</i></span></label>)}</div>
          <p>{locked ? `${panelId} stays in place during retests. Start another prediction to change it.` : 'One equal-length diagonal. Commit to reveal results.'}</p>
        </fieldset>
        <button className="primary-button" type="button" disabled={locked || !panelId || inspecting} onClick={onCommit}>{locked ? 'Prediction saved' : error ? 'Retry prediction' : 'Commit prediction'}</button>
        <p className="availability">{legacy ? 'Earlier solver results stay fixed. Start another prediction to test a new scenario.' : inspecting ? 'Return to your current experiment to make changes.' : locked ? 'Move the load to retest. Your original trial is saved.' : panelId ? 'Your choice is saved before reveal.' : 'Select a panel to unlock your prediction.'}</p>
        {locked && !inspecting && <button className="outline-button new-round-button" type="button" onClick={onStart}>Start another prediction</button>}
      </aside>
      <div ref={feedback} className="workspace-feedback">
    {error && <section className="analysis-error" role="alert"><h2>Analysis unavailable for {load.nodeId}</h2><p>{error.message}</p><p>{[...error.nodeIds, ...error.memberIds].length > 0 ? `Affected: ${[...error.nodeIds, ...error.memberIds].join(', ')}. ` : ''}No results are shown for this scenario. Saved trials are unchanged.</p>{locked && <button className="outline-button" type="button" onClick={() => onLoadChange(load.nodeId)}>Retry retest</button>}</section>}

    {results && panelId && <Results results={results} panelId={panelId} isRetest={isRetest} />}
    {!results && !error && <div className="prediction-note workspace-card"><div><h3>Results hidden</h3><p>Displacements, forces and all four rankings will appear after you commit.</p></div></div>}

      </div>
    </section>


    {trial && <section className="saved-prediction" aria-labelledby="saved-heading"><div><p className="eyebrow">ORIGINAL COMMIT · TRIAL {String(trialNumber).padStart(2, '0')}</p><h2 id="saved-heading">Saved prediction: {trial.chosenPanelId} at {trial.load.nodeId}</h2><p>{formatMm(trial.results.baseline.analysis.loadedJointDisplacementMm)} → {formatMm(trial.results.candidates[trial.chosenPanelId].analysis.loadedJointDisplacementMm)} mm · {formatChange(trial.results.candidates[trial.chosenPanelId].change)} reduction</p><p className="saved-note">This first result stays fixed while you retest.</p></div><button className="outline-button" type="button" onClick={event => inspect(event, trial.id)}>Show saved result</button></section>}

    <section ref={history} className="trial-history" aria-labelledby="history-heading"><div className="section-heading"><h2 id="history-heading">Your trials <span>{trials.length.toString().padStart(2, '0')}</span></h2><p>{projectStorage ? 'Save a project once; further edits autosave' : 'Saved for this session · Reloading clears history'}</p></div>
      {trials.length === 0 ? <p className="history-empty">Your first committed prediction will appear here.</p> : <ol>{trials.map((item, index) => <li key={item.id}><button data-trial-id={item.id} type="button" aria-label={`Trial ${String(index + 1).padStart(2, '0')} · Load ${item.load.nodeId} · Brace ${item.chosenPanelId} · ${formatChange(item.results.candidates[item.chosenPanelId].change)} reduction`} aria-pressed={trial?.id === item.id} onClick={event => inspect(event, item.id)}><span className="trial-number">Trial {String(index + 1).padStart(2, '0')}</span><strong>{item.load.nodeId} / {item.chosenPanelId}</strong><span>{formatChange(item.results.candidates[item.chosenPanelId].change)} reduction</span><span className="history-action">{trial?.id === item.id ? 'Selected' : 'View trial'} ↗</span></button></li>)}</ol>}
    </section>
    <details className="model-assumptions"><summary>Model and drawing assumptions</summary><dl className="preset-facts"><div><dt>Span</dt><dd>240 <span>mm</span></dd></div><div><dt>Height</dt><dd>40 <span>mm</span></dd></div><div><dt>Downward load</dt><dd>10 <span>N</span></dd></div><div><dt>Brace allowance</dt><dd>1</dd></div></dl><p>One planar truss side, ideal pin joints, linear elastic members and small displacements. Only labeled nodes are joints; crossed diagonals are unconnected. E = 10,000 N/mm²; A = 10 mm². Deflection means absolute vertical movement at the loaded joint.</p><p>This tabletop model excludes joint slip, bending, buckling and out-of-plane motion. It does not predict failure load. Magnified deformation is illustrative; numerical results retain their actual units.</p></details>
  </div>;
}
