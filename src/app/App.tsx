import { useState } from 'react';
import { FIXED_LOAD_FY_N, LOAD_NODE_IDS, PRESET_DEFAULTS } from '../shared';

type View = 'experiment' | 'costs';

export function App() {
  // Shell navigation only. Experiment state and commit/retest behavior arrive in Phase 3.
  const [view, setView] = useState<View>('experiment');

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
        <span className="preview-label"><span aria-hidden="true" />Foundation preview</span>
      </header>

      <main id="workspace" tabIndex={-1}>
        <div className="page-heading">
          <p className="eyebrow">A SMALL EXPERIMENT. A CLEARER DECISION.</p>
          <h1>{view === 'experiment' ? 'Where should one extra brace go?' : 'What will each option really cost?'}</h1>
          <p className="intro">{view === 'experiment'
            ? 'Choose where the load acts, predict which panel needs a brace, then put your intuition to the test.'
            : 'Compare the cash needed today with upkeep over time, using two packages that provide the same service.'}</p>
        </div>

        {view === 'experiment' ? <ExperimentPlaceholder /> : <CostsPlaceholder />}

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
        <span>Foundation only. No analysis or cost calculations are active yet.</span>
      </footer>
    </div>
  );
}

function ExperimentPlaceholder() {
  return (
    <section className="workspace-grid" aria-label="Bridge experiment">
      <div className="workspace-card">
        <div className="card-heading"><h2>Bridge workspace</h2><span className="tag">Fixed preset</span></div>
        <div className="empty-canvas">
          <span className="canvas-cross top-left" aria-hidden="true">+</span>
          <span className="canvas-cross bottom-right" aria-hidden="true">+</span>
          <div className="empty-content">
            <span className="step-number" aria-hidden="true">01</span>
            <h3>Your experiment starts here</h3>
            <p>The interactive bridge and validated analysis are coming next. No predicted result is available in this preview.</p>
          </div>
        </div>
        <dl className="preset-facts">
          <div><dt>Panels</dt><dd>{PRESET_DEFAULTS.bayCount}</dd></div>
          <div><dt>Load positions</dt><dd>{LOAD_NODE_IDS.length}</dd></div>
          <div><dt>Downward load</dt><dd>{Math.abs(FIXED_LOAD_FY_N)} <span>N</span></dd></div>
          <div><dt>Brace allowance</dt><dd>1</dd></div>
        </dl>
      </div>
      <aside className="sequence-card" aria-labelledby="sequence-heading">
        <p className="eyebrow">THE EXPERIMENT</p>
        <h2 id="sequence-heading">Predict. Test. Challenge.</h2>
        <ol className="sequence">
          <li><span>01</span><div><h3>Position the load</h3><p>Choose one of three interior deck joints.</p></div></li>
          <li><span>02</span><div><h3>Choose your brace</h3><p>Pick one panel before seeing the ranking.</p></div></li>
          <li><span>03</span><div><h3>Challenge the result</h3><p>Keep your brace and move the load to another joint.</p></div></li>
        </ol>
        <button className="primary-button" disabled type="button">Commit prediction</button>
        <p className="availability">Available when the experiment is connected.</p>
      </aside>
    </section>
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
