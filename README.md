# Forma

A local browser workbench for a one-brace truss experiment, an independent package
cost comparison, and a selected-trial decision sheet.

**Phases 1–5 and optional Phase 7 are implemented; Phase 6 release tooling is ready.** Native PDF and
presentation-laptop acceptance remain manual handoffs. Choose a load position and brace, commit your
prediction, then compare all four placements using the tested structural engine.
Drag the load or use the keyboard to retest the same brace. Saved trials preserve
their original results for the session. The bridge shows original/modified
deformation at one magnification and offers signed force and reaction tables.
Compare two equal-scope packages using editable, sourced amounts, upfront funding
gaps, discounted totals and a break-even upkeep threshold. Capture an immutable
decision sheet, print/save it as PDF, or download the full snapshot as JSON.
No fixture numbers are used as calculated results.

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
npm run prepare:report-qa # prepares four frozen HTML/JSON cases for manual PDF checks
npm run test:release:network # optional real-loopback launcher checks; requires port permission
npm run release:prepare # checks, builds, benchmarks and packages a portable candidate
npm run release:verify  # verifies the latest candidate, or append -- /path/to/extracted/folder
npm run build
npm start        # serves dist at http://127.0.0.1:4173
```

The production build uses local assets and system fonts. Once dependencies are
installed and `dist` is built, the local server can serve the experiment without
an internet connection. The full offline judging/printing release gate belongs to
Phase 6. Reloading clears session-only trials, quote inputs, measurements and captures. No database, remote service, or
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

## Try the cost comparison

1. Open **Compare build options**. Prices start blank and remain unknown until entered.
2. Choose **Load fictional example** to try the labeled specification inputs.
   At 10 years and 3%, upfront costs are **$19,000 / $21,000**, funding gaps
   **$0 / $1,000**, and discounted totals **$26,677.18 / $24,838.59**.
3. The higher-upfront option needs **$234.46/year** in upkeep savings; the example
   expects **$450/year**. Set the rate to 0% and the threshold becomes **$200/year**.
4. Clear annual upkeep: its discounted total becomes unknown while upfront
   affordability remains available. Enter `0` only for a known zero cost.
5. Edit amounts, source references, scope, budget, horizon or rate. Return to
   **Experiment**: saved trials and the active retest remain unchanged.

Amounts use real USD and constant year-end upkeep. Cash contributions are deducted
once and cannot exceed initial costs. The common scope is a user declaration;
source labels do not independently verify supplier quotes. These are separate
planning inputs, not prices inferred from the tabletop bridge.

## Capture a decision sheet

1. Commit or select a saved trial. In **Compare build options**, supply a common
   scope and correct any validation errors; prices can remain unknown.
2. Choose **Decision sheet** below the workbench. The primary result always comes
   from the selected saved trial. Check **Include the current retest** only if you
   want that separately labeled scenario included.
3. Review the five sections, then choose **Print / Save PDF**. Use US Letter,
   portrait, 100% scale and turn browser headers/footers off. Confirm **one page**
   in your print preview before saving. Native PDF pagination is pending manual QA.
4. Return to **Captured sheet** after edits to see the original snapshot. Choose
   **Capture new sheet** from the workbench to explicitly replace it.

The sheet uses the stored analysis without solving again. It freezes costs,
sources, assumptions and matching readings too. Long content is preserved, and the print button is disabled when the screen
layout exceeds the one-page allowance. Shorten notes and recapture, or download
the complete JSON snapshot. This download is archival; importing it is not implemented.

## Record physical evidence or print a pattern

After committing a trial, open **Physical evidence**. Choose the original or braced
design at the saved load (or current retest), measured joint and units. Enter raw
repeat readings, instrument resolution, method and physical conditions, then save.
Vertical readings are downward-positive; the recorded value is their mean. Blank
resolution stays unknown. The app marks insufficient resolution or large repeat
spread inconclusive and never automatically claims agreement with the ideal model.

Only readings matching the captured design/version/load enter a decision sheet;
retest readings require **Include the current retest**. Later reading edits/removal
do not change an existing capture. Drafts and readings last only for this session.

Choose **Original assembly template** or **Braced assembly template** for a separate
undeformed, 1:1 side-panel pattern with member lengths and an SVG download. Print
on **US Letter landscape, 100% / actual size**, with fit-to-page and browser headers/
footers off. Check the actual paper's 100 mm bar with a ruler before use. This is
separate from the portrait decision sheet; its sketches are magnified and cannot
serve as assembly patterns. See the [physical checklist](docs/physical-checklist.md).

## Handoff documents

- [Phase 1 decisions](docs/decisions.md): scope, units, stack, and explicit exclusions.
- [Shared contracts](docs/contracts.md): module APIs and future reducer behavior.
- [Fixture provenance](docs/fixtures.md): expected data, tolerances, and mock limitations.
- [Phase 1 acceptance](docs/phase-1.md): what was delivered and how to verify it.
- [Phase 2 acceptance and API](docs/phase-2.md): preset, solver, ranking, numerical policy and benchmark.
- [Phase 3 acceptance and handoff](docs/phase-3.md): interaction, trial state, live integration and browser checks.
- [Phase 4 acceptance and handoff](docs/phase-4.md): cost formulas, inputs, validation, domain isolation and report snapshot adapter.
- [Phase 5 acceptance and handoff](docs/phase-5.md): frozen reports, print layout, export checks and the manual PDF checklist.
- [Phase 6 release record](docs/phase-6.md): measured evidence, portable packaging and pending release gates.
- [Phase 7 implementation](docs/phase-7.md): measurements, uncertainty screening, separate assembly patterns and verification.
- [Presentation-laptop checklist](docs/release-checklist.md) and [90-second demo script](docs/demo-script.md).
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

The next work is **presentation-laptop acceptance**: native PDF, portable launcher,
offline keyboard flow, outside testing, latency and two timed rehearsals. The final
release commit/archive freeze follows those checks. Keep one
writer per module and put any shared-contract changes in a preceding
integration-owned PR. No later-phase function returns a fake successful result.

The `phases` branch (formerly `feat/codex-phase-1`) preserves this implementation as an independent
snapshot in `itsvaibhav2k-alt/forma`. It does not share commit ancestry with that
repository's `main`, which contains the other agent's calculation engines.
Reconcile the contracts and numerical defaults before selectively integrating
the implementations. No engine code from `main` is included in this snapshot.

## Move the candidate to another laptop

Run `npm run release:prepare` on the development machine. It creates a uniquely
named `.tar.gz`, checksum and extracted folder under ignored `output/releases`;
`latest.json` identifies the latest output. The manifest records the source commit,
dirty-source flag, source fingerprint, automated checks, benchmark and asset hashes.

Install a compatible Node runtime on the presentation laptop while online, copy
and fully extract the archive, then run these commands inside the extracted folder:

```sh
node verify.mjs
node serve.mjs
```

Open `http://127.0.0.1:4173/` and keep the terminal running. The bundle needs no npm
install or `node_modules`. It binds loopback only, requires an explicit free port
and restricts runtime resources/connections to its own origin. Do not open
`dist/index.html` directly. Reload clears session data.

This is a **candidate**, not a certified release. The launcher is covered by
in-memory tests; actual socket startup was blocked by sandbox permissions and the
escalation was declined. Complete the included checklist on the actual laptop,
including native printing and physical internet disconnection. After acceptance,
commit the source, package a clean tree and rehearse that exact final archive.
