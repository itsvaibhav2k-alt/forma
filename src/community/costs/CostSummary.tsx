import type { CalculatedAmount, Costs, QuoteInputs } from '../../shared';
import { assessSavings } from './engine/compareQuotes';
import { costInsights, type CostComparison } from './engine/cost-insights';

export const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export const FIELD_LABELS = { materials: 'materials', freight: 'freight', installation: 'installation', cashContribution: 'cash contribution', annualUpkeep: 'annual upkeep' };

function Amount({ value }: { value: CalculatedAmount }) {
  return value.status === 'known' ? <strong>{money(value.usd)}</strong> : <><strong className="unknown-cost">Unknown</strong><span className="missing-cost">Missing {value.missing.map(item => FIELD_LABELS[item.field]).join(', ')}</span></>;
}

function Comparison({ value, metric }: { value: CostComparison; metric: 'annual upkeep' | 'discounted total' }) {
  if (value.status === 'unknown') return <>Unknown until {metric} is known for {value.missingPackageLabels.join(' and ')}. No lower-cost package is identified.</>;
  if (value.status === 'equal') return <>Both packages have equal {metric} before display rounding.</>;
  return <><strong>{value.lowerLabel}</strong> has lower {metric} than {value.higherLabel} by <strong>{value.differenceUsd < 0.005 ? 'less than $0.01' : money(value.differenceUsd)}</strong>{metric === 'annual upkeep' ? ' per year' : ' over the selected horizon'}.</>;
}

export function CostSummary({ inputs, costs }: { inputs: QuoteInputs; costs: Costs }) {
  const premium = costs.breakEven;
  const insights = costInsights(inputs, costs);
  const higher = premium.status === 'premium' ? inputs.packages.find(pkg => pkg.id === premium.higherUpfrontPackageId)! : null;
  const assessment = assessSavings(premium);
  const summary = costs.packages.map((pkg, i) => `${inputs.packages[i]!.label}: upfront ${pkg.upfront.status === 'known' ? money(pkg.upfront.usd) : 'unknown'}, gap ${pkg.fundingGap.status === 'known' ? money(pkg.fundingGap.usd) : 'unknown'}, present cost ${pkg.presentCost.status === 'known' ? money(pkg.presentCost.usd) : 'unknown'}.`).join(' ');
  return <section className="cost-results" aria-labelledby="cost-results-heading">
    <div className="section-heading"><h2 id="cost-results-heading">Cash today. Cost over time.</h2><p>USD · {inputs.years} years · {(inputs.realRate * 100).toLocaleString('en-US', { maximumFractionDigits: 6 })}% real rate</p></div>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{summary}</p>
    <p className="cost-reading">Upfront cost is the cash needed now. Funding gap is the part above your budget. Discounted total adds every year of upkeep in today’s dollars, so a cheaper-to-run package can win over time.</p>
    <section className="break-even-card cost-efficiency-card" aria-labelledby="cost-efficiency-heading"><h3 id="cost-efficiency-heading">Cost efficiency under these assumptions</h3>
      <p><Comparison value={insights.discountedTotal} metric="discounted total" /></p>
      <p><Comparison value={insights.annualUpkeep} metric="annual upkeep" /></p>
      <p className="cost-fine-print">For the declared common scope over {inputs.years} years at {(inputs.realRate * 100).toLocaleString('en-US', { maximumFractionDigits: 6 })}% real discount rate. Lower modeled cost does not establish equal quality, durability or suitability.</p>
    </section>
    <div className="cost-summary-grid">{costs.packages.map((pkg, i) => { const upkeep = inputs.packages[i]!.annualUpkeep; return <article key={pkg.packageId} className="workspace-card cost-summary-card" aria-label={`${inputs.packages[i]!.label} cost results`}>
      <div className="card-heading"><h3>{inputs.packages[i]!.label}</h3><span className="tag">Option {i === 0 ? 'A' : 'B'}</span></div>
      <dl><div><dt>Upfront cost</dt><dd><Amount value={pkg.upfront} /></dd></div><div><dt>Upfront funding gap</dt><dd><Amount value={pkg.fundingGap} />{pkg.fundingGap.status === 'known' && <span className="funding-status">{pkg.fundingGap.usd === 0 ? 'Fits the upfront budget' : 'Additional upfront funding needed'}</span>}</dd></div><div><dt>Annual upkeep</dt><dd>{upkeep.status === 'known' ? <strong>{money(upkeep.usd)} <small>/ year</small></strong> : <strong className="unknown-cost">Unknown</strong>}</dd></div><div className="present-cost"><dt>Discounted total over {inputs.years} years</dt><dd><Amount value={pkg.presentCost} /></dd></div></dl>
    </article>; })}</div>
    <div className="break-even-card" aria-labelledby="break-even-heading"><p className="eyebrow">THE UPFRONT TRADEOFF</p><h3 id="break-even-heading">What upkeep savings would justify the premium?</h3>
      {premium.status === 'unknown' ? <p>The threshold is unknown until both upfront costs are known. Missing: {premium.missing.map(item => `${inputs.packages.find(pkg => pkg.id === item.packageId)!.label} — ${FIELD_LABELS[item.field]}`).join('; ')}.</p>
        : premium.status === 'equal-upfront' ? <><p>Neither package has a higher upfront cost. No upfront premium needs to be recovered.</p><p>Required annual savings: <strong>{money(0)}</strong>. Compare upkeep, scope and non-cost priorities.</p></>
          : <><p><strong>{higher!.label}</strong> costs <strong>{money(premium.upfrontPremiumUsd)}</strong> more upfront.</p>
            <div className="break-even-metrics"><div><span>Required annual upkeep savings</span><strong>{money(premium.requiredAnnualSavingsUsd)}<small> / year</small></strong></div><div><span>Expected annual upkeep savings</span><Amount value={premium.expectedAnnualSavings} /></div></div>
            <p className="savings-assessment">{assessment === 'above' ? 'Expected savings exceed the threshold under these assumptions.' : assessment === 'at' ? 'Expected savings equal the threshold; discounted totals agree before display rounding.' : assessment === 'below' ? 'Expected savings are below the threshold under these assumptions.' : 'Enter both upkeep estimates to compare expected savings with the threshold.'}</p>
            <p className="cost-fine-print">Expected saving is the lower-upfront package’s annual upkeep minus the higher-upfront package’s upkeep. A negative value means the higher-upfront option also costs more to maintain.</p></>}
    </div>
  </section>;
}
