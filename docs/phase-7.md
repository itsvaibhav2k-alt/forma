# Phase 7 — optional physical evidence and assembly patterns

Implementation is complete for review on `phases`. This work was authorized while
Phase 6 manual acceptance remained open. No release freeze, tag or merge into the
other implementation is implied. See [merge order](merge-plan.md) for prerequisites.

## 7.1 — Measurement entry and frozen evidence

After committing a trial, Physical evidence exposes its original/chosen designs
at the saved load and any valid current retest. Users select a measured joint and
mm/cm/in units, supply raw repeated vertical readings, instrument resolution,
method and physical conditions. The saved value is the mean; positive is downward.
Blank observations are invalid; blank resolution stays unknown. The form accepts
up to 20 finite readings and rejects malformed numeric text, underflow, overflow,
nonpositive resolution and missing metadata. Decimal/scientific notation is allowed.

Drafts and observations live in a separate app-mounted session store. Case keys
include design ID/version and load location/vector. Drafts survive navigation but
do not follow the user into another case. A changed measured joint clears raw
values and resolution; unit changes explicitly reinterpret draft values. Reload
clears everything. Existing solver, cost engine and experimental state are unchanged.

The pure assessment compares the stored original/braced vertical change at the
measured joint with instrument resolution and repeat range, after conversion to
mm. A zero/unresolvable predicted change is inconclusive. Unknown resolution,
sparse repeats or apparently fine resolution never establish agreement. Even the
best screening outcome is **model agreement unassessed**; systematic errors and
matched physical tests still need review. No synthetic observations populate the app.

A new report includes only observations matching its saved original/chosen design
and explicitly included retest. Other records remain in the session, with their
excluded count shown. Report construction checks association/mean/units and derives
assessment again, rejecting a forged resolved claim as evidence. The snapshot
freezes raw values, resolution, method, conditions and assessment. Removing a
session reading or choosing another trial does not change an existing report.
Long evidence is retained; the existing one-page guard blocks an overfull print
while the complete JSON remains downloadable. JSON import is not implemented.

## 7.2 — Separate assembly output

Original and Braced assembly template actions capture the selected trial's stored
undeformed geometry. The builder freezes the fixed 240 × 40 mm panel, calculates
member lengths and identifies interior crossings without introducing joints.
The SVG is 254 × 100 mm with viewBox `0 0 254 100`: one unit is one mm. It includes
labeled nodes, added-brace styling, an interrupted unconnected crossing and a
dimensioned 100 mm calibration bar. The surrounding sheet lists all member pairs
and center-to-center lengths. Joint overlaps and cut lengths are separate decisions.

The downloadable SVG uses the same drawing and physical dimensions. Printing uses
a separate named **Letter landscape** page with 10 mm margins. It never extends
the portrait decision sheet. The paper preview scrolls horizontally on small
screens rather than scaling the drawing. A size guard disables printing when the
sheet exceeds its allowance; it never shrinks the geometry to make it fit.

## Verification and practical limits

- `npm run check`: 202 application tests across 20 files and six in-memory release
  checks, strict TypeScript and production build. Coverage includes numeric parsing,
  unit/sign handling, raw-mean consistency, case/retest exclusion, uncertainty
  screening, forged assessment, frozen reports, no extra solver calls, SVG geometry,
  physical units, crossings and overflow behavior.
- Production preview: synthetic QA-only reading saved with its method/conditions;
  coarse resolution and repeat spread produced an inconclusive assessment. A frozen
  report retained the correct saved B1 case without the active B2 retest. Its screen
  paper measured 720 × 943 px and passed the existing print preflight.
- Updated braced template measured 960 × 718 px, within the 194 mm screen height
  allowance; the SVG stayed 960 × 377.945 px (254 × 100 mm at CSS scale).
- At 375 px viewport width, both new views kept page width at 375 px; the template's
  960 px paper scrolled inside its 335 px container. Blank measurement submission
  showed errors and did not create a reading. Test observations were cleared afterward.
- The browser's SVG download was inspected as XML: 254 mm × 100 mm, matching
  viewBox, 18 members and a 100-unit check bar. This verifies file units, not a printer.
- `npm run prepare:report-qa` now prepares four HTML/JSON cases, including an
  explicitly synthetic measurement case. They are manual browser-print inputs,
  never production observations or proof of native pagination.
- `npm run release:prepare` reruns checks, benchmarks and local-asset audit before
  creating a fresh candidate. The bundle includes `PHYSICAL-CHECKLIST.md`.

See [RC hardening](rc-hardening.md) for later host checks: 212 application tests,
actual launcher/CSP flow, and visually inspected Letter/Letter-landscape PDFs.
The native print-dialog check remains with the user. No physical printer/ruler calibration,
actual measurement campaign, target-laptop offline test, outside-tester acceptance
or timed rehearsal has been certified. Actual launcher socket testing now passes on this development host; repeating
it on the presentation laptop remains in the release checklist.
Use the [physical checklist](physical-checklist.md) if demonstrating optional work;
omit that demonstration if it is not validated. The core release still needs its
Phase 6 acceptance and a new clean committed candidate before final freeze.

No dependencies, lockfile, domain record shapes or numerical fixture values changed.
New pure modules live in `community/measurements/engine.ts` and
`community/template/pattern.ts`; integration owns App/report wiring and release
packaging. The preexisting `resolved` enum remains compatible, but the new flow
never emits it automatically.
