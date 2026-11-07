# Phase 3 — Interactive experiment acceptance and handoff

Implemented on `phases`, the independent branch previously named
`feat/codex-phase-1`. No merge with the other agent's main is included. This phase
connects the Phase 2 structural engine to the browser experiment. Costs and report
controls retain explicit later-phase states.

## 3.1 — Bridge and accessible controls

Prerequisite: 1.3; this completed integration also consumes the 2.1 production
preset and brace generator. View files live in `src/studio`.

- Responsive SVG renders all ten labeled joints, 17 original bars, B0 pin and B4
  roller. Selecting a panel previews exactly one prescribed opposite diagonal.
  Crossings do not add nodes. Geometry is checked against independent fixtures.
- The 10 N downward load snaps to B1/B2/B3. Dragging uses inverse SVG screen
  coordinates, so resizing and scrolling do not alter which joint is selected.
  Pointer capture handles movement outside the handle. Pointer movement invokes
  the load callback only when its snapped joint changes.
- Native radio groups support pointer and keyboard selection for loads and panels.
  The focusable SVG load handle supports left/right/up/down arrows and Home/End.
  Native controls provide an alternative to dragging on touch devices.
- Selection has a check mark, outline and brace preview. Focus is visible. Labels,
  supports and geometry remain legible at the tested desktop/mobile widths.
- The preview contains no solver output or rankings; the adapter does not run
  a solve until commit. Historical trials are separately labeled and retained.

## 3.2 — Commit, history and state ownership

Prerequisite: 3.1. Integration owns `src/app/experiment/state.ts`. Studio receives
data and callbacks and owns only display preferences.

`createExperimentState` starts with B1 and no panel. `experimentReducer` handles
new rounds, preview changes, commit/failure, retest/failure and trial selection.
`commitPrediction` verifies legal load/brace, IDs and the preset/solver association
of all results, then deeply clones/freezes the complete trial. Result events are
internal typed messages from a trusted solver port, not an import schema.

Commit is idempotent per round. Duplicate, stale, mismatched and reused-ID events
are ignored. The commit button remains disabled after success; the separate
new-round button cannot accidentally receive the second click of a double-click.

A new round keeps history but clears the selection, retest and active results.
Selecting a saved trial restores its exact stored load, brace and numerical data
without solving again. Navigation to the cost placeholder and back preserves the
experiment because its reducer lives in the app. Reload starts a fresh session.

The original selected trial remains separately visible while a retest is active.
Retests preserve its brace and point to its ID; they never append a new prediction
or overwrite saved data. The selected original plus optional retest are ready for
the Phase 5 report adapter.

## 3.3 — Live solver, overlays and errors

Prerequisites: 2.3 and 3.2. `useExperiment.ts` orchestrates the synchronous solver.
The solver was already available, so no temporary mock runtime was added.

After commit, show original/modified absolute vertical displacement in mm,
reduction, chosen rank, every placement and all tied winners. Rank on unrounded
values with the solver's tolerance, using panel order within displayed ties.
Screen-reader status text announces the load, choice, rank, gain and tied winners.

Both deformation overlays use **200× displacement magnification** and the same
geometry scale. The legend states that factor. Users can show original, modified
or both, and can turn deformation off. Numeric results are never magnified.

Optional force colors are accompanied by tension/compression sign labels and a
complete text table of signed N values, including the added member. Original and
modified reactions appear side by side with x/y directions explained. These are
predictions of the ideal model, not measurements or failure-load estimates.

Any typed analysis failure clears the active ranking, overlays and current force
outputs. An alert names the affected scenario and available IDs. Earlier valid
trials remain available, explicitly labeled as saved originals. Retry reruns the
current scenario; there is no mock or previous-result fallback.

## Verification recorded on 7 November 2026

- `npm run check`: **113 tests in 11 files passed**, strict TypeScript passed, and
  the production Vite build passed. Existing solver, contract and boundary tests
  remain intact.
- Reducer tests cover deep immutability, duplicate commits, stale/mismatched
  events, fixed-brace retests, multi-trial restoration and recovery after errors.
- App integration tests run the real solver for hidden/revealed behavior,
  keyboard controls, double-click commit, preserved navigation state, comparison
  controls and the specified B1/P2 → B2 → saved B1 sequence. Error-path tests inject
  typed failures through the solver port only; production has no failure fixture.
- SVG tests verify the independent member endpoints, nearest-joint boundaries
  and the same displacement factor for both overlays.
- Browser verification uses the locally served production build. Keyboard commit
  of **P2 at B1** produces **1.09%** reduction; moving to **B2** produces **10.46%**
  and a **P2/P3 tie**. Restoring the original returns B1/P2/1.09%. Actual pointer
  dragging moves the load to B3 while retaining P2.
- Desktop was inspected at 1280 × 720; mobile at 375 × 812 and 320 × 812. At both
  mobile widths, document width equals viewport width, including the retest view.
  Radio hit areas cover their entire tiles and decorative check marks do not
  change their accessible names. Final browser
  checks found no captured console warnings or errors.

## Manual acceptance sequence

1. `npm run build` and `npm start`, then open `http://127.0.0.1:4173/`.
2. With the keyboard, choose P2 at B1 and commit. Confirm one saved trial and
   1.09% reduction; repeated commit must not create another trial or round.
3. Move the load to B2 with an arrow key or native control. Confirm retained P2,
   10.46%, both winning panels, and unchanged B1 values in the saved-original card.
4. Drag the arrow to B3; compare original/braced overlays and signed forces.
5. Show the saved result. Confirm B1, P2 and 1.09% return unchanged.
6. Start another prediction. Confirm results hide and a new panel is required.
   Commit another trial, then retrieve the first from history.
7. Switch views and return. Confirm trials persist. Reload and confirm history
   clears, as documented.

## Remaining work

Phase 4 adds independent financial calculations and editable quotes. Phase 5 adds
the selected-trial report and print/export. The complete offline keyboard/print
exercise, fresh outside-tester review and presentation-laptop input-to-paint
measurement remain Phase 6 release gates. This phase makes no new browser latency
claim; the Phase 2 Node benchmark is not a browser interaction measurement.

The adapter is intentionally synchronous. If it later uses workers or promises,
extend retest failure events with source/request IDs before permitting asynchronous
responses, so late failures cannot replace a newly selected scenario.
