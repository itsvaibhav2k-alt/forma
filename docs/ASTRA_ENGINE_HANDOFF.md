# Astra engine checkpoint

Approved for commit and integration, November 7, 2026. Astra has stopped implementation
work on this checkpoint.
Claude is implementing the presentation lane separately. Do not merge that lane while its
writer is active. No public type, component prop, callback, or numerical contract changed.

## Branch and integration status

- Branch: `feat/astra-engine`
- Checkout: `/private/tmp/forma-astra-engine`
- Shared base: `4f1c7ce` — approved foundation, committed and fast-forwarded into `main`.
- Vaibhav explicitly approved committing this engine checkpoint and integrating it into main.
  The engine checkpoint is the commit containing this handoff; the foundation remains its base.
- No pushes, deployment, submission, UI-lane writes, or README changes performed.

## Implemented

- Planar pin-jointed direct stiffness analysis with explicit input validation, equilibrated
  Cholesky solution, instability detection, free-DOF residual checks, displacement vectors,
  tension-positive member forces and restrained-direction reactions. Invalid results contain
  only issues/status, never previous performance values.
- Baseline and four independent one-brace analyses at the same load; deterministic panel
  order, unrounded tie detection, zero-baseline absolute change, invalid-candidate rejection.
- Independent financial calculations: gross/net upfront, cash donations applied once,
  funding gaps, discounted year-end maintenance, break-even savings, explicit unknowns and
  invalid-state clearing. Stable annuity evaluation near zero discount rate.
- Deeply copied and frozen first predictions and append-only session history. Retests retain
  the committed brace and snapshot. New rounds hide current rankings until commit.
- App state reducer and React controller using the actual engines, with independent financial
  and structural updates. Quote edits preserve structural state by reference. Report models
  label current predictions/retests and the first prediction separately.

## Changed files since the approved foundation

- `src/structures/analyze.ts`, `src/structures/rankBraces.ts`, `src/structures/index.ts`
- `src/community/finance/index.ts`
- `src/trials/index.ts`
- `src/app/model.ts`, `src/app/useAppController.ts`, `src/app/App.tsx`
- `tests/structures.test.ts`, `tests/finance.test.ts`, `tests/trials.test.ts`
- `tests/app-integration.test.tsx`
- `docs/CONTRACTS.md` (implementation availability only; frozen signatures unchanged)
- `docs/ASTRA_ENGINE_HANDOFF.md`

## Exact final validation

Command run in the Astra checkout: `npm run check` (exit 0). This ran:

| Command | Actual result |
| --- | --- |
| `npm run typecheck` | PASS — strict TypeScript, including all tests/config |
| `npm test` | PASS — 113 tests, 6 files |
| `npm run build` | PASS — production bundle, 25 modules, 237.59 kB JS (74.90 kB gzip) |

Suite counts: 42 structures, 36 finance, 19 trials, 6 React controller integration,
9 foundation fixtures/immutability, 1 contract-return-type test. The negative type checks
are also checked by TypeScript. Node v22.17.1 and npm 10.9.2.

The React controller tests use real solver/finance/trial modules, not fabricated calculation
results. They invoke callbacks via Testing Library's `renderHook` in jsdom. They are **not**
browser end-to-end or presentation tests. The print callback test stubs `window.print`; it
proves callback wiring only, not page count or readable print layout.

A separate read-only Vite SSR invocation executed the real engines to inspect the numerical
outputs below. Values are rounded here for readability; runtime calculations retain doubles.

## Observed regression outputs

Analytic triangle: apex y = -0.19142135623730946 mm; bottom tie +0.500000000000 N;
both inclines -0.707106781187 N; each vertical reaction +0.500000000000 N.
The unstable square returns `singular-system`. All triangle checks comfortably pass the
brief's 1% tolerance. Nodal force and whole-model moment equilibrium are checked for every
baseline/alternative at all three interior load joints.

Judge bridge, default EA=1,000 N and 1 N downward load:

| Load joint | Baseline mm | Panel 1 reduction | Panel 2 reduction | Panel 3 reduction | Panel 4 reduction | Best panels |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| b1 | 0.437020625 | 26.344920% | 1.086171% | 2.927213% | 2.927213% | 1 |
| b2 | 0.699360833 | 7.316696% | 10.455886% | 10.455886% | 7.316696% | 2 and 3 |
| b3 | 0.437020625 | 2.927213% | 2.927213% | 1.086171% | 26.344920% | 4 |

At 3% over ten years: annuity factor 8.53020283677583; present costs
$26,677.182553098246 / $24,838.591276549123; annual break-even savings
$234.46101321031918. At 0%: factor 10; break-even $200. Tests verify equal present costs
at exactly the computed threshold, known/unknown propagation, budget-only gap changes,
horizon changes, donation limits, and invalid/overflow inputs.

## Claude integration instructions

The frozen component props remain the sole boundary. `useAppController()` in
`src/app/useAppController.ts` returns:

- `studio: BridgeStudioProps`
- `community: CompareBuildOptionsProps`
- `decisionSheet: DecisionSheetProps`

Astra will wire those props into Claude's three named components when the stopped UI
checkpoint is available. The current `App.tsx` is deliberately an honest waiting shell;
it does not pretend to expose the judging flow. Runtime imports from `src/app/` are:

```ts
import { analyze, rankBraces } from '../structures';
import { compareQuotes } from '../community/finance';
import { commitPrediction, createTrialState, transitionTrial } from '../trials';
```

The controller supplies `engineStatus: 'ready'` and real financial outputs. It dispatches
all canonical trial actions and finance changes, generates report data, and owns the print
callback. UI components must not perform their own calculations. A report scenario is null
before commitment and during a new hidden round. Invalid retests pass an invalid current
scenario, while the explicitly historical first prediction remains available.

## Assumptions and remaining acceptance

All previously approved assumptions remain in force: fixed demo geometry/stock, mm/N/USD,
nonnegative decimal real discount rate, whole-year positive horizon, cash donations once
against upfront costs, and in-memory history. No physical measurement is invented. Snapshot
retention does not imply persistence across reload. Optional measurement capture/template
remain deferred. Numerical conditioning uses a 1e-12 pivot threshold after diagonal scaling;
near mechanisms return invalid rather than unreliable performance results.

No engine test/build failures remain. Remaining work depends on Claude's stopped presentation
checkpoint: read-only cross-review of solver units/signs/constraints and UI data provenance,
app component/navigation wiring, actual drag/keyboard/overlay/historical-selection interactions,
quote/horizon interaction isolation, one-page print-preview inspection with readable sketches,
and an offline local production demo. None of those unperformed UI/browser/print checks is
claimed complete here. The engine checkpoint should integrate before the UI checkpoint.
