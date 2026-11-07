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
`commitPrediction` in `src/app/experiment/state.ts`; cost and report ports await
their implementation phases. They do not return placeholder successes.
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
  change when the baseline is zero. Never sort on rounded display text.

## Trial and retest invariants

A `Trial` stores trial/round IDs, preset and solver versions, load, chosen panel,
and a deep snapshot of the entire ranking, including designs. The commit
adapter verifies that result load and preset/solver versions match the active
round. Accepting arbitrary externally supplied results is not part of the UI.

A `Retest` identifies its source trial, new load, retained chosen panel and new
ranking. It does not overwrite the source trial. Displaying another trial changes
selection, not the saved result. A report must use that selected stored result.

Integration owns the only `ExperimentState` and reducer. Studio receives state
and callbacks, never a competing trial store. Financial inputs/readings live in
`CommunityState` and use separate events.

| Event | Required reducer behavior in Phase 3 |
| --- | --- |
| `round/start` | Preserve history; reset preview/retest; hide rankings; new round ID |
| `prediction/select-panel` | Update an uncommitted legal choice only |
| `prediction/move-load` | Update an uncommitted snapped load; rankings stay hidden |
| `prediction/commit` | For the matching round and legal choice, snapshot once and reveal |
| Duplicate/stale commit | Ignore; never create a second trial for that round |
| `prediction/fail` | Clear the active result, retain choice/load for recovery and valid history |
| `retest/show` | Verify source trial, retained brace, and matching result load; replace only the retest |
| `retest/fail` | Replace active retest with an error; leave saved trials intact |
| `trial/select` | Select an existing immutable trial and restore its displayed result |

The revealed round contains a trial ID, while the predicting round has no result
field. This prevents a hidden state from accidentally carrying a result view.
The synchronous app adapter calls the solver and dispatches retest events after
post-commit load movement. The reducer, commit adapter and display selector are in
`src/app/experiment/state.ts`; `useExperiment.ts` owns live solver calls. Selecting
a stored trial uses its existing snapshot without solving again. The display
selector returns no active results for an error state. The separately labeled
saved original can remain visible during a failed retest.

The app retains this state across navigation. Studio owns only presentation
preferences (which overlay is shown and whether force colors are enabled), never
a competing trial store. Reload clears all trials. Events are internal typed
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

`QuoteInputs.packages` is an exact pair. Phase 4 must validate unique package IDs,
finite numbers, nonnegative values/rate, positive whole years, and contribution
limits. Use unrounded calculations; round currency only for display. The contracts
are not a runtime parser or an implementation of these calculations.

## Measurements and reporting

`Reading` ties a design/version to an applied load, measured joint, value, units,
method and raw repeat readings. Resolution is recorded in the same units or is
explicitly unknown (`null`). Its assessment must not imply model validation merely
because a number was entered. The report builder must check case association.

`ReportInputs` explicitly provides trial, optional retest, selected quote inputs
and results, readings and assumptions. `ReportPayload` adds schema version, report
ID and supplied timestamp. The builder must check quote/result consistency and
deep-copy/freeze every input so later navigation or edits cannot change the page.
No global store access is permitted inside the print view.

## Dependency rules

Structures imports shared contracts only, never React or community costs. Costs
imports shared contracts only, never structures or studio. Shared contracts may
refer to each other but never to implementation modules. App orchestration can
compose ports after the underlying modules pass their own tests.

Fixture imports belong in tests or an explicitly separate development harness.
No runtime module or shared barrel may import or re-export fixtures. The Phase 1
boundary test enforces this rule for normal module imports.
