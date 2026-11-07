# Forma foundation contract — frozen v1

Status: frozen v1 interfaces; foundation and Astra runtime engines implemented.
Judge-facing components and browser/print integration await Claude’s presentation checkpoint.
Approved by Vaibhav on November 7, 2026. Both lanes
must start from the same reviewed foundation commit. Foundation commit and integration into main were explicitly approved. Subsequent contract
changes require Vaibhav's approval.

## Ownership and available imports

Astra owns `src/shared/`, `src/structures/`, `src/community/finance/`, `src/trials/`,
`src/app/`, `src/main.tsx`, tooling and integration tests. Claude owns `src/studio/`,
`src/community/ui/`, `src/community/export/`, `src/styles/`, and component-local tests.
No duplicate types or calculations; no writer edits the other lane's files while it is active.

All canonical types are implemented in `src/shared/types.ts` and re-exported by
`src/shared/index.ts`. Use relative imports to `shared`; no path alias is required.
For example, `src/studio/BridgeStudio.tsx` imports `BridgeStudioProps` from `../shared`;
`src/community/ui/CompareBuildOptions.tsx` imports its props from `../../shared`.

Available now:

- Data-only types and function signatures in `src/shared/types.ts`.
- `immutableCopy<T>(value: T): DeepReadonly<T>` from `src/shared/immutable.ts` or the shared barrel.
  This structured-clones and recursively freezes plain data; no Maps, Sets, Dates, functions,
  DOM objects, or typed arrays. It does not freeze or retain references to the caller's input.
- `JUDGE_PRESET_VERSION`, `JUDGE_PRESET`, `TRIANGLE_DESIGN`, `TRIANGLE_LOAD`,
  `UNSTABLE_SQUARE_DESIGN`, `UNSTABLE_SQUARE_LOAD`, `DEMO_FINANCE_INPUTS`,
  `FOUNDATION_TRIAL_STATE`, `FOUNDATION_FINANCE_MODEL`, and `DEFAULT_ASSUMPTIONS`.
- `TRIANGLE_EXPECTED`, `BRIDGE_EXPECTED`, `FINANCE_EXPECTED`: labeled analytic/brief
  acceptance references only. These are not computed results and must not feed runtime UI.

The engine checkpoint implements the following imports (paths shown from `src/app/`):

```ts
import { analyze, rankBraces } from '../structures';
import { compareQuotes } from '../community/finance';
import { commitPrediction, createTrialState, transitionTrial } from '../trials';
```

Use these engines for computed output; never show reference fixture values as live results.
The pending fixture remains available for explicit unavailable-engine UI tests. In the real app,
`src/app/useAppController.ts` exports `useAppController()`, returning `studio`, `community`,
and `decisionSheet` props matching the three frozen component interfaces. The hook uses the
actual engines and independent state update branches. No public contract shape has changed.

## Coordinates, stock and preset

All input geometry and output displacement use mm. Forces and reactions use N.
Stock `areaMm2` is mm² and `elasticModulusNPerMm2` is N/mm²; their product EA is N.
Coordinates are x right, y up. A downward load has `fyN < 0`. SVG reverses the y-axis
only at the rendering boundary. Signed axial force is positive in tension and negative
in compression. Support displacements are zero in their fixed directions.

`Design` contains `id`, `presetVersion`, `nodes`, `members`, `stocks`, `supports`, and
`braceOptions`. Members reference endpoint and stock IDs. `LoadCase` is one point load:
`{ nodeId, fxN, fyN }`. Canonical field shapes are defined in the TypeScript file.
All contracts are readonly; runtime immutable snapshots additionally use `immutableCopy`.

`JUDGE_PRESET` is `judge-bridge-v1`: bottom nodes `b0`–`b4` at y=0, top nodes
`t0`–`t4` at y=40, x=0/60/120/180/240. There are eight chord members, five verticals,
and four preset diagonals. From left to right the diagonals rise, rise, fall, fall.
The left bottom support fixes x/y; the right bottom support fixes y only.
Added opposite diagonals are named `added-brace-1`–`added-brace-4`, with panel IDs
`panel-1`–`panel-4`, ordered left to right. These are equal-length one-brace alternatives.
The original bridge already contains its four preset diagonals.

The default load is 1 N downward at `b1`. The judging controls allow `b1`, `b2`, or `b3`.
The trial engine permits any finite positive downward magnitude at those joints; it rejects
horizontal or upward judging loads. The low-level analyzer supports arbitrary finite x/y
point loads, including zero. Geometry, supports and stock are not editable in the judging UI.
Demo stock is area 1 mm² and modulus 1,000 N/mm² (EA=1,000 N), an explicit modeling
assumption rather than a measured material. Do not imply physical calibration or load capacity.

