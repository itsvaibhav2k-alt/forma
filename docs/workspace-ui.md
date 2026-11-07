# Integrated experiment workspace — UI pass

Baseline: `1eac1c6fc233e313198b40e8ebcf758c70b2230d` (main and origin/main).
Branch: `refine/experiment-workspace`.
Dedicated worktree: `/Users/vaibhav/forma-workspace-ui`.
Production preview: <http://127.0.0.1:4191/>. The original packaged preview at
port 4188 was used only for before screenshots.

## Changes

- One viewport with Assembly / Structural representation buttons. Structural is
  the default and retains direct manipulation. Assembly follows the same selected
  load and brace, with explicit read-only instructions and no duplicate view controls.
- Compact experiment heading, viewport, controls and adjacent numerical feedback.
  The controls column sizes to its content. The original colors and renderers remain.
- Hidden-results state before commit; verdict and original/revised displacement and
  reduction after commit. Load changes retest the retained brace. On mobile, the
  initial reveal scrolls its answer into view without moving keyboard focus.
- Structural overlays/comparison, full rankings, forces and model facts use native
  disclosure controls. Visible legends still explain any active overlays.
- History and secondary evidence/report tools remain available below the workspace.
  Saved-trial provenance, read-only inspection, focus return and frozen captures remain.
- Unknown member values are labeled Unknown, absent original brace forces Not present,
  and signed zero force remains zero. Invalid solves still use the existing error path.
- Core controls have at least 44px touch targets at the requested mobile width,
  including the invisible load handle target. Bridge artwork was not redesigned.

No shared/controller contracts, engines, adapters, defaults, report/print components,
package dependencies or state stores changed.

Changed application files: `src/app/App.tsx`, `src/app/styles.css`,
`src/studio/Experiment.tsx`, `ModelView.tsx`, `BridgeCanvas.tsx`, `Results.tsx`,
`format.ts`. Tests: `src/app/App.test.tsx`, `workspace.test.tsx`,
`src/studio/ModelView.test.tsx`, `Results.test.tsx`. This document records the pass.

## Verification

`npm run check` passed: **306 application tests across 28 files, 6 release checks,
typecheck and Vite production build**. `git diff --check` passed.

Actual production-browser verification used Chromium 158.0.8127.18 at port 4191:

- Keyboard select → commit → reveal; P2/B1 yields 1.09%.
- Same-brace B2 retest yields the P2/P3 10.46% tie.
- Assembly/Structural switching preserves draft, committed selection, retest and
  analysis preferences, with exactly one viewport.
- P4/B3 draft → read-only history → return preserves the exact draft and opening
  control focus. Active retest restoration is covered by application tests too.
- New round hides active numbers, ranking and overlays. Pointer load dragging works.
- Progressive disclosure exposes complete rankings, signed member forces and reactions.
- No console/page errors or horizontal overflow at the checked sizes.
- At **1440×900 and 1280×800**, verdict y=609.34 and metrics end at y=774.84,
  with scrollY=0. Baseline verdict started at y=1812.22 at 1440×900.
- At **390×844**, core control targets meet 44×44px; load target is 48×48px.
  Commit brings all three metrics into view (bottom y=799.30).

Report checks verified explicit saved-trial selection, opt-in retest inclusion,
frozen contents after load/cost edits, and unknown upkeep with long labels. Three
report variants each produce one Letter portrait PDF; the separate template produces
one Letter landscape PDF. Rendered pages were visually inspected without clipping.

Evidence and reproduction scripts are local QA artifacts under
[`output/workspace-ui`](../output/workspace-ui/), including `check.log`,
`interaction-qa/results.json`, `report-qa/results.json` and `report-qa/pdf-checks.json`.
`verification.json` records the final source revision and asset hashes.

## Before / after screenshots

| State | Before | After |
| --- | --- | --- |
| Draft, 1440px | [Before](../output/workspace-ui/before-draft-1440.png) | [After](../output/workspace-ui/after-draft-1440.png) |
| Revealed, 1440px | [Before](../output/workspace-ui/before-result-1440.png) | [After](../output/workspace-ui/after-result-1440.png) |
| Mobile draft, 390px | [Before](../output/workspace-ui/before-draft-390.png) | [After](../output/workspace-ui/after-draft-390.png) |
| Mobile revealed, 390px | [Before](../output/workspace-ui/before-result-390.png) | [After](../output/workspace-ui/after-result-390.png) |

Additional captures: [1280px result viewport](../output/workspace-ui/after-result-viewport-1280.png),
[1440px result viewport](../output/workspace-ui/after-result-viewport-1440.png),
[Assembly](../output/workspace-ui/after-assembly-1440.png).

## Limits

Mobile uses a vertical flow and scrolls to the initial reveal. Expanded detail tables
can require scrolling. Assembly remains read-only. Physical-device touch, non-Chromium
browsers, the native OS print dialog and physical printer scale were not verified.
Session-only persistence is unchanged. No merge, push or deployment was performed.
