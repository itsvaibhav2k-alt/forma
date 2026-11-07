# Phase 4 — Independent package comparison

Implemented on the `phases` branch after Phases 1–3; calculations now delegate to
main’s pinned engine via the [combined integration](main-engine-integration.md). The structural engine, preset
and experiment reducer are unchanged. No dependencies or fixture corrections were
needed. See [merge order](merge-plan.md#phase-4-handoff) for review boundaries.

## 4.1 — Pure calculations

**Prerequisite: 1.3.** `src/community/costs/engine` implements the shared
`CompareQuotes` port. `src/community/costs/index.ts` exposes the pure calculator,
validation, savings assessment and snapshot helper without importing React.

For each equal-scope package:

```text
gross upfront = materials + freight + installation
applied contribution = min(cash contribution, gross upfront)
upfront = gross upfront − applied contribution
funding gap = max(0, upfront − budget)
factor = sum over t=1…years of (1 + realRate)^−t
discounted total = upfront + annual upkeep × factor
required annual savings = higher upfront premium / factor
expected annual savings = lower-upfront upkeep − higher-upfront upkeep
```

Amounts are real USD; upkeep is constant and paid at year end. Replacement costs
and residual values are excluded. The API takes a decimal rate (`0.03`); the UI
accepts a percentage (`3`). At zero rate the factor is exactly the number of years.
For positive rates, `log1p`/`expm1` avoid cancellation near zero. Calculations retain
full precision; display rounding never decides whether savings meet the threshold.

Validation rejects malformed packages, duplicate/empty IDs, blank names/scope,
different declared scopes, missing source references, nonfinite or negative costs,
budget/rate, nonpositive or unsafe/fractional years and
nonfinite calculated results. The shared scope is a declaration, not a semantic
check that suppliers actually offer equivalent service. Contributions are capped
at gross upfront cost; excess does not offset upkeep. Material donations use actual purchase
cost, including an explicit zero, plus notes; they are not deducted twice.

Main uses exact unrounded equality for equal upfront costs. The presentation-only
savings assessment keeps `8 × Number.EPSILON × max(1, |compared values|)` for
threshold equality, not a cent-sized tolerance. Applied contributions cannot
produce a negative upfront cost. Very large finite inputs
can still overflow the calculation; those return an error without numeric results.

Unknown is distinct from invalid or zero. Every unavailable result identifies its
missing package/field dependencies. Unknown upkeep leaves upfront cost, funding
gap and the required savings threshold available. Expected savings can be negative.
Equal upfront costs have no premium to recover. Neither path claims an overall
winner or converts financial results into structural performance.

## 4.2 — Editable comparison

**Prerequisite: 4.1.** `CostWorkbench` and `CostSummary` provide two package editors,
one common scope, budget, horizon and rate, source types/references, donation notes,
upfront affordability, discounted totals and break-even explanation.

All five amount fields start blank. Settings start at an explicitly labeled
$20,000 budget, 10 years and 3%. **Load fictional example** opts into the
specification's input amounts; the engine calculates all outputs. Editing a demo
amount relabels it as a user estimate. Source labels record provenance without
verifying suppliers. **Start blank** resets the financial draft and settings.

Drafts retain strings so clearing a field means unknown, `0` means known zero,
and incomplete text such as `1e` is invalid. Ordinary decimal/scientific notation
is supported; comma-grouped amounts, hexadecimal and text suffixes are rejected.
Validation is shown beside fields and above the comparison. Invalid inputs remove
previous totals instead of displaying stale values. The result summary has a
polite live announcement; controls have labels and field-error associations.

## 4.3 — Integration and report readiness

**Prerequisite: 3.3 + 4.2.** `App` mounts `useQuotes` independently of
`useExperiment`, preserving both when switching views. Costs cannot import the
structural engine, studio or experiment modules. Financial edits never dispatch
structural events; invalid financial drafts do not block the bridge experiment.

`createCostSnapshot(quotes)` revalidates/recomputes costs and returns a deeply
cloned, frozen, JSON-serializable snapshot or errors. Unknown amounts are valid
snapshot content. Later draft edits cannot change a captured snapshot. A type-only
shared utility change preserves readonly tuple lengths; shared domain shapes and
the existing runtime clone/freeze implementation are unchanged.

Phase 5 should capture this snapshot alongside the **selected stored trial** and
optional retest, then build the versioned report. It must not read mutable global
state from the print view. The helper is not a finished report/export feature.
Trials and financial inputs remain session-only and are cleared by reload.

## Verification

`npm run check` passes **158 tests across 15 files**, strict TypeScript checks and
the production build. New coverage includes:

- Independent rounded fixtures: at 10 years/3%, totals $26,677.18 and $24,838.59,
  funding gaps $0 and $1,000, and the $234.46/year savings threshold.
- Zero rate: totals $28,000 and $25,500 and a $200/year threshold; tiny positive
  rates; an independent finite-sum factor check.
- Exact unrounded break-even and savings immediately above/below it at 0% and 3%;
  budget-only changes, horizon changes and reversed higher-upfront package.
- Each missing field, explicit zeros, donations, contribution limits, invalid
  inputs, numerical overflow and immutable serializable snapshots.
- Form edits, source references, demo relabeling, error recovery and resets.
- Bidirectional state isolation: all financial fields preserve the active retest,
  saved trial text and solver-call results; retests/restoration preserve quotes.
  Invalid costs do not block a structural commit.
- Runtime fixture isolation and independent module boundaries.

Production browser checks at `http://127.0.0.1:4173/` verified blank startup,
fictional results, missing upkeep, explicit zero, excess-contribution errors and
recovery. A saved B1/P2 trial retained its 1.09% result while invalid quote edits
survived navigation. At 375×812, cards and editors stack without horizontal
overflow; desktop results render in two columns. The browser recorded no console
warnings or errors. A local preview image is saved at
`output/previews/phase-4-desktop.png` (ignored by Git).

These checks do not replace Phase 6's broader accessibility, offline release and
rehearsal gates. Reporting/printing and optional physical measurements remain
later-phase work.
