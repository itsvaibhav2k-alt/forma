> Historical record of the standalone phases hardening candidate on port 4186.
> This checkout also integrates main’s engines; use [the combined handoff](main-engine-integration.md)
> and its separately verified candidate/port 4187 for current acceptance.

# Phases release-candidate hardening — 2026-11-07

Recommendation: **ready for release-candidate evaluation on this host; not yet
approved for presentation release**. This is an isolated additive patch based on
`8d948ab1ccdade7a692d1844ef9e7f837f5525be`, fetched from `origin/phases` before work.
Branch: `fix/phases-rc-hardening`; worktree: `/private/tmp/forma-phases-rc`.
No merge, commit, push, deployment or change to main is part of this work.

## Implemented

- History uses a separate read-only inspection ID. Opening a saved trial preserves
  the active round, draft load/panel, saved selection and retest by reference.
  Return restores that state without solving. Experiment controls are disabled
  during inspection; focus moves to Return and back to the opening history action.
  A new round still exposes no analysis until commitment.
- Report, measurement and assembly actions explicitly identify their saved trial.
  An inspected historical trial does not borrow the active experiment's retest.
  Current financial inputs remain a separately labeled comparison. Existing frozen
  report and reading stores, solver, financial formulas, presets and style remain.
- One shared validator requires 1–20 finite raw observations, nonblank method and
  physical conditions, valid units/association/resolution/displacement, and the raw
  mean. Direct report capture uses it and recomputes assessment. Zero observations
  and unknown resolution remain valid. No measurement list remains valid and says
  “No measurement recorded.” No physical evidence is manufactured.
- Oversized paper disables the app print action and native print CSS substitutes
  an overflow warning. Full evidence remains on screen/in JSON; assembly SVG units
  remain unchanged. Print-time hidden dimensions cannot accidentally clear the guard.
- The benchmark's stdout remains JSON: Vite informational output previously caused
  `release:prepare` to fail on a fresh dependency-optimization cache.
- An opt-in `scripts/rc-browser-qa.mjs` exercises the packaged launcher, not Vite.
  Playwright is a host QA tool, not a new application dependency. The release bundle
  includes this handoff as `RC-HARDENING.md`.

Changed implementation areas: `src/shared/state.ts`; `src/app/experiment/{state,
useExperiment}.ts`; `src/app/App.tsx`; `src/studio/{Experiment,BridgeCanvas}.tsx`;
`src/community/measurements/engine.ts`; report/template preview components and
print CSS; `scripts/{benchmark-structures,package-release}.mjs`.
Regression coverage: `src/app/experiment/state.test.ts`, `src/app/history.test.tsx`,
`src/app/report.test.tsx`, `src/community/report/buildDecisionSheet.test.ts`,
`src/community/template/pattern.test.tsx`, and the opt-in browser script.
Contracts and Phase 3/5/6/7, merge-plan, PDF and release handoffs were synchronized.
No second engine, store, snapshot utility or contract system was introduced.

## Independently verified on this host

Environment: macOS arm64, Node **v22.17.1**, headless Chromium **158.0.8127.18**.
This is not a claim about the presentation laptop or every supported Node/browser.

