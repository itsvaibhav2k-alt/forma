> Combined implementation: app/state contracts below remain the phases contracts.
> Main’s pinned numerical engines are accessed through private adapters; see
> [engine provenance and policy reconciliation](main-engine-integration.md).

# Phase 1.2 — Shared contracts and state ownership

The source of truth is `src/shared`. Its barrel exports contracts and release
constants, never fixtures. All domain records use readonly properties. The
`snapshot` helper clones and deeply freezes plain data; compile-time readonly
alone does not create a snapshot.

## Module ports

| Port | Input | Output | Implementation phase |
| --- | --- | --- | --- |
| `Analyze` | `Design`, general `LoadCase` | `Analysis` or `AnalysisError` | 2.2 |
| `RankBraces` | baseline `Design`, judging `Load` | `RankedBraces` or `AnalysisError` | 2.3 |
| `CommitPrediction` | IDs, version, current load/panel, validated results | independent `Trial` | 3.2 |
| `CompareQuotes` | two packages, budget, horizon, rate | `Costs` or validation error | 4.1 |
| `BuildDecisionSheet` | selected trial, optional retest, quotes/results/readings, report ID and time | `ReportPayload` | 5.1 |

The shared function types are interface declarations, not executable stubs.
Phase 2 implements `analyze` and `rankBraces` in `src/structures`. Phase 3 implements
`commitPrediction` in `src/app/experiment/state.ts`. Phase 4 implements
`compareQuotes` in `src/community/costs/engine`. Phase 5 implements
`buildDecisionSheet` in `src/community/report`; it throws descriptive errors for
inconsistent typed inputs instead of returning an invalid successful payload.
Object arguments make named units and
source fields explicit. `CompareQuotes` packages the five positional arguments
from the planning document into `QuoteInputs`. Commit receives validated results
explicitly, keeping snapshot creation deterministic and independent of a solver.

## Geometry and structural outputs

- `Design` contains stable IDs, nodes/restraints, members and stock E/A. It has no
  quote fields. IDs are strings so the analytic triangle can use A/B/C.
- `LoadCase` is a general single point load. `Load` narrows it to B1/B2/B3,
  fx=0 and fy=-10 for judging. Coordinates/displacement are mm; loads/forces are N.
- A successful `Analysis` must contain every node's displacement, every support's
  reaction, and every member's signed force. Its loaded-joint displacement is an
  absolute vertical magnitude. Map completeness is a runtime solver responsibility;
  `noUncheckedIndexedAccess` requires consumers to handle missing keys.
- `AnalysisError` includes a code, useful message, and available affected IDs.
  It has no numeric performance payload. Phase 2 checks finite numbers, positive
  stock values, endpoints, duplicates, zero lengths, singularity and numerical
  residuals. See [the numerical policy](phase-2.md).
- `RankedBraces` records its load, original design/analysis, all four independently
  modified designs/analyses and all tied best IDs. If any required solve fails,
  return an error for the scenario rather than a partial or stale ranking.
- `rankBraces` accepts the unmodified canonical baseline and judging load only;
  it allows array reordering, reversed member endpoints and a different design ID.
  Geometry, restraints, stock, member IDs/topology and preset version must match.
  General or edited trusses use `analyze`, which accepts finite single point loads.
  A successful ranking is deeply cloned and frozen at runtime.
- `DeflectionChange` distinguishes a percentage reduction from absolute-only
  change when baseline magnitude is ≤1e-12 mm. Never sort on rounded display text.

## Trial and retest invariants

A `Trial` stores trial/round IDs, preset and solver versions, load, chosen panel,
and a deep snapshot of the entire ranking, including designs. The commit
adapter verifies that result load and preset/solver versions match the active
round. Accepting arbitrary externally supplied results is not part of the UI.

A `Retest` identifies its source trial, new load, retained chosen panel and new
ranking. It does not overwrite the source trial. Displaying another trial changes
selection, not the saved result. A report must use that selected stored result.

