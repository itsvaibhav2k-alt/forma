import { useEffect, useState, type ReactNode } from 'react';
import type { Workspace } from '../projects/workspace';
import type { RankBraces, ReportPayload } from '../shared';
import { rankBraces } from '../structures';
import { Experiment } from '../studio';
import { experimentDisplay } from './experiment/state';
import { useExperiment } from './experiment/useExperiment';
import { useQuotes } from '../community/costs/useQuotes';
import { CostWorkbench } from '../community/costs/CostWorkbench';
import { buildDecisionSheet } from '../community/report';
import { ReportPreview } from '../community/report/ReportPreview';
import { measurementCases, readingsForCases } from '../community/measurements';
import { useMeasurements } from '../community/measurements/useMeasurements';
import { MeasurementWorkbench } from '../community/measurements/MeasurementWorkbench';
import { buildAssemblyPattern, type AssemblyPattern } from '../community/template/pattern';
import { AssemblyTemplate } from '../community/template/AssemblyTemplate';
import { Explainer } from './Explainer';

type View = 'experiment' | 'costs' | 'report' | 'measurements' | 'template';
const viewCopy: Record<View, readonly [string, string]> = {
  experiment: ['Where should one extra brace go?', 'Forma is a tabletop experiment with one decision: you may add a single brace to a small truss bridge. Choose where the load acts, predict which panel needs the brace, then test your prediction against a simulated bridge.'],
  costs: ['What will each option really cost?', 'A separate planning tool, independent of the bridge. Compare two build packages that deliver the same thing: the cash needed today and the total cost over the years.'],
  report: ['Your decision, captured.', 'A frozen one-page record of your saved trial, the cost inputs and any measurements. Print it or save it as a PDF.'],
  measurements: ['What did the physical test show?', 'Record what the physical model actually did, tied to its design, load, measured joint and test conditions.'],
  template: ['A pattern for one side.', 'The captured geometry at actual size, with a printer scale check before assembly.'],
};