## Structural API

Exact exported function types: `Analyze` and `RankBraces`.

```ts
analyze(design: Design, loadCase: LoadCase): AnalysisResult
rankBraces(design: Design, loadCase: LoadCase): BraceRankingResult
```

`AnalysisResult` is `{ status: 'ok', displacementsMm, memberForcesN, reactionsN }` or
`{ status: 'invalid', issues }`. Dictionaries use the corresponding node/member IDs.
Displacements include every node; forces include every member; reactions include supported
nodes only, with zero for unrestrained reaction components. A `ValidationIssue` has `code`,
`message`, and `path` (a field path or entity ID for presentation/debugging).
Invalid results have no performance fields. Never merge an invalid result over an old success.

Reject nonfinite coordinates, zero-length members, duplicate IDs, missing references,
nonpositive/nonfinite area or modulus, invalid supports or loads, singular systems, and
nonfinite numerical outputs. Invalid states visibly replace active performance results.

Ranking requires four distinct valid panel options and a strictly downward point load.
It analyzes the original design and each one-brace addition under exactly the same load.
No cumulative additions and no material or support changes. Each revised design ID is
`${originalDesign.id}+${panelId}`; version stays unchanged and node/member IDs remain stable.
An invalid baseline or alternative makes the whole ranking invalid, with no partial ranking.

A successful ranking contains `loadCase`, `baselineDesign`, `baseline`,
`baselineDeflectionMm`, `alternatives`, and `bestPanelIds`. Each alternative contains
`panelId`, `design`, `analysis`, and `deflection` (`baselineMm`, `revisedMm`,
`reductionMm`, `reductionPercent`). Alternatives stay in panel order, not sorted order.
The chosen panel need not be a best panel.

Compare `abs(displacementsMm[load.nodeId].y)`, the magnitude of vertical movement under
the downward load. Smaller is better. Preserve signed displacements separately for sketches.
`reductionMm = baselineMm - revisedMm`. Percentage is `100 * reductionMm / baselineMm`.
For baseline magnitude <= 1e-12 mm, percentage is null and the UI shows absolute change only.
All best placements within `max(1e-9 mm, 1e-8 * abs(bestMm))` of the minimum are tied.
Use unrounded numbers for decisions and round only for display. No engineering output may
read quote data, budget, horizon, rate, or user priorities.

## Trial API and transitions

Exact function types: `CommitPrediction`, `CreateTrialState`, `TransitionTrial`.

```ts
commitPrediction(presetVersion: PresetVersion, loadCase: LoadCase,
                 panelId: PanelId): CommitPredictionResult
createTrialState(presetVersion: PresetVersion): TrialState | InvalidResult
transitionTrial(state: TrialState, action: TrialAction): TrialState
```

The trial module resolves the version from its preset registry. Unknown versions return
`invalid`. These operations are deterministic and do not use network, clocks or random IDs.
The state history array supplies round order; it is not a global mutable singleton.

Commit validates the legal load/panel, runs ranking, and returns `{ status: 'ok', trial }`
or `InvalidResult`. A `PredictionTrial` contains `presetVersion`, the copied first `loadCase`,
`panelId`, and a deep-copied, recursively frozen `originalResult`. The result includes both
original and revised geometry. Trial history is append-only within the session; reload
persistence is not required by the brief.

`TrialState` is a union with common `presetVersion`, `currentLoad`, `selectedPanelId`, and
`history` fields. A `predicting` state has `issues` and deliberately no current-ranking field.
A `committed` state has `committedTrial` and `currentResult: BraceRankingResult`.

| Action | Predicting phase | Committed phase |
| --- | --- | --- |
| `set-load` with `loadCase` | Set draft load; validate; keep ranking hidden | Retest original bridge and all four alternatives at new load; retain committed brace and history |
| `select-panel` with `panelId` | Change draft brace if valid | No-op; start a new round to change brace |
| `commit` | On success append frozen trial and reveal; on failure retain draft and show issues | No-op; cannot duplicate an existing commitment |
| `new-round` | Keep draft load/selection; remain hidden | Keep current load and brace as draft selection; hide current ranking; preserve history |