Integration owns the only `ExperimentState` and reducer. Studio receives state
and callbacks, never a competing trial store. The community contracts keep
financial inputs/readings separate. Phase 4 uses an app-mounted `useQuotes` hook
for editable draft strings and derived `QuoteInputs`/`CostResult`; it never sends
financial changes through the experiment reducer. Phase 7 uses a separate app-mounted
`useMeasurements` store for readings and per-case drafts; it sends no experiment events.

| Event | Required reducer behavior |
| --- | --- |
| `round/start` | Preserve history; reset preview/retest; hide rankings; new round ID |
| `prediction/select-panel` | Update an uncommitted legal choice only |
| `prediction/move-load` | Update an uncommitted snapped load; rankings stay hidden |
| `prediction/commit` | For the matching round and legal choice, snapshot once and reveal |
| Duplicate/stale commit | Ignore; never create a second trial for that round |
| `prediction/fail` | Clear the active result, retain choice/load for recovery and valid history |
| `retest/show` | Verify source trial, retained brace, and matching result load; replace only the retest |
| `retest/fail` | Replace active retest with an error; leave saved trials intact |
| `trial/select` | Set only `inspectedTrialId`; display the immutable saved result without changing the active round, selected trial, load, panel or retest |
| `trial/return` | Clear inspection and display the exact preserved active draft/retest |

The revealed round contains a trial ID, while the predicting round has no result
field. This prevents a hidden state from accidentally carrying a result view.
The synchronous app adapter calls the solver and dispatches retest events after
post-commit load movement. The reducer, commit adapter and display selector are in
`src/app/experiment/state.ts`; `useExperiment.ts` owns live solver calls. Selecting
a stored trial uses its existing snapshot without solving again. During inspection,
experiment mutations and solver calls are blocked; keyboard focus moves to the
return action and back to the opening history control. Reports, measurements and
templates explicitly name the selected saved trial. Historical reports exclude the
preserved active retest; it becomes eligible again only after returning. The display
selector returns no active results for an error state. The separately labeled
saved original can remain visible during a failed retest.

The app retains this state across navigation. Studio owns only presentation
preferences (which overlay is shown and whether force colors are enabled), never
a competing trial store. Without backend configuration, reload clears all trials. Configured project storage
can save and restore the complete workspace; inspection is validated separately
from its preserved active draft/retest. Events are internal typed
messages, not an untrusted network/import format. If the synchronous adapter is
later made asynchronous, add request identities to retest failures before allowing
out-of-order completions; that is outside this implementation.

## Financial outputs and unknowns

`AmountInput` is either known with a USD value and explicit source or unknown
with a note. Known source kinds are supplier quote, user estimate and demo
assumption. An unknown amount has no `usd` field.

`CalculatedAmount` is known or identifies missing package/field dependencies.
`BreakEven` distinguishes a higher-upfront premium, equal upfront costs, and
unknown inputs. Expected annual savings may be negative even though user-entered
costs must be nonnegative. Financial validation errors are separate from unknown
values: unknown data is allowed; a negative entered purchase cost is not.

`QuoteInputs.packages` is an exact pair. Phase 4 validates unique package IDs,
nonempty names and matching declared scope, finite nonnegative values/rate,
positive safe-integer years and source references. Cash contributions are applied
once and capped at gross upfront cost by main’s engine; excess never offsets upkeep. It uses
unrounded calculations and rounds currency only for display. The runtime parser
and validation live in the cost module; see [Phase 4](phase-4.md) for formulas and
numerical policy.

`createCostSnapshot(quotes)` recomputes and freezes a plain `{ status, quotes,
costs }` snapshot or returns validation errors. It accepts unknown amounts without
inventing values. Phase 5 can compose this with the selected trial. The shared
`DeepReadonly` utility now preserves tuple lengths; domain contract shapes and
the runtime clone/freeze behavior are unchanged.

## Measurements and reporting

`Reading` ties a design/version to an applied load, measured joint, value, units,
method and raw repeat readings. Resolution is recorded in the same units or is
explicitly unknown (`null`). Its assessment must not imply model validation merely
because a number was entered. The report builder must check case association.

