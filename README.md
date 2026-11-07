# Forma

A local browser workbench for a one-brace truss experiment, an independent package
cost comparison, and a selected-trial decision sheet.

**Phases 1–3 are implemented.** Choose a load position and brace, commit your
prediction, then compare all four placements using the tested structural engine.
Drag the load or use the keyboard to retest the same brace. Saved trials preserve
their original results for the session. The bridge shows original/modified
deformation at one magnification and offers signed force and reaction tables.
Editable costs belong to Phase 4 and printing to Phase 5. No fixture numbers are
used as calculated results.

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
installed and `dist` is built, the local server can serve the experiment without
an internet connection. The full offline judging/printing release gate belongs to
Phase 6. Reloading clears session-only trials. No database, remote service, or
account is required.

## Try the experiment

1. Leave the load at **B1** and select **P2**. Commit: its reduction is **1.09%**.
2. Move the load to **B2**. The retained P2 brace now ties with P3 at **10.46%**.
3. Choose **Show saved result** to restore B1/P2 unchanged.
4. Start another prediction to choose a new brace; earlier trials remain below.

The native load/panel radio groups support arrow keys. The SVG load handle also
supports arrows and Home/End. Commit, history, navigation and view controls work
with the keyboard. Results remain hidden until commit. Deformed overlays share
the displayed **200×** magnification; numeric values remain in actual mm/N.

## Handoff documents

- [Phase 1 decisions](docs/decisions.md): scope, units, stack, and explicit exclusions.
- [Shared contracts](docs/contracts.md): module APIs and future reducer behavior.
- [Fixture provenance](docs/fixtures.md): expected data, tolerances, and mock limitations.
- [Phase 1 acceptance](docs/phase-1.md): what was delivered and how to verify it.
- [Phase 2 acceptance and API](docs/phase-2.md): preset, solver, ranking, numerical policy and benchmark.
- [Phase 3 acceptance and handoff](docs/phase-3.md): interaction, trial state, live integration and browser checks.
- [Ownership and merge order](docs/merge-plan.md): the next independent work streams.
- [Full phased plan](output/pdf/Forma_Phased_Build_and_Design_Review.pdf): the planning PDF.

## Repository boundaries

| Path | Owner | Purpose |
| --- | --- | --- |
| `src/app` | Integration | Navigation, experiment reducer, immutable trials and live solver orchestration |
| `src/shared` | Integration | Contracts, release constants and snapshot utility |
| `src/shared/fixtures` | Integration, structures review | Test/development data only; never runtime fallback |
| `src/structures` | Structures | Phase 2 preset generator, solver and ranking |
| `src/studio` | Studio | Bridge SVG, controls, comparison overlays, results and history views |
| `src/community/costs` | Community | Phase 4 quote calculations and forms |
| `src/community/report` | Integration | Phase 5 immutable report and print view |
| `src/community/measurements` | Community | Optional physical readings |
| `src/community/template` | Community | Optional separate assembly template |

Do not implement calculation logic in React components. Runtime modules import
contracts through `src/shared`; fixtures are deliberately absent from its barrel.
The boundary tests protect that separation.

## Next work

The next work is **Phase 4 (cost calculations, editable packages and domain
isolation)**, followed by Phase 5 reporting. Keep one
writer per module and put any shared-contract changes in a preceding
integration-owned PR. No later-phase function returns a fake successful result.

The `phases` branch (formerly `feat/codex-phase-1`) preserves this implementation as an independent
snapshot in `itsvaibhav2k-alt/forma`. It does not share commit ancestry with that
repository's `main`, which contains the other agent's calculation engines.
Reconcile the contracts and numerical defaults before selectively integrating
the implementations. No engine code from `main` is included in this snapshot.