A rejected load produces issues in a draft or an invalid `currentResult` in a committed state.
It never exposes the last successful result as the current result. Historical valid trials
remain explicitly labeled as historical, accessible even when the active load is invalid.
Moving a committed load does not append or modify history. A later commit appends a new
snapshot and cannot modify the first entry. Starting a new round clears the active reveal;
history is available only as a separately labeled historical view, never as a current ranking.

## Financial API and input conventions

Exact function type: `CompareQuotes`.

```ts
compareQuotes(quoteA: Quote, quoteB: Quote, budget: number,
              years: number, rate: number): FinanceResult
```

All money is USD. `rate` is a finite nonnegative annual **real decimal rate** (0.03=3%),
not a percentage input. `years` is a positive whole number. Budget and all known monetary
inputs must be finite and nonnegative. Two quote IDs must be distinct; `scopeId` must be
nonempty and match, with labels describing the same scope/service. Invalid input returns
only `status: 'invalid'` and issues; no old totals remain visible.

Each quote has labeled `purchase`, `delivery`, `installation`, `donation`, and `annualUpkeep`
inputs. Each is `{ amountUSD: number | null, source: { kind, label } }`.
Source kinds: `quoted`, `user-entered`, `demonstration`, `unknown`. When editing a seeded
amount, UI changes its provenance to `user-entered` unless the user supplies an actual quote.
All fictional seeds, including zeros, are visibly demonstration assumptions.

`null` is missing, not zero. Empty form fields map to null; malformed/negative input must
produce validation feedback rather than silently becoming zero. A known explicit zero is
allowed. Source labels accompany prices even if the amount is unknown. Local input text
state can preserve partially typed numbers; canonical callbacks receive numbers or null.

- Gross upfront = purchase + delivery + installation.
- Applied donation = min(cash donation available now, gross upfront).
- Net upfront = gross upfront - applied donation, never negative. Excess donation is not
  a credit against maintenance. Do not also subtract donations from budget or annual upkeep.
- Funding gap = max(0, net upfront - budget). Budget is the organization's cash excluding
  the donation already listed; budget never changes project cost or break-even.
- Annuity factor = `[1 - (1 + rate)^(-years)] / rate`; zero-rate factor is `years`.
  Use numerically stable evaluation near zero. Upkeep is constant real cost at year end.
- Discounted total = net upfront + annual upkeep * annuity factor.
- Break-even annual savings = positive net-upfront premium / annuity factor. Identify
  which quote has higher upfront cost; lower ongoing upkeep is not assumed automatically.
  Equal upfront costs return `equal-upfront` with zero premium and zero threshold.

A valid `FinanceResult` contains `annuityFactor`, `quoteA`, `quoteB`, and `breakEven`.
Each `QuoteSummary` has `quoteId`, `grossUpfront`, `donationApplied`, `upfront`, `fundingGap`,
`annualUpkeep`, and `discountedTotal`. Each monetary result is `Amount`: `known` with
`amountUSD`, or `unknown` with `missingFields` (e.g. `quoteA.delivery`). Unknowns propagate
only to dependent results: missing upkeep does not hide known upfront/funding gap/break-even;
missing delivery does hide upfront-dependent results. Break-even is `unknown`, `equal-upfront`,
or `premium` with both quote IDs, `premiumUSD`, and `annualSavingsRequiredUSD`.
No discounting, structural analysis, or finance recomputation belongs in a UI component.

## Component handoff: exact names, props and callbacks

Claude exports named components at these paths. All props types are available from `shared`.

```ts
// src/studio/BridgeStudio.tsx
export function BridgeStudio(props: BridgeStudioProps) { /* Claude */ }
// src/community/ui/CompareBuildOptions.tsx
export function CompareBuildOptions(props: CompareBuildOptionsProps) { /* Claude */ }
// src/community/export/DecisionSheet.tsx
export function DecisionSheet(props: DecisionSheetProps) { /* Claude */ }
```

| Component | Props | Callback contract |
| --- | --- | --- |
| `BridgeStudio` | `preset`, `state`, `engineStatus: 'pending' | 'ready'`, `deformationScale` | `onAction(action: TrialAction): void` |
| `CompareBuildOptions` | `model: FinanceViewModel` | `onInputsChange(inputs: FinanceInputs): void` |
| `DecisionSheet` | `model: DecisionSheetModel` | `onPrint(): void` |

`FinanceViewModel` is `{ inputs: FinanceInputs, result: FinanceResult | PendingResult }`.
`FinanceInputs` has `quoteA`, `quoteB`, `budgetUSD`, `years`, `rate`. A pending result has
`status: 'pending'` and `message`; display it honestly and do not fabricate output.
`BridgeStudio` disables commitment while the engine is pending.

