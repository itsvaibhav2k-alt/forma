# Astra foundation checkpoint

Review candidate, November 7, 2026. No commit, merge, push, deployment, or UI agent launch.

- Branch: `feat/astra-engine`
- Base commit: `1062df1` (`Initialize Forma build plan and two-agent handoffs`)
- Isolated checkout: `/private/tmp/forma-astra-engine`
- Main checkout remains `/Users/vaibhav/forma`; foundation changes are not integrated there.
- Shared contract: [CONTRACTS.md](CONTRACTS.md), with canonical types in `src/shared/types.ts`.

## Implemented

React/TypeScript/Vite foundation, strict compiler configuration, pinned dependencies and npm
lockfile, build/typecheck/test scripts, pending-only app shell, shared data/function/component
contracts, frozen deterministic input fixtures, and a tested deep-copy/freeze utility.

The fixture topology matches the original bridge, triangle and unstable-square definitions.
The demo quote inputs sum to the specified $19,000/$21,000 upfront costs and explicitly label
every price as fictional. Reference regression numbers are labeled test oracles, not runtime
calculation results. UI directories owned by Claude have not been created or edited.

## Changed files

- `package.json`, `package-lock.json`
- `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/main.tsx`, `src/app/App.tsx`
- `src/shared/types.ts`, `src/shared/index.ts`
- `src/shared/fixtures.ts`, `src/shared/immutable.ts`
- `tests/contracts.test.ts`, `tests/foundation.test.ts`
- `docs/CONTRACTS.md`, `docs/ASTRA_FOUNDATION_HANDOFF.md`

## Checks actually run

Environment: Node v22.17.1, npm 10.9.2.

| Exact command | Result |
| --- | --- |
| `npm run typecheck` | PASS, exit 0; strict TypeScript includes negative type-boundary checks |
| `npm test` | PASS, exit 0; 2 files, 10 tests |
| `npm run build` | PASS, exit 0; Vite production bundle, 17 modules transformed |
| `git diff --check` | PASS, exit 0; new files are untracked until an authorized commit |

The tests check fixture topology and units, fictional source labels, hidden/pending initial
states, immutable-copy isolation and runtime freezing, plus public return-type boundaries.
They do not assert solver correctness or financial calculations. No browser interaction,
print-preview, offline-demo, or end-to-end judging-flow acceptance has been performed yet.
Playwright is installed as tooling; browser binaries and end-to-end configuration are deferred.

## Review decisions made explicit

- Judge stock: area 1 mm², modulus 1,000 N/mm² (EA=1,000 N), labeled demonstration assumption.
  Default load: 1 N downward at the first interior joint; no claimed physical calibration.
- Numerical ties: absolute tolerance 1e-9 mm or relative tolerance 1e-8 against the best result,
  whichever is larger. Baseline <=1e-12 mm uses absolute change without percentage.
- Financial rate: finite nonnegative real decimal; horizon: positive whole years.
- Donations: cash available now, subtracted once from gross upfront; capped at gross upfront.
  Excess does not offset upkeep. Budget excludes this already-applied donation.
- Missing prices: null means unknown; explicit zero means free. Unknowns propagate only to
  dependent outputs. Matching nonempty scope IDs are required for quote comparison.
- Trial history: immutable, append-only in-memory rounds; browser reload persistence is outside
  the brief. Retests do not append trials. Invalid current performance does not erase history.
- Main UI styling and physical measurement capture are not implemented at this checkpoint.

## Remaining work and gates

Review/freeze the concrete contract, then authorize the foundation commit and integration
into main so both lanes can start from one common commit. Do not start Claude on an invented
or different API. Visual direction is separately owned by Claude and approved by Vaibhav.
The original noon/afternoon deadlines are planning targets, not evidence of completed work.

Next Astra work: structural solver/ranking and all specified numerical regressions; pure
finance model/break-even tests; immutable trial transitions; real app wiring after Claude's
presentation checkpoint; actual judging flow, quote isolation, offline demo and print checks.
Runtime modules advertised as reserved in CONTRACTS.md do not exist yet. They must not be
imported or imitated by the UI lane before the engine checkpoint is available.

The foundation has no outstanding test/build failures. Full app acceptance remains dependent
on the engines and Claude's presentation components, with print inspection still required.
