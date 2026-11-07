import type { AmountSource, CalculatedAmount, CostField, ReportPayload, Trial } from '../../shared';
import { assessSavings } from '../costs';
import { ReportSketch } from './ReportSketch';
import { assessReading, matchesReading, measurementCases } from '../measurements';

const money = (usd: number) => usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const amountText = (amount: CalculatedAmount) => amount.status === 'known' ? money(amount.usd) : 'Unknown';
const sourceName = (source: AmountSource) => ({ 'supplier-quote': 'Supplier quote', 'user-estimate': 'User estimate', 'demo-assumption': 'Fictional demo assumption' })[source.kind];
const fields: readonly [CostField, string][] = [['materials', 'Materials'], ['freight', 'Freight'], ['installation', 'Installation'], ['cashContribution', 'Cash contribution'], ['annualUpkeep', 'Annual upkeep / year']];
const force = (value: number) => Math.abs(value) < 1e-9 ? '0.000 N (zero)' : `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(3)} N (${value > 0 ? 'tension' : 'compression'})`;

function Prediction({ trial }: { trial: Pick<Trial, 'results' | 'chosenPanelId' | 'load'> }) {
  const { results, chosenPanelId, load } = trial;
  const chosen = results.candidates[chosenPanelId];
  const added = chosen.design.members.find(member => !results.baseline.design.members.some(original => original.id === member.id))!;
  return <><p><strong>{load.nodeId} · {chosenPanelId}:</strong> loaded-joint displacement {results.baseline.analysis.loadedJointDisplacementMm.toFixed(6)} → <strong>{chosen.analysis.loadedJointDisplacementMm.toFixed(6)} mm</strong>. Reduction: <strong>{chosen.change.kind === 'relative' ? `${chosen.change.reductionPercent.toFixed(2)}%` : `${chosen.change.reductionMm.toFixed(6)} mm (zero baseline; percentage undefined)`}</strong>. Best for this load: {results.bestIds.join(' + ')}{results.bestIds.length > 1 ? ' (tie)' : ''}.</p><p>Added brace {added.startNodeId}–{added.endNodeId}: <strong>{force(chosen.analysis.axialForceNByMember[added.id]!)}</strong>. Positive = tension; negative = compression.</p></>;
}

