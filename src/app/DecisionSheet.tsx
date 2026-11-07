
import type {
  DecisionSheetProps,
  Design,
  AnalysisSuccess,
  Amount,
} from '../shared';

function money(amount: Amount): string {
  return amount.status === 'known'
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount.amountUSD)
    : 'Unknown';
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number, digits = 4): string {
  return Number.isFinite(value) ? value.toFixed(digits) : 'Unavailable';
}

function formatForce(value: number): string {
  const direction = value > 0
    ? 'Tension'
    : value < 0
      ? 'Compression'
      : 'Zero force';

  return `${formatNumber(Math.abs(value), 2)} N (${direction})`;
}

function BridgeSketch({
  design,
  title,
}: {
  design: Design;
  title: string;
}) {
  const nodes = design.nodes;

  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));

  const rangeX = Math.max(maxX - minX, 1);
  const rangeY = Math.max(maxY - minY, 1);

  const point = (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId);

    if (!node) return null;

    return {
      x: 25 + ((node.x - minX) / rangeX) * 350,
      y: 20 + ((maxY - node.y) / rangeY) * 125,
    };
  };

  return (
    <figure className="decision-sketch">
      <figcaption>{title}</figcaption>

      <svg
        viewBox="0 0 400 170"
        role="img"
        aria-label={`${title} bridge geometry`}
      >
        {design.members.map((member) => {
          const start = point(member.startNodeId);
          const end = point(member.endNodeId);

          if (!start || !end) return null;

          return (
            <line
              key={member.id}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#475569"
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}

        {nodes.map((node) => {
          const position = point(node.id);

          if (!position) return null;

          return (
            <circle
              key={node.id}
              cx={position.x}
              cy={position.y}
              r="4"
              fill="#2563eb"
            />
          );
        })}
      </svg>
    </figure>
  );
}

function ForceTable({
  baseline,
  revised,
}: {
  baseline: AnalysisSuccess;
  revised: AnalysisSuccess;
}) {
  const memberIds = [
    ...new Set([
      ...Object.keys(baseline.memberForcesN),
      ...Object.keys(revised.memberForcesN),
    ]),
  ];

  return (
    <table>
      <thead>
        <tr>
          <th>Member</th>
          <th>Original force</th>
          <th>Revised force</th>
        </tr>
      </thead>
      <tbody>
        {memberIds.map((id) => (
          <tr key={id}>
            <td>{id}</td>
            <td>
              {baseline.memberForcesN[id] === undefined
                ? 'Unavailable'
                : formatForce(baseline.memberForcesN[id])}
            </td>
            <td>
              {revised.memberForcesN[id] === undefined
                ? 'Unavailable'
                : formatForce(revised.memberForcesN[id])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DecisionSheet({
  model,
  onPrint,
}: DecisionSheetProps) {
  const scenario = model.scenario;
  const structuralResult = scenario?.result;

  const successfulResult =
    structuralResult?.status === 'ok'
      ? structuralResult
      : null;

  const selectedAlternative = successfulResult?.alternatives.find(
    (alternative) => alternative.panelId === scenario?.panelId,
  );

  const baseline = successfulResult?.baseline;
  const revised = selectedAlternative?.analysis;
  const deflection = selectedAlternative?.deflection;

  const finance = model.finance;
  const financeResult = finance.result;

  const formatMeasurement = (value: number) =>
    `${formatNumber(value)} mm`;

  return (
    <article className="decision-sheet">
      <style>{`
        .decision-sheet {
          color: #172033;
          background: white;
          font-family: Arial, sans-serif;
          line-height: 1.4;
          max-width: 1000px;
          margin: 2rem auto;
        }

        .decision-sheet section {
          border-top: 1px solid #cbd5e1;
          padding: 0.75rem 0;
          break-inside: avoid;
        }

        .decision-sheet h2 {
          font-size: 1.1rem;
          margin: 0 0 0.5rem;
        }

        .decision-sheet h3 {
          font-size: 0.95rem;
          margin: 0.75rem 0 0.35rem;
        }

        .decision-sheet p {
          margin: 0.25rem 0;
        }

        .decision-sheet table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
          margin-top: 0.5rem;
        }

        .decision-sheet th,
        .decision-sheet td {
          border: 1px solid #cbd5e1;
          padding: 0.3rem;
          text-align: left;
        }

        .decision-sheet .sketch-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .decision-sheet .decision-sketch {
          margin: 0.5rem 0;
        }

        .decision-sheet .decision-sketch svg {
          width: 100%;
          max-height: 150px;
        }

        .decision-sheet .report-actions {
          margin: 1rem 0;
        }

        .decision-sheet .muted {
          color: #64748b;
          font-size: 0.85rem;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body {
            margin: 0;
          }

          .decision-sheet {
            max-width: none;
            margin: 0;
            font-size: 9pt;
          }

          .decision-sheet .report-actions {
            display: none !important;
          }

          .decision-sheet section {
            padding: 0.35rem 0;
          }

          .decision-sheet h1 {
            font-size: 17pt;
          }

          .decision-sheet h2 {
            font-size: 11pt;
          }

          .decision-sheet h3 {
            font-size: 9pt;
          }

          .decision-sheet table {
            font-size: 7pt;
          }

          .decision-sheet .decision-sketch svg {
            max-height: 100px;
          }

          .decision-sheet,
          .decision-sheet section,
          .decision-sheet table {
            break-inside: avoid;
          }
        }
      `}</style>

      <header>
        <h1>{model.title}</h1>
        <p>
          Engineering and community cost comparison report
        </p>
        <p className="muted">
          Preset: {scenario?.presetVersion ?? 'No committed scenario'}
        </p>
      </header>

      <div className="report-actions">
        <button type="button" onClick={onPrint}>
          Print decision sheet
        </button>
      </div>

      <section aria-labelledby="what-changed">
        <h2 id="what-changed">1. What changed</h2>

        {scenario ? (
          <>
            <p>
              Scenario: <strong>{scenario.label}</strong>
            </p>
            <p>
              Load joint: {scenario.loadCase.nodeId}
            </p>
            <p>
              Horizontal load: {formatNumber(scenario.loadCase.fxN, 2)} N
            </p>
            <p>
              Vertical load: {formatNumber(scenario.loadCase.fyN, 2)} N
            </p>
            <p>
              Selected brace: {scenario.panelId}
            </p>

            {baseline && selectedAlternative && (
              <div className="sketch-grid">
                <BridgeSketch
                  design={successfulResult!.baselineDesign}
                  title="Original bridge"
                />
                <BridgeSketch
                  design={selectedAlternative.design}
                  title="Bridge with selected brace"
                />
              </div>
            )}
          </>
        ) : (
          <p>No committed structural scenario is available.</p>
        )}

        {model.firstPrediction && (
          <p>
            First prediction preserved: load at{' '}
            {model.firstPrediction.loadCase.nodeId}, brace{' '}
            {model.firstPrediction.panelId}.
          </p>
        )}
      </section>

      <section aria-labelledby="predicted">
        <h2 id="predicted">2. Predicted</h2>

        {structuralResult?.status === 'invalid' ? (
          <div role="alert">
            <p>Current structural analysis is invalid.</p>
            {structuralResult.issues.map((issue, index) => (
              <p key={`${issue.path}-${index}`}>
                {issue.message}
              </p>
            ))}
          </div>
        ) : scenario && baseline && revised && deflection ? (
          <>
            <p>
              Original loaded-joint vertical displacement:{' '}
              {formatMeasurement(deflection.baselineMm)}
            </p>
            <p>
              Revised loaded-joint vertical displacement:{' '}
              {formatMeasurement(deflection.revisedMm)}
            </p>
            <p>
              Deflection reduction:{' '}
              {formatMeasurement(deflection.reductionMm)}
            </p>
            <p>
              Percentage improvement:{' '}
              {deflection.reductionPercent === null
                ? 'Not defined because baseline displacement is zero.'
                : `${formatNumber(deflection.reductionPercent, 2)}%`}
            </p>

            <h3>Member forces — positive is tension, negative is compression</h3>
            <ForceTable baseline={baseline} revised={revised} />

            <h3>Best-performing brace placements</h3>
            <p>
              {successfulResult!.bestPanelIds.join(', ')}
            </p>
          </>
        ) : (
          <p>
            No committed structural prediction is available yet.
          </p>
        )}
      </section>

      <section aria-labelledby="measured">
        <h2 id="measured">3. Measured</h2>

        {model.measurements.length === 0 ? (
          <p>No measurement recorded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reading</th>
                <th>Load</th>
                <th>Measured joint</th>
                <th>Displacement</th>
                <th>Uncertainty</th>
                <th>Method and conditions</th>
              </tr>
            </thead>
            <tbody>
              {model.measurements.map((measurement) => (
                <tr key={measurement.id}>
                  <td>{measurement.interventionPanelId ?? 'Original bridge'}</td>
                  <td>
                    {measurement.loadCase.nodeId},
                    {' '}
                    {formatNumber(measurement.loadCase.fyN, 2)} N vertical
                  </td>
                  <td>{measurement.measuredNodeId}</td>
                  <td>
                    {formatNumber(measurement.value)} {measurement.units}
                  </td>
                  <td>
                    {measurement.uncertaintyMm === null
                      ? 'Not recorded'
                      : `±${formatNumber(measurement.uncertaintyMm)} mm`}
                  </td>
                  <td>
                    {measurement.method}. {measurement.conditions}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="cost-comparison">
        <h2 id="cost-comparison">4. Cost comparison</h2>

        <p>
          Upfront budget: {formatMoney(finance.inputs.budgetUSD)}
        </p>
        <p>
          Maintenance horizon: {finance.inputs.years} years
        </p>
        <p>
          Annual real discount rate:{' '}
          {formatNumber(finance.inputs.rate * 100, 2)}%
        </p>

        {financeResult.status === 'pending' && (
          <p>{financeResult.message}</p>
        )}

        {financeResult.status === 'invalid' && (
          <div role="alert">
            <p>Financial comparison unavailable due to invalid inputs.</p>
            {financeResult.issues.map((issue, index) => (
              <p key={`${issue.path}-${index}`}>
                {issue.message}
              </p>
            ))}
          </div>
        )}

        {financeResult.status === 'ok' && (
          <>
            {[financeResult.quoteA, financeResult.quoteB].map(
              (summary, index) => {
                const quote = index === 0
                  ? finance.inputs.quoteA
                  : finance.inputs.quoteB;

                return (
                  <div key={summary.quoteId}>
                    <h3>{quote.label}</h3>
                    <p>Scope: {quote.scopeLabel}</p>
                    <p>Materials purchase: {money(quote.purchase.amountUSD === null ? { status: 'unknown', missingFields: ['purchase'] } : { status: 'known', amountUSD: quote.purchase.amountUSD })}</p>
                    <p>Purchase source: {quote.purchase.source.kind} — {quote.purchase.source.label}</p>
                    <p>Freight source: {quote.delivery.source.kind} — {quote.delivery.source.label}</p>
                    <p>Installation source: {quote.installation.source.kind} — {quote.installation.source.label}</p>
                    <p>Annual upkeep source: {quote.annualUpkeep.source.kind} — {quote.annualUpkeep.source.label}</p>
                    <p>Cash contribution source: {quote.donation.source.kind} — {quote.donation.source.label}</p>
                    <p>Gross upfront cost: {money(summary.grossUpfront)}</p>
                    <p>Cash contribution applied: {money(summary.donationApplied)}</p>
                    <p>Upfront cost: {money(summary.upfront)}</p>
                    <p>Funding gap: {money(summary.fundingGap)}</p>
                    <p>Annual upkeep: {money(summary.annualUpkeep)}</p>
                    <p>{finance.inputs.years}-year discounted total: {money(summary.discountedTotal)}</p>
                  </div>
                );
              },
            )}

            <h3>Break-even analysis</h3>

            {financeResult.breakEven.status === 'unknown' && (
              <p>
                Break-even analysis unavailable because upfront costs
                are unknown.
              </p>
            )}

            {financeResult.breakEven.status === 'equal-upfront' && (
              <p>Both packages have equal upfront costs.</p>
            )}

            {financeResult.breakEven.status === 'premium' && (
              <>
                <p>
                  Higher-upfront package:{' '}
                  {financeResult.breakEven.higherUpfrontQuoteId === finance.inputs.quoteA.id
                    ? finance.inputs.quoteA.label
                    : finance.inputs.quoteB.label}
                </p>
                <p>
                  Upfront premium:{' '}
                  {formatMoney(financeResult.breakEven.premiumUSD)}
                </p>
                <p>
                  Required annual maintenance savings:{' '}
                  {formatMoney(financeResult.breakEven.annualSavingsRequiredUSD)}
                </p>
              </>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="assumptions">
        <h2 id="assumptions">5. Open assumptions</h2>

        <ul>
          {model.assumptions.map((assumption, index) => (
            <li key={index}>{assumption}</li>
          ))}
        </ul>

        <ul>
          <li>Structural results represent an idealized linear-elastic model.</li>
          <li>Physical measurements should be interpreted with their recorded uncertainty and test conditions.</li>
          <li>Unknown prices and upkeep costs have not been treated as zero.</li>
          <li>Demonstration assumptions are not verified supplier quotations.</li>
        </ul>
      </section>

      <footer>
        <p className="muted">
          Forma — decision support for structural and community
          build-option discussions. Verify engineering assumptions
          and local supplier costs before making real-world decisions.
        </p>
      </footer>
    </article>
  );
}