export function App({ ranker = rankBraces, initialWorkspace, onWorkspaceChange, projectPanel }: { ranker?: RankBraces; initialWorkspace?: Workspace; onWorkspaceChange?: (workspace: Workspace) => void; projectPanel?: ReactNode } = {}) {
  const [view, setView] = useState<View>('experiment');
  const experiment = useExperiment(ranker, initialWorkspace?.experiment);
  const display = experimentDisplay(experiment.state);
  const quotes = useQuotes(initialWorkspace?.quotes);
  const measurements = useMeasurements(initialWorkspace?.measurements);
  const [pattern, setPattern] = useState<AssemblyPattern | null>(initialWorkspace?.pattern ?? null);
  const [report, setReport] = useState<ReportPayload | null>(initialWorkspace?.report ?? null);
  const [includeRetest, setIncludeRetest] = useState(initialWorkspace?.includeRetest ?? false);
  useEffect(() => {
    onWorkspaceChange?.({ schemaVersion: 1, experiment: experiment.state, quotes: quotes.draft,
      measurements: { readings: measurements.readings, drafts: measurements.drafts, selectedKey: measurements.selectedKey },
      report, pattern, includeRetest });
  }, [onWorkspaceChange, experiment.state, quotes.draft, measurements.readings, measurements.drafts, measurements.selectedKey, report, pattern, includeRetest]);
  const [reportError, setReportError] = useState('');
  const canCapture = !!display.trial && quotes.result.status === 'ok';
  const inspecting = experiment.state.inspectedTrialId !== null;
  const trialLabel = display.trial ? `Trial ${String(experiment.state.trials.findIndex(trial => trial.id === display.trial!.id) + 1).padStart(2, '0')} · ${display.trial.chosenPanelId} at ${display.trial.load.nodeId}` : '';
  const activeRetest = !inspecting && experiment.state.retest.status === 'ready' && experiment.state.retest.value.sourceTrialId === display.trial?.id ? experiment.state.retest.value : null;
  const cases = display.trial ? measurementCases(display.trial, activeRetest) : [];
  const reportCases = display.trial ? measurementCases(display.trial, includeRetest ? activeRetest : null) : [];
  const includedReadings = readingsForCases(measurements.readings, reportCases);
  function capturePattern(braced: boolean) {
    if (!display.trial) return;
    try { setPattern(buildAssemblyPattern(display.trial, braced)); setReportError(''); setView('template'); }
    catch (error) { setReportError(error instanceof Error ? error.message : 'The template could not be captured.'); }
  }
  function captureReport() {
    if (!display.trial || !canCapture) return;
    try {
      const captured = buildDecisionSheet({ trial: display.trial,
        retest: includeRetest ? activeRetest : null,
        quotes: quotes.inputs, costs: quotes.result, readings: includedReadings, assumptions: [],
      }, crypto.randomUUID(), new Date().toISOString());
      setReport(captured); setReportError(''); setView('report');
    } catch (error) { setReportError(error instanceof Error ? error.message : 'The sheet could not be captured. Check the selected inputs.'); }
  }

  return (
    <div className={`app-shell ${view === 'experiment' ? 'experiment-shell' : ''}`}>
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Forma home">
          <img src="/forma.svg" width="36" height="36" alt="" />
          <span>Forma<span className="studio-wordmark">Studio</span></span>
        </a>
        <nav className="navigation" aria-label="Workbench views">
          <button type="button" aria-current={view === 'experiment' ? 'page' : undefined} onClick={() => setView('experiment')}>Experiment</button>
          <button type="button" aria-current={view === 'costs' ? 'page' : undefined} onClick={() => setView('costs')}>Compare build options</button>
          {experiment.state.trials.length > 0 && <button type="button" aria-current={view === 'measurements' ? 'page' : undefined} onClick={() => setView('measurements')}>Physical evidence</button>}
          {report && <button type="button" aria-current={view === 'report' ? 'page' : undefined} onClick={() => setView('report')}>Captured sheet</button>}
          {pattern && <button type="button" aria-current={view === 'template' ? 'page' : undefined} onClick={() => setView('template')}>Captured template</button>}
        </nav>
        <span className="preview-label"><span aria-hidden="true" />Interactive experiment</span>
      </header>

      {projectPanel}

      <main id="workspace" tabIndex={-1}>
        <div className="page-heading">
          <p className="eyebrow">A SMALL EXPERIMENT. A CLEARER DECISION.</p>
          <h1>{viewCopy[view][0]}</h1>
          <p className="intro">{viewCopy[view][1]}</p>
        </div>
        <Explainer view={view} open={false} />

        {view === 'experiment' ? <Experiment baseline={experiment.baseline} {...display} projectStorage={!!onWorkspaceChange}
          trials={experiment.state.trials} isRetest={!inspecting && experiment.state.retest.status !== 'idle'}
          inspectedTrialId={experiment.state.inspectedTrialId} onReturn={() => experiment.dispatch({ type: 'trial/return' })}
          onLoadChange={experiment.moveLoad} onPanelChange={panelId => experiment.dispatch({ type: 'prediction/select-panel', panelId })}
          onCommit={experiment.commit} onStart={experiment.startRound}
          onSelectTrial={trialId => experiment.dispatch({ type: 'trial/select', trialId })} />
          : view === 'costs' ? <CostWorkbench {...quotes} projectStorage={!!onWorkspaceChange} />
          : view === 'measurements' ? <MeasurementWorkbench cases={cases} {...measurements} projectStorage={!!onWorkspaceChange} />
          : view === 'template' ? pattern && <AssemblyTemplate pattern={pattern} />
          : report && <ReportPreview report={report} />}

        {(view === 'experiment' || view === 'measurements') && display.trial && <section className="optional-tools" aria-labelledby="optional-heading"><h2 id="optional-heading">Optional physical evidence and pattern</h2><p>Selected saved result: {trialLabel}. Record actual observations or capture a separate, undeformed side-panel pattern from this trial. Printer scale and physical model agreement still need verification.</p><div className="optional-tools-buttons">{view !== 'measurements' && <button className="outline-button" type="button" onClick={() => setView('measurements')}>Record measurements</button>}<button className="outline-button" type="button" onClick={() => capturePattern(false)}>Original assembly template</button><button className="outline-button" type="button" onClick={() => capturePattern(true)}>Braced assembly template</button></div></section>}

        {view !== 'report' && view !== 'template' && <section className="report-strip" aria-labelledby="report-heading">
          <div>
            <p className="eyebrow">TAKE THE REASONING WITH YOU</p>
            <h2 id="report-heading">One page. Your decision and its assumptions.</h2>
            <p>Capture your selected saved prediction with the current cost inputs. Blank prices stay unknown.</p>
          </div>
          <div className="report-capture-controls">
            {display.trial && <p>Selected saved result: {trialLabel}. Costs use the current independent financial inputs.</p>}
            {measurements.readings.length > 0 && <p>{includedReadings.length} matching observation(s) included; {measurements.readings.length - includedReadings.length} from other cases excluded. Saved sheets remain unchanged.</p>}
            {activeRetest && <label><input type="checkbox" checked={includeRetest} onChange={event => setIncludeRetest(event.target.checked)} />Include the current {activeRetest.load.nodeId} retest as a separate scenario</label>}
            {!inspecting && experiment.state.retest.status === 'error' && <p>The failed retest will not be included. The saved prediction remains available.</p>}
            {!display.trial ? <p>Commit a prediction or select a saved trial first.</p> : quotes.result.status === 'error' && <p>Set a common scope and correct errors in Compare build options first. Amounts may remain blank.</p>}
            <button className="outline-button" disabled={!canCapture} type="button" onClick={captureReport}>{report ? 'Capture new sheet' : 'Decision sheet'}</button>
            {reportError && <p role="alert">{reportError}</p>}
          </div>
        </section>}
      </main>

      <footer className="site-footer">
        <span>Forma / NOVA 2026</span>
        <span>Ideal truss model · Independent cost comparison · {projectPanel ? 'Check project status before closing' : 'Session-only data'}</span>
      </footer>
    </div>
  );
}