Phase 7 entry requires 1–20 finite raw vertical readings, a method and physical
conditions. Positive means downward; the stored displacement equals their mean.
Units remain as entered (mm, cm or in); comparison alone converts to mm. Drafts
are keyed by design ID, preset version and exact load vector/location. Changing
the measured joint clears unsaved readings and resolution. Unit changes reinterpret
the draft and are explicitly labeled; saved observations are never converted.

The resolution screen compares instrument resolution and repeat range to the
stored model's absolute brace-induced vertical change at the measured joint. An
unresolvable change is inconclusive. Unknown resolution or fewer than three repeats
cannot support agreement. Even fine resolution and small spread leave agreement
unassessed: paired physical tests, systematic error and uncertainty need review.
The builder derives assessment again and cannot accept a caller's `resolved` flag
as proof. The existing enum remains compatible; the new UI never emits `resolved`.
The shared validator requires 1–20 finite raw observations, nonblank method and
physical conditions, valid units/association/resolution/displacement and agreement
between displacement and the raw mean. The entry form and direct report builder
use the same rules. Zero observations and unknown resolution are valid; an absent
measurement list is valid and displays “No measurement recorded.” Empty raw
readings inside a supplied measurement are invalid. No public JSON import is provided.

`ReportInputs` explicitly provides trial, optional retest, selected quote inputs
and results, readings and assumptions. `ReportPayload` adds schema version, report
ID and supplied canonical ISO timestamp. The builder checks quote/result
consistency by recomputing financial results; validates trial/retest associations,
versions, analysis completeness, finite values and measurement case association;
and deep-copies/freezes every input. It adds mandatory model/cost assumptions.
Structural results are trusted internal solver snapshots and are not recalculated.
This typed port is not a public JSON import/parser or independent solver audit.

The app captures only with a selected stored trial and valid financial inputs;
unknown amounts remain allowed. Invalid cost drafts block new capture. The existing
`CostResult` union is retained for contract compatibility, but the Phase 5 builder
rejects financial errors. Failed retests are explicitly omitted; valid retests are
included only when requested and remain separate from the selected prediction.

The print view receives only a frozen `ReportPayload` and never reads global state.
Navigating, changing costs and selecting another trial do not change it. A new
capture explicitly replaces the sheet. The JSON download preserves the full
payload, including readings, all candidates and source precision. The optional
measurement-entry UI is implemented in Phase 7; durable/imported reports remain outside scope.

Matching readings are included only for the saved trial's original/chosen designs
and the explicitly included retest. Identity is design/version/load, not trial ID;
identical cases can reuse the same observation. Other cases stay in the session
store and are excluded with a visible count. A report freezes raw readings, units,
method, conditions, resolution and derived assessment along with other inputs.

`buildAssemblyPattern` freezes geometry from the selected stored original/chosen
design. It uses the fixed 240 × 40 mm preset, calculates center-to-center lengths
and unconnected crossings, and never solves again. The separate SVG uses 254 ×
100 mm dimensions with a matching viewBox, so one drawing unit equals one mm.
Neither screen preflight nor SVG dimensions certify physical printer scale.

## Dependency rules

Structures imports shared contracts only, never React or community costs. The cost
engine imports shared contracts/utilities only, never React, structures or studio.
Financial forms can import React and their own engine, but not experiment,
structures or studio modules. Shared contracts may
refer to each other but never to implementation modules. App orchestration can
compose ports after the underlying modules pass their own tests.

Fixture imports belong in tests or an explicitly separate development harness.
No runtime module or shared barrel may import or re-export fixtures. The Phase 1
boundary test enforces this rule for normal module imports.


## Persisted legacy projects

The optional project parser defaults a missing `inspectedTrialId` to null and
validates non-null IDs against saved history. It accepts the current solver and the
known phases solver `forma-truss-2d-v1`, retaining original versions and values.
Stored legacy scenarios remain read-only; new predictions use the current solver.
Retests cannot cross solver versions. Frozen report and pattern payloads retain
their original provenance when a new prediction starts. No database migration or
shared trial/state record shape changes are required for this compatibility path.
