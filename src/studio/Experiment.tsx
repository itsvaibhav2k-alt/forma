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
  const [selectedPart, setSelectedPart] = useState<{ label: string; description: string } | null>(null);
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
        <div className="card-heading vbar"><div className="viewport-title sr-only"><h2>Bridge workspace</h2><span className="tag">{legacy ? 'Earlier solver · Read-only' : locked ? isRetest ? 'Same brace · New load' : `Saved trial ${trialNumber}` : 'Make your prediction'}</span></div>
        <div className="representation-controls" role="group" aria-label="Bridge representation">
          <span className="sr-only">Representation</span>{(['assembly', 'structural'] as const).map(value => <button key={value} type="button" aria-label={value === 'assembly' ? 'Assembly' : 'Structural'} aria-pressed={representation === value} onClick={() => setRepresentation(value)}><span aria-hidden="true">{value === 'assembly' ? '▱' : '▧'}</span>{value === 'assembly' ? 'Assembly' : 'Structural view'}</button>)}
        </div>{representation === 'assembly' && <span id="assembly-mode-toolbar" />}{representation === 'structural' && <div className="analysis-tabs" role="group" aria-label="Structural analysis layer"><button type="button" aria-pressed={!showForces} onClick={() => { setShowDeformation(true); setShowForces(false); }}>Deformation</button><button type="button" aria-pressed={showForces} onClick={() => { setShowDeformation(false); setShowForces(true); }}>Axial forces</button></div>}</div>
        {representation === 'assembly' ? <ModelView baseline={baseline} loadNodeId={load.nodeId} panelId={panelId} results={results} locked={locked} selectedMemberId={selectedMemberId} onSelectMember={id => { setSelectedMemberId(id); if (id) setSelectedPart(null); }} controlsHostId="assembly-mode-toolbar" onPartSelect={(_id, label, description) => setSelectedPart({ label, description })} /> : <>
        <div className={showReference ? "structural-split" : "structural-stage"}>
        <BridgeCanvas baseline={baseline} loadNodeId={load.nodeId} panelId={panelId} results={results}
          comparison={results ? comparison : 'both'} showDeformation={Boolean(results) && showDeformation} showForces={Boolean(results) && showForces}
          locked={locked} readOnly={readOnly} onLoadChange={onLoadChange} onPanelChange={onPanelChange} selectedMemberId={selectedMemberId} onSelectMember={id => { setSelectedMemberId(id); setSelectedPart(null); }} />
        {showReference && <section className="reference-assembly" aria-label="Reference assembly"><header><h3>Reference assembly</h3><p>{panelId} brace · 10 N at {load.nodeId}{selectedMember ? ` · ${selectedMember.startNodeId}–${selectedMember.endNodeId}` : ''}</p></header><ModelView baseline={baseline} loadNodeId={load.nodeId} panelId={panelId} results={results} locked={locked} selectedMemberId={selectedMemberId} onSelectMember={setSelectedMemberId} compact /></section>}
        </div>
        <div className="structural-footstage footstage"><div className="v8-legend-res">
          <div className="bridge-legend">{results && showForces ? <><span className="tension-text"><i className="legend-line tension" />Tension (+)</span><span className="compression-text"><i className="legend-line compression" />Compression (−)</span><span><i className="legend-line baseline" />Zero force</span></> : results && showDeformation ? <><span><i className="legend-line original" />Original</span><span><i className="legend-line modified" />With brace</span><strong>Displacements ×{DEFORMATION_SCALE} for both</strong></> : <><span><i className="legend-line baseline" />Original members</span><span><i className="legend-line brace" />Brace preview</span><span>B0 pin · B4 roller</span></>}</div>
          <label className="reference-toggle"><input type="checkbox" checked={showReference} onChange={event => setShowReference(event.target.checked)} /> Reference assembly</label>
        </div><div className="v8-status"><span>Single planar truss · 20 mm grid</span>
        {results && <details className="view-controls"><summary>Structural overlays and comparison</summary><div className="structural-overlay-menu">
          <fieldset className="segmented-control"><legend>Compare designs</legend>{(['both', 'original', 'modified'] as const).map(value => <label key={value}><input type="radio" name="comparison" checked={comparison === value} onChange={() => setComparison(value)} /><span>{value === 'both' ? 'Both' : value === 'original' ? 'Original' : 'With brace'}</span></label>)}</fieldset>
          <div className="overlay-toggles"><label><input type="checkbox" checked={showDeformation} onChange={event => setShowDeformation(event.target.checked)} />Deformed shape</label><label><input type="checkbox" checked={showForces} onChange={event => setShowForces(event.target.checked)} />Axial force colors</label></div>
        </div></details>}</div></div>
        </>}

      </div>
      <aside className="sequence-card inspector" aria-labelledby="controls-heading" data-status={locked ? 'committed' : panelId ? 'preview' : 'empty'}>
        <div className="ins-content">
          <header className="fs-ins-head"><span aria-hidden="true">☷</span><h2 id="controls-heading">Experiment</h2><span className="fs-pred-status"><i />{readOnly ? 'Saved result' : locked ? isRetest ? 'Retest' : 'Committed' : 'Preview'}</span></header>
          <div className="selection-field"><label className="field-name" htmlFor="brace-choice">Brace placement</label><div className="selection-title"><span className="fs-brace-glyph" aria-hidden="true">⤢</span><select id="brace-choice" aria-label="Brace placement" value={panelId ?? ''} disabled={locked || readOnly} onChange={event => onPanelChange(event.target.value as PanelId)}><option value="" disabled>Choose a panel</option>{PANEL_IDS.map((id, index) => <option key={id} value={id}>Panel {index + 1}</option>)}</select></div><p className="selection-note">{panelId ? (() => { const brace = createBraceMember(panelId); return `${brace.startNodeId}–${brace.endNodeId}`; })() : 'One extra brace'}</p></div>
          <div className="load-field fm-map"><div className="v8-map-header">Load case<span className="fm-map-foot">10 N downward</span></div>
            <fieldset className="fm-bays" disabled={locked || readOnly}><legend className="sr-only">Choose a panel</legend>{PANEL_IDS.map((id, index) => <label key={id} className="fm-bay" data-selected={panelId === id}><input className="sr-only" type="radio" name="brace-panel" aria-label={id} checked={panelId === id} onChange={() => onPanelChange(id)} /><span className="fm-bay-id">{id}</span><svg aria-hidden="true" viewBox="0 0 60 42" preserveAspectRatio="none"><rect className="fm-bay-fill" x="0" y="1" width="60" height="40" /><path className="fm-rail" d={`M0 1H60M0 41H60M0 1v40${index === 3 ? 'M60 1v40' : ''}`} /><path className="fm-original" d={index < 2 ? 'M0 41 60 1' : 'M0 1 60 41'} />{panelId === id && <path className="fm-candidate" d={index < 2 ? 'M0 1 60 41' : 'M0 41 60 1'} />}<g className="fm-rivets"><circle cx="0" cy="1" r="1.5"/><circle cx="0" cy="41" r="1.5"/>{index === 3 && <><circle cx="60" cy="1" r="1.5"/><circle cx="60" cy="41" r="1.5"/></>}</g></svg></label>)}</fieldset>
            <fieldset className="fm-joints" disabled={readOnly}><legend className="sr-only">Position the load</legend>{LOAD_NODE_IDS.map((id, i) => <label key={id} data-selected={load.nodeId === id}><input className="sr-only" type="radio" name="load-position" aria-label={`${id} ${['Left', 'Center', 'Right'][i]}`} checked={load.nodeId === id} onChange={() => onLoadChange(id)} /><svg aria-hidden="true" viewBox="0 0 12 16"><path className="fm-stem" d="M6 0v12"/><path className="fm-tip" d="M2.5 8.5 6 12l3.5-3.5"/></svg><span>{id}</span></label>)}</fieldset>
          </div>
          {selectedPart && representation === 'assembly' && <section className="part-insight"><p>Assembly part</p><h3>{selectedPart.label}</h3><p>{selectedPart.description}</p><button type="button" onClick={() => { setSelectedPart(null); setRepresentation('structural'); }}>Inspect in structural view ↗</button></section>}
          {(representation === 'structural' || !selectedPart) && selectedMember && <section className="selected-member member-inspector" aria-label="Member inspector"><label htmlFor="selected-member">Selected member</label><select id="selected-member" value={selectedMemberId ?? ''} onChange={event => setSelectedMemberId(event.target.value)}>{[...baseline.members, ...(panelId ? [createBraceMember(panelId)] : [])].map(member => <option key={member.id} value={member.id}>{member.startNodeId}–{member.endNodeId}{member.id.startsWith('brace-') ? ' · brace' : ''}</option>)}</select><p className="member-force">{selectedForce === undefined ? 'Commit to reveal member force' : formatForce(selectedForce)}</p><dl className="v9-member-measure"><div><dt>Length</dt><dd>{memberLength?.toFixed(2)} mm</dd></div><div><dt>Axial extension</dt><dd>{memberExtension === null ? '—' : `${memberExtension >= 0 ? '+' : '−'}${Math.abs(memberExtension).toFixed(5)} mm`}</dd></div></dl></section>}
          {results && panelId && <Results results={results} panelId={panelId} isRetest={isRetest} />}
          <details className="fixed-disclosure" open><summary>Fixed model <span className="summary-dim">240 × 40 mm</span></summary><dl><div><dt>Span × height</dt><dd>240 × 40 mm</dd></div><div><dt>Elastic modulus</dt><dd>{baseline.stocks[0]!.elasticModulusNPerMm2 / 1000} GPa</dd></div><div><dt>Member area</dt><dd>{baseline.stocks[0]!.areaMm2} mm²</dd></div><div><dt>Supports</dt><dd>Pin / roller</dd></div><div><dt>Analyzed geometry</dt><dd>Front truss only</dd></div></dl></details>
          <div className="action-line"><p className="fs-action-foot">{legacy ? 'Earlier solver result · read-only' : inspecting ? 'Saved result · read-only' : locked ? 'Move the load to retest. Your original trial is saved.' : 'Commit to compare the four brace placements.'}</p>{locked && !inspecting ? <button className="outline-button new-round-button" type="button" onClick={event => { if (event.detail < 2) onStart(); }} aria-label="Start another prediction">New prediction <span aria-hidden="true">→</span></button> : <button className="primary-button" type="button" disabled={locked || !panelId || inspecting} onClick={onCommit}>{error ? 'Retry prediction' : 'Commit prediction'} <span aria-hidden="true">→</span></button>}</div>
        </div>
      </aside>
      <div ref={feedback} className="workspace-feedback">
    {error && <section className="analysis-error" role="alert"><h2>Analysis unavailable for {load.nodeId}</h2><p>{error.message}</p><p>{[...error.nodeIds, ...error.memberIds].length > 0 ? `Affected: ${[...error.nodeIds, ...error.memberIds].join(', ')}. ` : ''}No results are shown for this scenario. Saved trials are unchanged.</p>{locked && <button className="outline-button" type="button" onClick={() => onLoadChange(load.nodeId)}>Retry retest</button>}</section>}

    {!results && !error && <div className="prediction-note workspace-card sr-only"><div><h3>Results hidden</h3><p>Displacements, forces and all four rankings will appear after you commit.</p></div></div>}

      </div>
    </section>


    {trial && <section className="saved-prediction" aria-labelledby="saved-heading"><div><p className="eyebrow">ORIGINAL COMMIT · TRIAL {String(trialNumber).padStart(2, '0')}</p><h2 id="saved-heading">Saved prediction: {trial.chosenPanelId} at {trial.load.nodeId}</h2><p>{formatMm(trial.results.baseline.analysis.loadedJointDisplacementMm)} → {formatMm(trial.results.candidates[trial.chosenPanelId].analysis.loadedJointDisplacementMm)} mm · {formatChange(trial.results.candidates[trial.chosenPanelId].change)} reduction</p><p className="saved-note">This first result stays fixed while you retest.</p></div><button className="outline-button" type="button" onClick={event => inspect(event, trial.id)}>Show saved result</button></section>}

    <section ref={history} className="trial-history" aria-labelledby="history-heading"><div className="section-heading"><h2 id="history-heading">Your trials <span>{trials.length.toString().padStart(2, '0')}</span></h2><p>{projectStorage ? 'Save a project once; further edits autosave' : 'Saved for this session · Reloading clears history'}</p></div>
      {trials.length === 0 ? <p className="history-empty">Your first committed prediction will appear here.</p> : <ol>{trials.map((item, index) => <li key={item.id}><button data-trial-id={item.id} type="button" aria-label={`Trial ${String(index + 1).padStart(2, '0')} · Load ${item.load.nodeId} · Brace ${item.chosenPanelId} · ${formatChange(item.results.candidates[item.chosenPanelId].change)} reduction`} aria-pressed={trial?.id === item.id} onClick={event => inspect(event, item.id)}><span className="trial-number">Trial {String(index + 1).padStart(2, '0')}</span><strong>{item.load.nodeId} / {item.chosenPanelId}</strong><span>{formatChange(item.results.candidates[item.chosenPanelId].change)} reduction</span><span className="history-action">{trial?.id === item.id ? 'Selected' : 'View trial'} ↗</span></button></li>)}</ol>}
    </section>
    <details className="model-assumptions"><summary>Model and drawing assumptions</summary><dl className="preset-facts"><div><dt>Span</dt><dd>240 <span>mm</span></dd></div><div><dt>Height</dt><dd>40 <span>mm</span></dd></div><div><dt>Downward load</dt><dd>10 <span>N</span></dd></div><div><dt>Brace allowance</dt><dd>1</dd></div></dl><p>One planar truss side, ideal pin joints, linear elastic members and small displacements. Only labeled nodes are joints; crossed diagonals are unconnected. E = 10,000 N/mm²; A = 10 mm². Deflection means absolute vertical movement at the loaded joint.</p><p>This tabletop model excludes joint slip, bending, buckling and out-of-plane motion. It does not predict failure load. Magnified deformation is illustrative; numerical results retain their actual units.</p></details>
  </div>;
}
