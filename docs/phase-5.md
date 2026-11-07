# Phase 5 — Frozen decision sheet and export

Implementation is complete on `phases`. Native print-preview pagination and a
saved sample PDF remain **manual acceptance**, at the user's request. Do not treat
the screen measurements or the test suite as proof of a one-page native PDF.

## 5.1 — Freeze the report payload

**Prerequisites: 3.3 + 4.3.** `buildDecisionSheet(inputs, reportId, createdAtIso)`
implements the shared port as a pure function. It reads the explicitly supplied
saved trial and optional retest, validates associations, recomputes financial
results to reject stale quote/result pairs, then clones and freezes the entire
payload. It never reads live app state or reruns the structural solver.

Checks include trial identity, load, brace, preset/solver versions, complete
node/member outputs, finite numbers, retest source/retained brace/geometry, unique
measurement IDs and matching included design/version/load/joint. Measurements
retain units, method, raw readings, resolution, notes and entered assessment;
displaying an assessment does not establish model validation. Nonfinite values
are rejected before JSON serialization can turn them into null.

The builder adds mandatory model, physical-evidence and cost assumptions to any
caller-supplied assumptions. Metadata uses a supplied ID and canonical ISO time,
so capture remains deterministic and testable. Invalid internal inputs throw
descriptive errors. This is an internal typed port, not an untrusted JSON importer
or an independent audit of solver mathematics. Shared contract shapes are unchanged.

`App` holds the frozen payload independently of the experiment and quote hooks.
The primary scenario always uses the **selected saved trial**. A valid active
retest is omitted by default and included only through the checkbox. A failed
retest is explicitly excluded without losing the valid saved prediction.

Capture requires a selected trial and valid financial settings/common scope.
Prices may all remain unknown. Later changes and navigation leave the sheet intact;
**Capture new sheet** explicitly replaces it. Reload clears session state.

## 5.2 — Letter print view

**Prerequisite: 5.1.** `DecisionSheet` renders only its payload, with five sections:

1. **What changed:** saved load/brace, original and modified drawings, trial identity.
2. **Predicted:** loaded-joint displacement, percentage or absolute-only change,
   winning IDs, and signed added-brace force. An included retest is labeled Scenario R.
3. **Measured:** case-specific readings, or exactly **No measurement recorded.**
4. **Cost comparison:** independent Scenario C, scope, inputs with source references,
   budget, funding gap, horizon, rate, totals, donation notes and break-even savings.
5. **Open assumptions:** model exclusions, measurement uncertainty, unverified cost
   inputs and the separate equal-service financial scenario.

The report-only SVG adapter uses the stored geometry and displacement vectors.
Both sketches use the same labeled 200× magnification as the experiment. Gray
lines show undeformed geometry, dashed black lines show deformed members, and a
heavy solid line identifies the added brace. Signed force text uses tension /
compression labels, so color is not required. Sketches are not 1:1 templates.

Print CSS specifies US Letter portrait with 0.25-inch vertical and 0.5-inch
horizontal margins. Screen and print share the same 7.5-inch sheet width and
typography. Controls/navigation are excluded. The preview preserves paper width
on small screens inside a horizontal scrolling region; the page itself does not
overflow at 375 px.

The measured screen preflight allows at most 10.3 inches of content, leaving
0.2 inch below the printable height. Oversized content disables the app's print
button and explains how to shorten inputs/recapture; no source, note or assumption
is silently clipped. JSON remains downloadable. Arbitrarily long strings are not
guaranteed to fit on one page. Browser-native printing outside the app button can
bypass this preflight, and actual printer/driver settings still require review.

## 5.3 — Export verification

**Prerequisite: 5.2.** The app uses `window.print()` for Print / Save PDF and a local
Blob download for the entire JSON snapshot. There is no remote service, report
generation API or new dependency. JSON retains full precision and all analyses;
importing a downloaded report is not implemented.

Automated checks cover captured B1/P2 while B2 is active; explicit retest inclusion;
unchanged report text after quote, load and selected-trial changes; unknown costs;
invalid-input gating; deep copies of readings; association failures; overflow
preflight; and print invocation. Boundary tests prohibit live app state in the
report view and React/solver calls in the pure builder.

`npm run check` passes **178 tests across 17 files**, strict TypeScript checking
and the production build. `npm run prepare:report-qa` successfully generates all
three reference pairs. `git diff --check` passes.

Production-browser checks verified:

- The saved B1/P2 result remains **1.09%**, and the explicitly included B2/P2 retest
  shows **10.46%** with **P2 + P3** tied best.
- Full quotes with retest: 720×954 px sheet, below the 988.8 px screen allowance.
- Unknown B upkeep and 78–79-character package names with retest: 720×968 px.
  B's funding gap stays known and its discounted total is explicitly unknown.
- Later horizon/upkeep edits leave the captured report text identical.
- The actual JSON download retains the original 10-year, $450 upkeep inputs,
  both selected scenarios and full-precision B present cost of 24838.591276549123.
- A deliberately oversized scope disables printing while preserving all text.
- At 375×812, page width remains 375 px and the paper region scrolls separately.
- No browser console warnings or errors were recorded.

These are screen/data checks. The in-app print dialog could not be inspected and
Chrome control was not approved. The user elected to perform native PDF QA.
No sample PDF has been generated or claimed as verified by this phase's automation.

### Manual PDF checklist

Use the running production app (`npm run build`, then `npm start`):

1. Commit P2 at B1, retest at B2, and load the fictional quotes.
2. Capture without the retest checkbox: confirm the primary result is B1/P2,
   1.09%, and that B2 is absent. Print / Save PDF with Letter, portrait, 100% scale,
   browser headers and footers off. Confirm **one page** and all five sections.
3. Capture with the retest checked: verify the separate B2/10.46% section and
   readable force signs, labels and sketches in grayscale.
4. Repeat with B upkeep blank and long package labels. Confirm known upfront/gap,
   unknown discounted total, readable wrapping and one page with no clipped text.
5. Save the approved complete example as
   `output/pdf/Forma_Decision_Sheet_Sample.pdf` for release QA. Reopen that PDF and
   check its page count and content against the downloaded snapshot.

For reproducible cases without clicking through the app:

```sh
npm run prepare:report-qa
```

This uses the production builder/component and creates three standalone HTML/JSON
pairs under ignored `tmp/report-qa`: `selected-trial`, `with-retest`, and
`unknown-upkeep-long-labels`. Open each HTML in a browser and follow the print
checklist. The script prepares QA content; it does not claim to render or validate
a native browser PDF.

## Remaining scope

Finish the manual PDF gate before Phase 6's broader offline keyboard/print release
rehearsal. Physical measurement entry, assembly templates, report import and
persistent storage remain later work. No structural calculation, preset, trial
reducer, financial formula, dependency or fixture was changed in this phase.
