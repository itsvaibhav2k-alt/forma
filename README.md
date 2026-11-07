# Forma

A local browser workbench for a one-brace truss experiment, an independent package
cost comparison, and a selected-trial decision sheet.

**Phases 1 and 2 are implemented.** This repository contains the decisions, shared
contracts, independent fixtures, React/TypeScript shell, and tested structural
engine. The engine generates the bridge, validates inputs, solves 2D trusses and
ranks the four independent brace additions. The shell still supports navigation
only; live prediction/retest integration belongs to Phase 3, editable costs to
Phase 4, and printing to Phase 5. It does not display fixture numbers as calculated
results.

## Run locally

Use the version in `.nvmrc` (`20.20.2`) or a compatible Node version declared in
`package.json`. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run dev
```

Vite serves the app at **http://127.0.0.1:5173**. The host is loopback-only and the
port is strict so a collision is reported rather than silently changing the URL.

```sh
npm run check     # tests, strict TypeScript checking, production build
npm run test:watch
npm run bench:structures  # five-design calculation timing, no browser UI
npm run build
npm start        # serves dist at http://127.0.0.1:4173
```

The production build uses local assets and system fonts. Once dependencies are
installed and `dist` is built, the local server can serve the shell without an
internet connection. This is not yet verification of the full offline judging
flow; that release gate belongs to Phase 6. Reloading the eventual app clears
session-only trials. No database, remote service, or account is required.

## Handoff documents

- [Phase 1 decisions](docs/decisions.md): scope, units, stack, and explicit exclusions.
- [Shared contracts](docs/contracts.md): module APIs and future reducer behavior.
- [Fixture provenance](docs/fixtures.md): expected data, tolerances, and mock limitations.
- [Phase 1 acceptance](docs/phase-1.md): what was delivered and how to verify it.
- [Phase 2 acceptance and API](docs/phase-2.md): preset, solver, ranking, numerical policy and benchmark.
- [Ownership and merge order](docs/merge-plan.md): the next independent work streams.
- [Full phased plan](output/pdf/Forma_Phased_Build_and_Design_Review.pdf): the planning PDF.

## Repository boundaries

| Path | Owner | Purpose |
| --- | --- | --- |
| `src/app` | Integration | Shell now; reducer, trial history and orchestration in Phase 3 |
| `src/shared` | Integration | Contracts, release constants and snapshot utility |
| `src/shared/fixtures` | Integration, structures review | Test/development data only; never runtime fallback |
| `src/structures` | Structures | Phase 2 preset generator, solver and ranking |
| `src/studio` | Studio | Phase 3 bridge SVG and controls |
| `src/community/costs` | Community | Phase 4 quote calculations and forms |
| `src/community/report` | Integration | Phase 5 immutable report and print view |
| `src/community/measurements` | Community | Optional physical readings |
| `src/community/template` | Community | Optional separate assembly template |

Do not implement calculation logic in React components. Runtime modules import
contracts through `src/shared`; fixtures are deliberately absent from its barrel.
The boundary tests protect that separation.

## Next work

The next work is **Phase 3 (SVG, accessible controls, trial state and live solver
integration)**. Phase 4.1 (cost functions) can proceed independently. Keep one
writer per module and put any shared-contract changes in a preceding
integration-owned PR. No later-phase function returns a fake successful result.

The `feat/codex-phase-1` branch preserves this implementation as an independent
snapshot in `itsvaibhav2k-alt/forma`. It does not share commit ancestry with that
repository's `main`, which contains the other agent's calculation engines.
Reconcile the contracts and numerical defaults before selectively integrating
the implementations. No engine code from `main` is included in this snapshot.