| Check | Actual result |
| --- | --- |
| `npm run check` | 212 tests / 21 files passed; six Node release tests passed; strict TypeScript and Vite production build passed |
| `npm run test:release:network` | One real-socket test passed: loopback HTTP and occupied-port rejection |
| Release packaging | Check/build, benchmark, local-asset audit, manifest and bundle hashes pass; source is explicitly marked dirty |
| Packaged browser | Predict → commit → retest → history → return → new round; P4/B3 draft and active retest retained; multiple-trial capture uses the right saved result |
| Keyboard / narrow layout | Tab/arrows/Enter reach prediction, retest, history and return; opening/return focus asserted; experiment, costs, measurements, report and template have no document overflow at 375 × 812 |
| Costs | Unknown differs from zero; source edits/relabeling work; invalid upkeep/horizon suppress stale totals/capture; saved structural results stay unchanged |
| Evidence / freezing | Explicitly labeled synthetic zero readings and unknown resolution accepted; missing raw/conditions rejected; later measurement removal and cost edits leave captured report unchanged |
| Downloads / overflow | JSON retains full long evidence; SVG contains 18 braced members, 254 × 100 mm dimensions and a 100-unit bar; long report and injected long assembly annotation block app/native printing |
| Browser diagnostics | Zero console warnings/errors, page errors or attempted external requests in the checked flow; only loopback HTML/JS/CSS/SVG requests |
| Decision-sheet PDF | One US Letter portrait page, **612 × 792 pt**; all five sections, saved B1/P2, 1.09%, signed force, full costs/sources and footer visually inspected |
| Assembly PDF | Separate one-page Letter landscape, **792 × 612 pt**; geometry, crossing gap, member table, trial identity and calibration warning visually inspected |

The assembly overflow case deliberately injects a long annotation in the browser
DOM to exercise the guard; the fixed production preset has no editable annotation
field. This is QA fault injection, not an added feature or a saved observation.
Browser network interception records/blocks non-loopback attempts; it is not a
physical internet-disconnection test. PDF export uses Chromium's print renderer
with CSS paper sizes and scale 1, not a manual operating-system print dialog.
Screenshots/PDFs showed no visible clipping or overlap. File dimensions do not
prove printer scale or physical measurements.

Evidence lives outside the hashed bundle in `output/previews/rc-qa/`: `results.json`
records the exact tested candidate/source fingerprint and browser version; the two
PDFs, rendered PNGs, narrow-screen captures, SVG and JSON snapshots are retained.
`output/releases/latest.json` identifies the current archive and SHA-256; compare
its candidate ID with `results.json` before attributing browser evidence to a build.
These ignored QA artifacts are not production fixtures or fallback results.

## Reproduce and launch locally

From this isolated checkout:

```sh
npm ci
npm run check
npm run test:release:network
npm run release:prepare
npm run release:verify
```

The release command creates a unique folder and archive under `output/releases`.
Extract it fully outside that directory, run `node verify.mjs` from the extracted
folder, then `PORT=4186 node serve.mjs`. Preview: **http://127.0.0.1:4186/**.
No npm install is needed inside the bundle; a compatible Node runtime is required.
Keep PDFs/JSON and completed checklists outside the bundle so checksums stay valid.

On this host, the opt-in browser command is:

```sh
PLAYWRIGHT_MODULE=/private/tmp/forma-astra-engine/node_modules/@playwright/test/index.mjs node scripts/rc-browser-qa.mjs
```

It reads the latest packaged candidate, verifies it, starts its actual `serve.mjs`
on port 4186, runs assertions/downloads/PDF export, writes evidence, and shuts down
that QA server. Run it before starting the persistent preview on the same port.
On another host, supply an installed `@playwright/test` module path and compatible
Chromium, or install Playwright as a separate QA tool. Nothing is imported from
that other worktree's application code. Re-render and visually inspect exported
PDFs after any layout change; the script alone is not visual acceptance.

## Still awaiting manual acceptance

- Presentation-laptop clean extraction/checksums, launcher/CSP flow, keyboard and
  native print-dialog/PDF review, plus physically disconnected cold start/restart.
- Outside-tester usability review; actual-laptop solve and input-to-paint timings;
  two recorded 90-second rehearsals; submission/team/disclosure details.
- If physical features are demonstrated: actual readings with documented apparatus,
  supports/load sharing/material/joint conditions, uncertainty review, and a ruler
  measurement of the printed 100 mm bar. No physical agreement/scale is certified.
- Approval to commit the accepted patch, followed by a clean committed release
  package and acceptance of that exact archive. This dirty-source candidate is for
  evaluation; no commit is authorized by this hardening task.

There are no known automated correctness blockers after these checks. The manual
gates above still block a final release recommendation. Consult the bundled
release, PDF and physical checklists and record acceptance against the exact
candidate ID rather than carrying approval forward to a changed build.
