# Combined candidate: phases app/state with main engines

The user authorized combining the branch's app state with main's calculation
logic. The integration is isolated on `integrate/phases-main-engines`, checkout
`/private/tmp/forma-combined-rc`. It starts from phases commit
`8d948ab1ccdade7a692d1844ef9e7f837f5525be` plus the uncommitted, tested RC hardening
patch. Main was fetched and remains `9a9c2d816d38abfbcab10461e6571d8f591d89e7`.
Neither existing worktree was edited. No Git merge, commit, push or deployment was
performed; main is unchanged. Unrelated histories were not joined.

## Ownership and wiring

- **Phases owns the app:** UI/style, fixed physical inputs, experiment reducer,
  read-only history inspection/return, focus, session stores, immutable trials,
  measurements, frozen reports, assembly output and portable launcher.
- **Main owns calculations:** direct-stiffness analysis with equilibrated Cholesky,
  full displacement/reaction/member-force outputs, four independent brace solves,
  ranking/ties, upfront costs, contribution capping, discounted upkeep and break-even.
- `src/engines/main/{analyze,rankBraces,finance}.ts` are copied from main unchanged
  except their type-import paths. `origin.json` records source commit/paths/SHA-256;
  three tests reconstruct the original import and verify exact source hashes.
- `src/engines/main/types.ts` is the private subset of main's engine input/output
  types. It does not replace the app contracts or export main's UI/trial system.
- `src/structures/{analyze,rank-braces,main-adapter}.ts` translate the existing app
  ports to/from main. `src/community/costs/engine/compareQuotes.ts` translates quote
  fields, source labels, unknowns, validation errors and returned results.
- Phases' old numerical solver/linear-system implementation and financial/ranking
  calculations were removed. There is one implementation of each engine and no
  fallback solver. Main's trial store/controller is not imported: phases remains
  the sole owner of app state, as requested.

There is still no remote backend/API/database. These are pure TypeScript engines
running in the browser; the release server serves static assets only.

## Deliberate reconciliation

| Concern | Combined behavior |
| --- | --- |
| Geometry / units | Existing 240 × 40 mm geometry, restraints, mm/N/USD and IDs retained; no numerical rescaling |
| Physical inputs | Phases' 10 N downward load, area 10 mm², modulus 10,000 N/mm² retained as inputs to main's general engine |
| Panel names | Adapter maps P1…P4 to main's panel-1…panel-4; app/report IDs remain stable |
| Solver provenance | Saved analyses/trials/reports now use `astra-truss-main-9a9c2d8` |
| Ties / near-zero baseline | Main's `max(1e-9 mm, 1e-8 × best)` tolerance and ≤1e-12 mm absolute-only change; UI rank uses the same tolerance |
| Contributions | Main caps the applied contribution at gross upfront cost; excess is not credited to upkeep. Form and report explain this |
| Equal upfront | Main's exact unrounded equality; presentation-only savings assessment retains its binary-roundoff tolerance |
| Unknown amounts | Remain unknown, including field/package provenance; explicit zero remains known |
| Validation | App guards retain malformed-object checks, fixed judging preset/load restrictions, source/scope validation and safe-integer horizon; main handles its numerical validation/errors |
| Financial presentation | Expected savings is derived from main's returned upkeep amounts; all totals/thresholds come directly from main |
| Test data | Main's regression presets/oracles live only under `src/test`; they never supply runtime results or replace the app preset |

Main's own 1 N / EA=1,000 N preset is used only in its retained regression tests.
It is not the combined app's default, so absolute displacements need not match
screenshots of main using that different input preset. For the current app inputs,
B1/P2 still displays 1.09%; B2/P2 displays 10.46% with P2/P3 tied best.

## Verification and evidence

`npm run check` passes **299 tests across 25 files**, six Node release tests,
strict TypeScript and production build. This includes main's original 42 structural
and 36 financial tests, phases' independent numerical/equilibrium fixtures, adapter
routing/result-map checks, source-hash provenance, financial isolation, frozen
trial/report history, required evidence and print guards. The retired private
Gaussian-elimination unit test was removed with that implementation; ranking
precision coverage now runs against main's actual ranker and the UI boundary.

Run the separate real-socket gate with `npm run test:release:network`. Package with
`npm run release:prepare`, then verify via `npm run release:verify` and, after
extraction, `node verify.mjs`. The manifest records the dirty source fingerprint;
the HEAD commit alone does not contain this uncommitted integration.

The opt-in packaged browser check runs the actual release launcher/CSP on port
4187, exercises commit/retest/history/draft return, costs/unknowns/zero/contribution
capping, frozen reports, synthetic QA evidence, SVG downloads, keyboard/narrow
layouts and print overflow. It also asserts the captured report's main-engine
solver version. It writes snapshots, screenshots, Letter portrait report and
Letter-landscape assembly PDFs under ignored `output/previews/rc-qa/`.

```sh
PLAYWRIGHT_MODULE=/private/tmp/forma-astra-engine/node_modules/@playwright/test/index.mjs node scripts/rc-browser-qa.mjs
```

This uses an existing host Playwright installation, not that worktree's application
code, and modifies no files there. The QA server stops afterward. Exported PDFs
must additionally be rendered and visually inspected. `results.json` identifies
the exact candidate and browser; `pdf-checks.json` records dimensions/page counts;
`final-verification.json` records archive checksum and source-fingerprint agreement.
Read those files for the actual final browser/artifact results rather than assuming
unit tests alone prove an integrated release.

The previous standalone phases hardening evidence remains in `docs/rc-hardening.md`
and its original worktree. It does not certify this changed calculation build.

## Preview and remaining acceptance

From the extracted combined candidate folder:

```sh
node verify.mjs
PORT=4187 node serve.mjs
```

Open **http://127.0.0.1:4187/**. Port 4186 is the separate previous phases candidate.
The launcher needs Node but no npm install or external service. Reload clears
session state; exported artifacts should remain outside the hashed bundle.

This is a review candidate, not a final release approval. Presentation-laptop
physical offline startup, native print-dialog/driver checks, outside-tester review,
input-to-paint timings and two timed rehearsals remain manual. Actual physical
measurements and a ruler check of printed assembly scale are required only if
those features are demonstrated; synthetic QA and PDF file dimensions establish
neither. Committing/freezing and packaging a clean accepted revision require
separate approval. No deployment or main update is included in this integration.
