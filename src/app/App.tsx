import { useState } from 'react';
import type { RankBraces } from '../shared';
import { rankBraces } from '../structures';
import { Experiment } from '../studio';
import { experimentDisplay } from './experiment/state';
import { useExperiment } from './experiment/useExperiment';
import { useQuotes } from '../community/costs/useQuotes';
import { CostWorkbench } from '../community/costs/CostWorkbench';

type View = 'experiment' | 'costs';

export function App({ ranker = rankBraces }: { ranker?: RankBraces } = {}) {
  const [view, setView] = useState<View>('experiment');
  const experiment = useExperiment(ranker);
  const display = experimentDisplay(experiment.state);
  const quotes = useQuotes();

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
        </nav>
        <span className="preview-label"><span aria-hidden="true" />Interactive experiment</span>
      </header>

      <main id="workspace" tabIndex={-1}>
        <div className="page-heading">
          <p className="eyebrow">A SMALL EXPERIMENT. A CLEARER DECISION.</p>
          <h1>{view === 'experiment' ? 'Where should one extra brace go?' : 'What will each option really cost?'}</h1>
          <p className="intro">{view === 'experiment'
            ? 'Choose where the load acts, predict which panel needs a brace, then put your intuition to the test.'
            : 'Compare the cash needed today with upkeep over time, using two packages that provide the same service.'}</p>
        </div>

        {view === 'experiment' ? <Experiment baseline={experiment.baseline} {...display}
          trials={experiment.state.trials} isRetest={experiment.state.retest.status !== 'idle'}
          onLoadChange={experiment.moveLoad} onPanelChange={panelId => experiment.dispatch({ type: 'prediction/select-panel', panelId })}
          onCommit={experiment.commit} onStart={experiment.startRound}
          onSelectTrial={trialId => experiment.dispatch({ type: 'trial/select', trialId })} /> : <CostWorkbench {...quotes} />}

        <section className="report-strip" aria-labelledby="report-heading">
          <div>
            <p className="eyebrow">TAKE THE REASONING WITH YOU</p>
            <h2 id="report-heading">One page. Your decision and its assumptions.</h2>
            <p>A decision sheet will bring together your selected trial, cost comparison, and any measurements.</p>
          </div>
          <button className="outline-button" disabled type="button">Decision sheet · Coming later</button>
        </section>
      </main>

      <footer className="site-footer">
        <span>Forma / NOVA 2026</span>
        <span>Ideal truss model · Independent cost comparison · Session-only data</span>
      </footer>
    </div>
  );
}