/** Presentation consumes only a frozen payload; no hooks, stores, solver calls or live input access. */
export function DecisionSheet({ report }: { report: ReportPayload }) {
  const { trial, retest, quotes, costs } = report;
  const chosen = trial.results.candidates[trial.chosenPanelId];
  const physicalCases = measurementCases(trial, retest);
  const braceId = chosen.design.members.find(member => !trial.results.baseline.design.members.some(original => original.id === member.id))?.id;
  const sources: AmountSource[] = [];
  const sourceIndex = (source: AmountSource) => {
    const index = sources.findIndex(item => item.kind === source.kind && item.label === source.label);
    if (index !== -1) return index + 1;
    sources.push(source); return sources.length;
  };
  const costRows = fields.map(([field, label]) => <tr key={field}><th scope="row">{label}</th>{quotes.packages.map(pkg => <td key={pkg.id}>{pkg[field].status === 'known' ? <>{money(pkg[field].usd)} <sup>[{sourceIndex(pkg[field].source)}]</sup></> : <>Unknown{pkg[field].note ? ` — ${pkg[field].note}` : ''}</>}</td>)}</tr>);
  const premium = costs.status === 'ok' ? costs.breakEven : null;
  return <article className="decision-sheet" aria-label="Captured decision sheet">
    <header className="sheet-header"><div><p className="sheet-kicker">FORMA / NOVA · DECISION RECORD</p><h1>One brace. The evidence.</h1></div><div><strong>Frozen snapshot</strong><br /><time dateTime={report.createdAtIso}>{report.createdAtIso.replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC')}</time></div></header>
    <section aria-labelledby="sheet-changed"><h2 id="sheet-changed">01 / What changed</h2><p><strong>Scenario S · Selected saved trial:</strong> 10 N downward at <strong>{trial.load.nodeId}</strong>; added brace <strong>{trial.chosenPanelId}</strong>. One modeled side; B0 pin, B4 vertical roller.</p>
      <div className="sheet-sketches"><ReportSketch design={trial.results.baseline.design} analysis={trial.results.baseline.analysis} load={trial.load} title="Original · 17 members" /><ReportSketch design={chosen.design} analysis={chosen.analysis} load={trial.load} title={`Modified · brace ${trial.chosenPanelId}`} braceId={braceId} /></div>
      <p className="sheet-caption">Gray: undeformed geometry. Dashed: deformed members. Heavy solid: added brace. Both deformations ×200; sketches are not assembly templates.</p>
    </section>
    <section aria-labelledby="sheet-predicted"><h2 id="sheet-predicted">02 / Predicted</h2><Prediction trial={trial} />{retest && <div className="sheet-retest"><h3>Scenario R · Same-brace retest (separate from saved prediction)</h3><Prediction trial={retest} /></div>}</section>
    <section aria-labelledby="sheet-measured"><h2 id="sheet-measured">03 / Measured</h2>{report.readings.length === 0 ? <p>No measurement recorded.</p> : report.readings.map(reading => {
      const target = physicalCases.find(item => matchesReading(reading, item))!;
      const assessment = assessReading(reading, target);
      return <div className="sheet-reading" key={reading.id}><p><strong>{target.label} · joint {reading.measuredNodeId}: {reading.displacement.toPrecision(6)} {reading.units} mean</strong> (downward positive). Load ({reading.appliedLoad.fxN}, {reading.appliedLoad.fyN}) N at {reading.appliedLoad.nodeId} · {reading.method}.</p><p>Raw: {reading.rawReadings.length ? `${reading.rawReadings.join(', ')} ${reading.units}` : 'none'}. Resolution: {reading.instrumentResolution === null ? 'unknown' : `${reading.instrumentResolution} ${reading.units}`}. {reading.notes}</p><p><strong>{assessment.status === 'inconclusive' ? 'Inconclusive for the predicted change.' : 'Model agreement unassessed.'}</strong> {assessment.reasons.join(' ')}</p></div>;
    })}</section>
    <section aria-labelledby="sheet-costs"><h2 id="sheet-costs">04 / Cost comparison</h2><p><strong>Scenario C · Independent planning packages.</strong> Common scope: {quotes.packages[0].scope}</p><p>Budget <strong>{money(quotes.budgetUsd)}</strong> · {quotes.years} years · {quotes.realRate * 100}% real annual rate · real USD.</p>
      <table className="sheet-cost-table"><caption className="sr-only">Captured package inputs and calculated costs in USD</caption><thead><tr><th scope="col">Amount / source</th>{quotes.packages.map(pkg => <th scope="col" key={pkg.id}>{pkg.label}</th>)}</tr></thead><tbody>{costRows}{costs.status === 'ok' && ([['upfront', 'Upfront cost'], ['fundingGap', 'Funding gap today'], ['presentCost', 'Discounted total']] as const).map(([key, label]) => <tr className="sheet-total" key={key}><th scope="row">{label}</th>{costs.packages.map(pkg => <td key={pkg.packageId}>{amountText(pkg[key])}</td>)}</tr>)}</tbody></table>
      <div className="sheet-sources">{sources.map((source, i) => <p key={i}>[{i + 1}] <strong>{sourceName(source)}:</strong> {source.label}</p>)}</div>
      {quotes.packages.filter(pkg => pkg.donationNote.trim()).map(pkg => <p key={pkg.id}>{pkg.label} notes: {pkg.donationNote}</p>)}
      {premium?.status === 'premium' ? <p><strong>Break-even:</strong> {quotes.packages.find(pkg => pkg.id === premium.higherUpfrontPackageId)!.label} costs {money(premium.upfrontPremiumUsd)} more upfront and needs <strong>{money(premium.requiredAnnualSavingsUsd)}/year</strong> in upkeep savings. Expected: {amountText(premium.expectedAnnualSavings)}{premium.expectedAnnualSavings.status === 'known' ? `/year (${assessSavings(premium)} threshold)` : ' — upkeep inputs missing'}.</p> : premium?.status === 'equal-upfront' ? <p><strong>Break-even:</strong> equal upfront costs; no premium to recover. Required annual savings: $0.00.</p> : <p><strong>Break-even:</strong> unknown; upfront inputs are missing.</p>}
      <p className="sheet-caption">Blank amounts stay unknown; zero is explicit. Cash contributions apply once, capped at upfront cost; excess does not offset upkeep. Expected savings = lower-upfront upkeep minus higher-upfront upkeep. Affordability and long-term cost answer different questions.</p>
    </section>
    <section aria-labelledby="sheet-assumptions"><h2 id="sheet-assumptions">05 / Open assumptions</h2><ul>{report.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul></section>
    <footer className="sheet-footer"><p>Trial: {trial.id} · Report: {report.reportId}</p><p>Preset: {trial.presetVersion} · Solver: {trial.solverVersion} · Schema {report.schemaVersion}. For design discussion and supplier / engineering review.</p></footer>
  </article>;
}
