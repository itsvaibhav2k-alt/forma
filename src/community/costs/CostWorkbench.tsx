import type { Dispatch, SetStateAction } from 'react';
import type { AmountSource, CostField, CostResult, QuoteInputs } from '../../shared';
import { CostSummary } from './CostSummary';
import { blankQuoteDraft, editAmount, fictionalQuoteDraft, type AmountDraft, type PackageDraft, type QuoteDraft } from './draft';
import { COST_FIELDS } from './engine/validation';
import './costs.css';

const FIELDS: Record<CostField, string> = { materials: 'Materials', freight: 'Freight', installation: 'Installation', cashContribution: 'Cash contribution', annualUpkeep: 'Annual upkeep' };
const SOURCES: Record<AmountSource['kind'], string> = { 'supplier-quote': 'Supplier quote', 'user-estimate': 'User estimate', 'demo-assumption': 'Demo assumption' };

interface Props {
  draft: QuoteDraft;
  setDraft: Dispatch<SetStateAction<QuoteDraft>>;
  inputs: QuoteInputs;
  result: CostResult;
}

export function CostWorkbench({ draft, setDraft, inputs, result }: Props) {
  const emptyPackages = draft.packages.every(pkg => COST_FIELDS.every(field => pkg.amounts[field].raw.trim() === ''));
  const setupOnly = emptyPackages && result.status === 'error' && result.issues.every(issue => issue.field === 'scope');
  const issues = result.status === 'error' && !setupOnly ? result.issues : [];
  const issueFor = (field: string, packageId?: string) => [...new Set(issues.filter(issue => issue.field === field && (packageId === undefined ? !issue.packageId || field === 'scope' : issue.packageId === packageId)).map(issue => issue.message))].join(' ');
  const updatePackage = (index: number, update: (pkg: PackageDraft) => PackageDraft) => setDraft(current => ({ ...current, packages: current.packages.map((pkg, i) => i === index ? update(pkg) : pkg) as unknown as QuoteDraft['packages'] }));
  const updateAmount = (index: number, field: CostField, update: (amount: AmountDraft) => AmountDraft) => updatePackage(index, pkg => ({ ...pkg, amounts: { ...pkg.amounts, [field]: update(pkg.amounts[field]) } }));
  const hasDemo = draft.packages.some(pkg => COST_FIELDS.some(field => pkg.amounts[field].raw.trim() && pkg.amounts[field].sourceKind === 'demo-assumption'));

  return <div className="cost-workbench">
    <div className="cost-toolbar"><p>This is a separate planning scenario. Prices do not change the bridge model.</p><div><button type="button" className="outline-button" onClick={() => setDraft(fictionalQuoteDraft())}>Load fictional example</button><button type="button" className="text-button" onClick={() => setDraft(blankQuoteDraft())}>Start blank</button></div></div>
    {hasDemo && <p className="demo-notice">Fictional example amounts are labeled “Demo assumption.” Replace them with your own quotes or estimates before making a decision. Editing an example amount relabels it as your estimate.</p>}

    <section className="workspace-card scenario-settings" aria-labelledby="settings-heading"><div className="card-heading"><h2 id="settings-heading">Set an equal-scope comparison</h2><span className="tag">Independent scenario</span></div>
      <div className="settings-body"><label htmlFor="common-scope">Common scope and level of service</label><input id="common-scope" type="text" value={draft.scope} placeholder="e.g. The same materials, delivery, installation and service life" aria-invalid={!!issueFor('scope')} aria-describedby="scope-help scope-error" onChange={event => setDraft({ ...draft, scope: event.target.value })} />
        <p id="scope-help" className="input-hint">Both packages use this description. Confirm they provide the same service over the entire horizon.</p><p id="scope-error" className="field-error">{issueFor('scope')}</p>
        <div className="scenario-input-grid">{([
          ['budget', 'budgetUsd', 'Upfront budget (USD)', 'decimal'], ['years', 'years', 'Horizon (years)', 'numeric'], ['ratePercent', 'realRate', 'Real discount rate (%)', 'decimal'],
        ] as const).map(([key, field, label, inputMode]) => <div key={key}><label htmlFor={`setting-${key}`}>{label}</label><input id={`setting-${key}`} type="text" inputMode={inputMode} value={draft[key]} aria-invalid={!!issueFor(field)} aria-describedby={`error-${key}`} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /><p id={`error-${key}`} className="field-error">{issueFor(field)}</p></div>)}</div>
        <p className="input-hint">Starting settings are editable assumptions: $20,000 budget, 10 years, 3% real rate. Enter 0% for no discounting. Budget changes the funding gap, not total cost.</p>
      </div>
    </section>

    <div id="cost-comparison" className="comparison-anchor">
      {result.status === 'ok' ? <CostSummary inputs={inputs} costs={result} />
        : setupOnly ? <section className="cost-empty"><h2>No comparison yet</h2><p>Describe the common scope, then enter amounts below or load the fictional example. Blank prices stay unknown.</p></section>
          : <section className="analysis-error" role="alert"><h2>Check the comparison inputs</h2><ul>{issues.map((issue, index) => <li key={`${issue.field}-${index}`}>{issue.packageId ? `${draft.packages.find(pkg => pkg.id === issue.packageId)?.label || issue.packageId}: ` : ''}{issue.message}</li>)}</ul><p>No totals from a previous input are shown. Correct the fields to recalculate.</p></section>}
    </div>

    <div className="section-heading package-input-heading"><h2>Enter the two packages</h2><p>Blank = unknown · Enter 0 only when the cost is zero</p></div>
    <div className="package-input-grid">{draft.packages.map((pkg, index) => {
      const letter = index === 0 ? 'A' : 'B';
      const noAmounts = COST_FIELDS.every(field => pkg.amounts[field].raw.trim() === '');
      return <section className="workspace-card quote-editor" aria-label={`Package ${letter} inputs`} key={pkg.id}>
        <div className="card-heading"><h3>Option {letter}</h3>{noAmounts ? <span className="tag">No quote entered</span> : <a href="#cost-comparison">View comparison ↑</a>}</div>
        <div className="package-name"><label htmlFor={`${pkg.id}-label`}>Package {letter} name</label><input id={`${pkg.id}-label`} value={pkg.label} aria-invalid={!!issueFor('label', pkg.id)} aria-describedby={`${pkg.id}-label-error`} onChange={event => updatePackage(index, current => ({ ...current, label: event.target.value }))} /><p className="field-error" id={`${pkg.id}-label-error`}>{issueFor('label', pkg.id)}</p></div>
        {COST_FIELDS.map(field => {
          const amount = pkg.amounts[field];
          const unknown = amount.raw.trim() === '';
          const error = issueFor(field, pkg.id);
          const sourceError = issueFor(`${field}.source`, pkg.id);
          const id = `${pkg.id}-${field}`;
          return <div className="quote-amount-row" key={field}>
            <div className="amount-row-title"><label htmlFor={id}>{FIELDS[field]} <span>{field === 'annualUpkeep' ? '(USD/year)' : '(USD)'}</span></label><span className={unknown ? 'amount-state unknown' : amount.sourceKind === 'demo-assumption' ? 'amount-state demo' : 'amount-state'}>{unknown ? 'Unknown' : SOURCES[amount.sourceKind]}</span></div>
            <div className="amount-entry-grid"><input id={id} aria-label={`Package ${letter} ${FIELDS[field]} (USD${field === 'annualUpkeep' ? '/year' : ''})`} type="text" inputMode="decimal" placeholder="Unknown" value={amount.raw} aria-invalid={!!error} aria-describedby={`${id}-error`} onChange={event => updateAmount(index, field, current => editAmount(current, event.target.value))} />
              <select aria-label={`Package ${letter} ${FIELDS[field]} source type`} value={amount.sourceKind} disabled={unknown} onChange={event => updateAmount(index, field, current => ({ ...current, sourceKind: event.target.value as AmountSource['kind'], sourceLabel: event.target.value === 'user-estimate' ? 'User entry' : '' }))}>{Object.entries(SOURCES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
            </div><p id={`${id}-error`} className="field-error">{error}</p>
            {!unknown && <div className="source-reference"><label htmlFor={`${id}-source`}>Source reference / estimate basis</label><input id={`${id}-source`} aria-label={`Package ${letter} ${FIELDS[field]} source reference`} value={amount.sourceLabel} placeholder="Supplier, date, or basis for this estimate" aria-invalid={!!sourceError} aria-describedby={`${id}-source-error`} onChange={event => updateAmount(index, field, current => ({ ...current, sourceLabel: event.target.value }))} /><p id={`${id}-source-error`} className="field-error">{sourceError}</p></div>}
          </div>;
        })}
        <div className="donation-note"><label htmlFor={`${pkg.id}-donation`}>Package {letter} donation / scope notes</label><textarea id={`${pkg.id}-donation`} rows={2} value={pkg.donationNote} onChange={event => updatePackage(index, current => ({ ...current, donationNote: event.target.value }))} placeholder="Record donated materials and any scope assumptions" /><p className="input-hint">Enter donated materials at the actual purchase cost and explain them here. Cash contributions apply once, capped at materials + freight + installation. Excess does not offset upkeep. Do not credit a material donation twice.</p></div>
      </section>;
    })}</div>

    <section className="cost-assumptions" aria-labelledby="cost-assumptions-heading"><h2 id="cost-assumptions-heading">What these numbers assume</h2><p>All amounts are real USD. Upkeep stays constant and is paid at year end. Discounted total = upfront cost + discounted upkeep. The scope excludes replacement costs and residual value.</p><p>A source label records the basis of an amount; it does not verify a quote. This comparison does not use or certify the tabletop bridge design. Keep non-cost needs, supplier review and remaining uncertainties in the decision.</p><p>Inputs stay in this session. Reloading clears them. Capture a decision sheet below to preserve these inputs with a selected trial.</p></section>
  </div>;
}
