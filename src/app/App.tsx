import { useState } from 'react';
import type { RankBraces } from '../shared';
import { rankBraces } from '../structures';
import { Experiment } from '../studio';
import { experimentDisplay } from './experiment/state';
import { useExperiment } from './experiment/useExperiment';

type View = 'experiment' | 'costs';

export function App({ ranker = rankBraces }: { ranker?: RankBraces } = {}) {
  const [view, setView] = useState<View>('experiment');
  const experiment = useExperiment(ranker);
  const display = experimentDisplay(experiment.state);

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
          onSelectTrial={trialId => experiment.dispatch({ type: 'trial/select', trialId })} /> : <CostsPlaceholder />}

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
        <span>Ideal truss model · Session-only trials · Cost comparison coming next</span>
      </footer>
    </div>
  );
}

function CostsPlaceholder() {
  return (
    <section className="workspace-card cost-workspace" aria-labelledby="cost-heading">
      <div className="card-heading"><h2 id="cost-heading">Compare build options</h2><span className="tag">Separate scenario</span></div>
      <div className="cost-intro"><h3>Start with equal scope. Keep every source visible.</h3><p>Quote entry and financial calculations are coming in a later phase. No package prices or totals have been entered.</p></div>
      <div className="cost-columns">
        <div><span className="step-number" aria-hidden="true">A</span><h3>First package</h3><p>Materials, delivery, installation, contributions, and annual upkeep.</p><span className="empty-label">No quote entered</span></div>
        <div><span className="step-number" aria-hidden="true">B</span><h3>Second package</h3><p>The same scope and level of service, with its own assumptions and sources.</p><span className="empty-label">No quote entered</span></div>
      </div>
      <p className="scenario-note">This comparison will be independent of the tabletop bridge experiment. Unknown prices will stay unknown.</p>
    </section>
  );
}
