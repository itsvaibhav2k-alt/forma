import { useState } from 'react';
import type { RankBraces, ReportPayload } from '../shared';
import { rankBraces } from '../structures';
import { Experiment } from '../studio';
import { experimentDisplay } from './experiment/state';
import { useExperiment } from './experiment/useExperiment';
import { useQuotes } from '../community/costs/useQuotes';
import { CostWorkbench } from '../community/costs/CostWorkbench';
import { buildDecisionSheet } from '../community/report';
import { ReportPreview } from '../community/report/ReportPreview';

type View = 'experiment' | 'costs' | 'report';

export function App({ ranker = rankBraces }: { ranker?: RankBraces } = {}) {
  const [view, setView] = useState<View>('experiment');
  const experiment = useExperiment(ranker);
  const display = experimentDisplay(experiment.state);
  const quotes = useQuotes();
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [includeRetest, setIncludeRetest] = useState(false);
  const [reportError, setReportError] = useState('');
  const canCapture = !!display.trial && quotes.result.status === 'ok';
  function captureReport() {
    if (!display.trial || !canCapture) return;
    try {
      const captured = buildDecisionSheet({ trial: display.trial,
        retest: includeRetest && experiment.state.retest.status === 'ready' ? experiment.state.retest.value : null,
        quotes: quotes.inputs, costs: quotes.result, readings: [], assumptions: [],
      }, crypto.randomUUID(), new Date().toISOString());
      setReport(captured); setReportError(''); setView('report');
    } catch (error) { setReportError(error instanceof Error ? error.message : 'The sheet could not be captured. Check the selected inputs.'); }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Forma home">
          <img src="/forma.svg" width="36" height="36" alt="" />
          <span>forma<span className="wordmark-period">.</span></span>
        </a>
        <nav className="navigation" aria-label="Workbench views">
          <button type="button" aria-current={view === 'experiment' ? 'page' : undefined} onClick={() => setView('experiment')}>Experiment</button>
          <button type="button" aria-current={view === 'costs' ? 'page' : undefined} onClick={() => setView('costs')}>Compare build options</button>
          {report && <button type="button" aria-current={view === 'report' ? 'page' : undefined} onClick={() => setView('report')}>Captured sheet</button>}
        </nav>
        <span className="preview-label"><span aria-hidden="true" />Interactive experiment</span>
      </header>

      <main id="workspace" tabIndex={-1}>
        <div className="page-heading">
          <p className="eyebrow">A SMALL EXPERIMENT. A CLEARER DECISION.</p>
          <h1>{view === 'experiment' ? 'Where should one extra brace go?' : view === 'costs' ? 'What will each option really cost?' : 'Your decision, captured.'}</h1>
          <p className="intro">{view === 'experiment'
            ? 'Choose where the load acts, predict which panel needs a brace, then put your intuition to the test.'
            : view === 'costs' ? 'Compare the cash needed today with upkeep over time, using two packages that provide the same service.'
              : 'Review the saved evidence, then print it or save it as a PDF.'}</p>
        </div>

        {view === 'experiment' ? <Experiment baseline={experiment.baseline} {...display}
          trials={experiment.state.trials} isRetest={experiment.state.retest.status !== 'idle'}
          onLoadChange={experiment.moveLoad} onPanelChange={panelId => experiment.dispatch({ type: 'prediction/select-panel', panelId })}
          onCommit={experiment.commit} onStart={experiment.startRound}
          onSelectTrial={trialId => experiment.dispatch({ type: 'trial/select', trialId })} /> : view === 'costs' ? <CostWorkbench {...quotes} /> : report && <ReportPreview report={report} />}

        {view !== 'report' && <section className="report-strip" aria-labelledby="report-heading">
          <div>
            <p className="eyebrow">TAKE THE REASONING WITH YOU</p>
            <h2 id="report-heading">One page. Your decision and its assumptions.</h2>
            <p>Capture your selected saved prediction with the current cost inputs. Blank prices stay unknown.</p>
          </div>
          <div className="report-capture-controls">
            {display.trial && <p>Selected: load {display.trial.load.nodeId} · brace {display.trial.chosenPanelId}.</p>}
            {experiment.state.retest.status === 'ready' && <label><input type="checkbox" checked={includeRetest} onChange={event => setIncludeRetest(event.target.checked)} />Include the current {experiment.state.retest.value.load.nodeId} retest as a separate scenario</label>}
            {experiment.state.retest.status === 'error' && <p>The failed retest will not be included. The saved prediction remains available.</p>}
            {!display.trial ? <p>Commit a prediction or select a saved trial first.</p> : quotes.result.status === 'error' && <p>Set a common scope and correct errors in Compare build options first. Amounts may remain blank.</p>}
            <button className="outline-button" disabled={!canCapture} type="button" onClick={captureReport}>{report ? 'Capture new sheet' : 'Decision sheet'}</button>
            {reportError && <p role="alert">{reportError}</p>}
          </div>
        </section>}
      </main>

      <footer className="site-footer">
        <span>Forma / NOVA 2026</span>
        <span>Ideal truss model · Independent cost comparison · Session-only data</span>
      </footer>
    </div>
  );
}