Astra owns canonical state, calculations, finance recomputation, navigation and print wiring.
Claude owns drag pointer state, focus, form text, overlay toggles and historical selection.
A drag or keyboard move dispatches `set-load` with the snapped joint and unchanged force.
Use `select-panel`, `commit`, and `new-round` for the remaining canonical actions. Never mutate
props or history. A load change in the committed phase cannot change the selected brace.
No continuous geometry editor. Controls snap to the three preset joint IDs and have keyboard
alternatives. If a public callback/prop is missing, request a contract change before adding it.

Render displacements using the supplied finite positive `deformationScale` and label it
(e.g. "Deformation magnified 100×"). Numerical text remains in physical mm, not magnified mm.
Signed forces must be identified as tension/compression with N. The original and modified
overlays refer to the current scenario; first prediction history has its own load/round label.
Rankings show every tied best panel; none appear for the new current round before commit.

## Decision sheet and measurements

`DecisionSheetModel` has `title`, `scenario: StructuralScenario | null`,
`firstPrediction: PredictionTrial | null`, `measurements`, `finance`, `deformationScale`,
and `assumptions`. A `StructuralScenario` has its own `label`, `presetVersion`, `loadCase`,
`panelId`, and `result`. Astra passes only committed/retested scenarios, never a draft result.
Null means no committed prediction. Invalid current results must not fall back to historical
numbers in current sketches or performance text. The separate first prediction stays labeled.

Five required one-page sections:

1. **What changed**: scenario label, load location/magnitude, selected brace, original and revised sketches.
2. **Predicted**: computed loaded-joint deflection, reduction (or absolute change), relevant signed forces.
3. **Measured**: matching actual readings with conditions, or exactly “No measurement recorded”.
4. **Cost comparison**: scenario/package labels, sources, budget, gaps, horizon/rate, totals and break-even.
5. **Open assumptions**: ideal model, physical uncertainties, unverified prices/upkeep.

`MeasurementRecord` records preset/design ID, intervention panel (null for original), exact
load case, measured node, `quantity: 'vertical-displacement'`, signed value in mm, method,
uncertainty in mm or null, and conditions. A downward measurement is negative. Display only
readings matching the scenario/design/load, or label other readings as different scenarios.
Never insert synthetic physical evidence. Measurement capture is optional and not implemented
in this checkpoint; an empty array is the supported default. A 1:1 assembly template, if added,
is a separate optional print export. The decision sheet is not a 1:1 assembly drawing.

Claude owns print CSS/layout; Astra wires `onPrint` to the browser print dialog and verified
model data. Hide app controls in print. Actual preview inspection for one readable page is
required at integration; a jsdom or mocked component test is not print acceptance.

## Tooling and acceptance gates

- `npm run dev`: local Vite development server.
- `npm run typecheck`: strict TypeScript, including tests and config.
- `npm test`: deterministic Vitest suite; default Node environment. Component tests may use
  `// @vitest-environment jsdom` and explicit Testing Library cleanup/setup.
- `npm run build`: typecheck plus production bundle with relative asset URLs.
- `npm run preview`: local production preview (HTTP server, no backend/API).
- `npm run check`: typecheck, unit tests, production build.

React, TypeScript, Vite, Vitest, Testing Library/jsdom and Playwright are pinned in the lockfile.
No external fonts, CDN assets or runtime network calls. Offline production demo means serving
`dist` locally with networking disabled; opening raw HTML with file:// is not the acceptance path.
Browser end-to-end setup and checks are added during integration; installing Playwright's
package does not assert that its browsers or any end-to-end checks have run.

Foundation tests verify canonical fixture topology/units, source labels, snapshot isolation,
and type boundaries. They do not, by themselves, validate the engines. The engine checkpoint adds dedicated
structural, financial, trial and real-engine React controller suites. Engine gates are the original analytic triangle (1% tolerance), unstable square,
all four brace alternatives at all three load joints, signs/reactions, symmetry/ties, and zero
baseline behavior. Finance gates use the original 3%/0% examples, break-even equality,
unknown inputs, invalid horizons/rates, and budget isolation. Trial gates verify immutable
first results and reveal transitions.

Integration must exercise actual commit → reveal → move load with same brace → first-result
retrieval → new hidden round, plus editable quotes/horizon with unchanged engineering output,
keyboard use, overlay toggles, one-page print preview and an offline production build.
Cross-review is read-only and happens after writers stop. No mocked check substitutes for
that full flow. No commit, merge, push, deployment or submission is implied by this checkpoint.
