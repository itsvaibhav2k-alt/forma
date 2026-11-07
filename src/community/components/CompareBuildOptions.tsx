
import type {
  Amount,
  CompareBuildOptionsProps,
  PriceSource,
} from '../../shared';

function formatMoney(
  amount: number | null | undefined,
): string {
  if (amount === null || amount === undefined) {
    return 'Unknown';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatAmount(amount: Amount): string {
  return amount.status === 'known'
    ? formatMoney(amount.amountUSD)
    : 'Unknown';
}

function formatSource(source: PriceSource): string {
  const labels = {
    quoted: 'Supplier quote',
    'user-entered': 'User estimate',
    demonstration: 'Demo assumption',
    unknown: 'Unknown',
  };

  return `${labels[source.kind]} — ${source.label}`;
}

type PackageKey = 'quoteA' | 'quoteB';

type PriceKey =
  | 'purchase'
  | 'delivery'
  | 'installation'
  | 'donation'
  | 'annualUpkeep';

const priceFields: { key: PriceKey; label: string }[] = [
  { key: 'purchase', label: 'Materials purchase' },
  { key: 'delivery', label: 'Freight / delivery' },
  { key: 'installation', label: 'Installation' },
  { key: 'donation', label: 'Credited cash contribution' },
  { key: 'annualUpkeep', label: 'Annual upkeep' },
];

export function CompareBuildOptions({
  model,
  onInputsChange,
}: CompareBuildOptionsProps) {
  const { quoteA, quoteB } = model.inputs;
  const years = model.inputs.years;

  const updateLabel = (
    packageKey: PackageKey,
    label: string,
  ) => {
    const quote = model.inputs[packageKey];

    onInputsChange({
      ...model.inputs,
      [packageKey]: {
        ...quote,
        label,
      },
    });
  };

  const updatePrice = (
    packageKey: PackageKey,
    priceKey: PriceKey,
    value: number | null,
  ) => {
    const quote = model.inputs[packageKey];

    onInputsChange({
      ...model.inputs,
      [packageKey]: {
        ...quote,
        [priceKey]: {
          ...quote[priceKey],
          amountUSD: value,
          source:
            value === null
              ? {
                  kind: 'unknown',
                  label: 'Not provided',
                }
              : {
                  kind: 'user-entered',
                  label: 'User-entered estimate',
                },
        },
      },
    });
  };

  const updateSetting = (
    key: 'budgetUSD' | 'years' | 'rate',
    value: number,
  ) => {
    onInputsChange({
      ...model.inputs,
      [key]: value,
    });
  };

  const renderPackage = (
    packageKey: PackageKey,
    packageLabel: string,
  ) => {
    const quote = model.inputs[packageKey];

    return (
      <fieldset>
        <legend>{packageLabel}</legend>

        <div>
          <label>
            Package name:
            <input
              type="text"
              value={quote.label}
              onChange={(event) =>
                updateLabel(packageKey, event.target.value)
              }
            />
          </label>
        </div>

        <p>Scope: {quote.scopeLabel}</p>

        <p>
          Enter the actual purchase cost of materials, including
          materials that are donated. Record the credited value
          of a contribution below so it reduces the upfront cost
          only once.
        </p>

        {priceFields.map(({ key, label }) => (
          <div key={key}>
            <label>
              {label} ($):
              <input
                type="number"
                min="0"
                step="0.01"
                value={quote[key].amountUSD ?? ''}
                placeholder="Unknown"
                onChange={(event) => {
                  const rawValue = event.target.value;

                  updatePrice(
                    packageKey,
                    key,
                    rawValue === '' ? null : Number(rawValue),
                  );
                }}
              />
            </label>

            <p>
              <small>
                Source: {formatSource(quote[key].source)}
              </small>
            </p>
          </div>
        ))}
      </fieldset>
    );
  };

  return (
    <>
      <section>
        <h2>Compare build options</h2>

        <p>
          Compare the costs of two community material packages
          covering the same scope and service level.
        </p>

        <fieldset>
          <legend>Comparison settings</legend>

          <div>
            <label>
              Upfront budget ($):
              <input
                type="number"
                min="0"
                step="0.01"
                value={model.inputs.budgetUSD}
                onChange={(event) =>
                  updateSetting(
                    'budgetUSD',
                    Number(event.target.value),
                  )
                }
              />
            </label>
          </div>

          <div>
            <label>
              Maintenance horizon (years):
              <input
                type="number"
                min="1"
                step="1"
                value={years}
                onChange={(event) =>
                  updateSetting('years', Number(event.target.value))
                }
              />
            </label>
          </div>

          <div>
            <label>
              Annual discount rate (%):
              <input
                type="number"
                min="0"
                step="0.01"
                value={model.inputs.rate * 100}
                onChange={(event) =>
                  updateSetting(
                    'rate',
                    Number(event.target.value) / 100,
                  )
                }
              />
            </label>
          </div>
        </fieldset>

        {renderPackage('quoteA', 'Package A')}
        {renderPackage('quoteB', 'Package B')}
      </section>

      <section>
        <h2>Financial comparison</h2>

        {model.result.status === 'pending' && (
          <p>{model.result.message}</p>
        )}

        {model.result.status === 'invalid' && (
          <div role="alert">
            <h3>Invalid financial inputs</h3>

            {model.result.issues.map((issue, index) => (
              <p key={index}>{issue.message}</p>
            ))}
          </div>
        )}

        {model.result.status === 'ok' && (
          <>
            <p>
              All discounted totals cover {years} years and use
              the selected annual discount rate.
            </p>

            <h3>Package A — {quoteA.label}</h3>

            <p>
              Upfront cost:{' '}
              {formatAmount(model.result.quoteA.upfront)}
            </p>

            <p>
              Funding gap:{' '}
              {formatAmount(model.result.quoteA.fundingGap)}
            </p>

            <p>
              Annual upkeep:{' '}
              {formatAmount(model.result.quoteA.annualUpkeep)}
            </p>

            <p>
              Discounted total ({years} years):{' '}
              {formatAmount(model.result.quoteA.discountedTotal)}
            </p>

            <h3>Package B — {quoteB.label}</h3>

            <p>
              Upfront cost:{' '}
              {formatAmount(model.result.quoteB.upfront)}
            </p>

            <p>
              Funding gap:{' '}
              {formatAmount(model.result.quoteB.fundingGap)}
            </p>

            <p>
              Annual upkeep:{' '}
              {formatAmount(model.result.quoteB.annualUpkeep)}
            </p>

            <p>
              Discounted total ({years} years):{' '}
              {formatAmount(model.result.quoteB.discountedTotal)}
            </p>

            <h3>Annual upkeep comparison</h3>

            {model.result.quoteA.annualUpkeep.status === 'known' &&
            model.result.quoteB.annualUpkeep.status === 'known' ? (
              <>
                {model.result.quoteA.annualUpkeep.amountUSD ===
                model.result.quoteB.annualUpkeep.amountUSD ? (
                  <p>
                    Both packages have equal annual upkeep costs.
                  </p>
                ) : (
                  <p>
                    {model.result.quoteA.annualUpkeep.amountUSD <
                    model.result.quoteB.annualUpkeep.amountUSD
                      ? quoteA.label
                      : quoteB.label}{' '}
                    has lower annual upkeep by{' '}
                    {formatMoney(
                      Math.abs(
                        model.result.quoteA.annualUpkeep.amountUSD -
                          model.result.quoteB.annualUpkeep.amountUSD,
                      ),
                    )}{' '}
                    per year.
                  </p>
                )}
              </>
            ) : (
              <p>
                Annual upkeep savings are Unknown because at least
                one package has missing upkeep information.
              </p>
            )}

            <h3>Break-even analysis</h3>

            {model.result.breakEven.status === 'unknown' && (
              <p>
                Break-even analysis unavailable because some
                upfront costs are unknown.
              </p>
            )}

            {model.result.breakEven.status === 'equal-upfront' && (
              <p>
                Both packages have equal upfront costs.
                There is no upfront premium.
              </p>
            )}

            {model.result.breakEven.status === 'premium' && (
              <>
                <p>
                  Higher-upfront package:{' '}
                  {model.result.breakEven.higherUpfrontQuoteId === quoteA.id
                    ? quoteA.label
                    : quoteB.label}
                </p>

                <p>
                  Upfront premium:{' '}
                  {formatMoney(model.result.breakEven.premiumUSD)}
                </p>

                <p>
                  Break-even annual savings required:{' '}
                  {formatMoney(
                    model.result.breakEven.annualSavingsRequiredUSD,
                  )}{' '}
                  per year
                </p>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
