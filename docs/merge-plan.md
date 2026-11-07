# Ownership and merge order

Each subphase can be reviewed as a separate PR. Prerequisites mean merged and
passing on the integration branch, not merely present on another local branch.
One writer owns each file boundary; collaborators propose shared changes to that
owner rather than editing the same file at once.

## Phase 1 handoff

| Subphase | Prerequisite | Deliverables | Owner |
| --- | --- | --- | --- |
| 1.1 | None | Decisions, units, scope, acceptance checklist | Integration |
| 1.2 | 1.1 | Shared contracts, event definitions, error/unknown states, snapshot utility | Integration |
| 1.3 | 1.2 | App/build setup, independent fixtures, shell, test configuration, module boundaries | Integration; structures reviews references |

The repository was empty before this work. Phase 1 is committed together on
`feat/codex-phase-1` so its contracts and fixture checks can be validated end to
end. This is an independent snapshot with no shared commit ancestry with the
GitHub repository's `main`. It preserves the local implementation without merging
the other agent's engines. Resolve the reviewed contract and preset differences
before selectively integrating the two implementations.

## Phase 2 handoff

Phase 2 is implemented on the existing independent implementation branch. Its
review boundaries are:

| Subphase | Prerequisite | Deliverables | Verification |
| --- | --- | --- | --- |
| 2.1 | 1.3 | `preset.ts`, `validation.ts`, `errors.ts`, preset/validation tests | Canonical geometry and invalid input cases |
| 2.2 | 2.1 | `analyze.ts`, `linear-system.ts`, solver tests, `src/test/structure-assertions.ts` | Triangle, mechanisms, force balance, numerical scaling, pivot exchange |
| 2.3 | 2.2 | `rank-braces.ts`, matrix/ranking tests, structures exports, benchmark script, package command and documentation | 15 values, ties, independent additions, snapshot isolation, timing |

No shared-contract or fixture changes were needed. Merge 2.1 before 2.2, then 2.3;
the final `src/structures/index.ts` exports require all three. The new package
script adds no dependencies. See [Phase 2 acceptance](phase-2.md) before wiring
the engine into Phase 3. This does not reconcile or merge the other agent's main.

## Independent work after Phase 1 acceptance

| Next subphase | Prerequisite | Files owned | Merge evidence |
| --- | --- | --- | --- |
| 2.1 Preset and input validation | 1.3 | `src/structures` | Correct 10-node/17-member baseline and four equal-length additions; invalid-input tests |
| 3.1 SVG and accessible controls | 1.3 | `src/studio` | Fixture-consistent drawing; equivalent pointer/keyboard selection; hidden rankings |
| 4.1 Quote calculation | 1.3 | `src/community/costs` | 3%/0% examples, break-even, unknown/zero, and input validation |

These three can proceed in parallel once people are assigned. The shell remains
integration-owned; expose module components/functions first, then let integration
wire them into the app. A fixture is a test input, not the Phase 2 preset generator.

## Phase 3 handoff

Phase 3 is implemented on `phases`, the renamed independent implementation branch.
The other agent's main has not been merged. The review order is:

| Subphase | Prerequisite | Deliverables | Evidence |
| --- | --- | --- | --- |
| 3.1 | 1.3; 2.1 for production geometry | `BridgeCanvas.tsx`, SVG tests, native panel/load controls and styles | Fixture geometry, snapping boundaries, keyboard and pointer selection |
| 3.2 | 3.1 | `src/app/experiment/state.ts`, reducer tests, saved-trial/history views | Idempotent commit, frozen snapshots, stale-event rejection, restoration and failure isolation |
| 3.3 | 2.3 + 3.2 | `useExperiment.ts`, app wiring, result/overlay views and integration tests | B1/P2 → B2 tie → original restore; common 200× scale; explicit errors |

The live solver was already available, so no temporary mock runtime was needed.
Shared event/type shapes and solver fixtures are unchanged. The shared state file
only updates its ownership comment. No dependency or lockfile change is needed.
`src/studio/index.ts` and the app wiring require the completed 3.1–3.3 components.
See [Phase 3 acceptance](phase-3.md) for verification and remaining release gates.

## Phase 4 handoff

Phase 4 is implemented on `phases`. Review or extract it in this order:

| Subphase | Prerequisite | Deliverables | Evidence |
| --- | --- | --- | --- |
| 4.1 | 1.3 | `costs/engine/validation.ts`, `compareQuotes.ts`, engine tests and pure exports | 3%/0% examples, independent annuity sum, exact/above/below break-even, missing inputs, contributions and numerical limits |
| 4.2 | 4.1 | Draft parser, `useQuotes`, `CostWorkbench`, `CostSummary`, styles and form tests | Unknown versus zero, explicit sources, example relabeling, visible validation and live calculations |
| 4.3 | 3.3 + 4.2 | App wiring, isolation tests, `engine/snapshot.ts` and boundary checks | Financial edits preserve trials/retests; structural actions preserve quotes; frozen JSON-serializable cost snapshots |

An integration-owned prerequisite for the 4.3 snapshot adapter is the type-only
`DeepReadonly` tuple fix in `src/shared/snapshot.ts` and its type assertion test.
It preserves the exact two-package tuple without changing runtime behavior or
domain contract shapes. If splitting PRs, defer the `createCostSnapshot` barrel
export until that prerequisite and its adapter have landed. Boundary tests now
distinguish the pure cost engine from its React forms, while forbidding structural
imports throughout the cost module. No dependency, lockfile or fixture changes.
See [Phase 4 acceptance](phase-4.md) for formulas, checks and the Phase 5 handoff.

## Phase 5 handoff

Phase 5's implementation is complete on `phases`; native browser PDF pagination
and a saved sample PDF remain the user's manual acceptance check. Review order:

| Subphase | Prerequisite | Deliverables | Evidence |
| --- | --- | --- | --- |
| 5.1 | 3.3 + 4.3 | `report/buildDecisionSheet.ts`, builder tests and pure exports | Saved-trial/retest association, financial consistency, readings, deep freezing and serialization |
| 5.2 | 5.1 | `DecisionSheet`, `ReportSketch`, `ReportPreview`, print CSS | Five sections, captured geometry, grayscale signed forces, source labels and overflow protection |
| 5.3 | 5.2 | App capture/navigation, `app/report.test.tsx`, boundary checks, `prepare-report-qa.mjs` and manual checklist | B1 captured while B2 is active; later quote/trial changes preserve the sheet; JSON download; complete/missing/long-label browser checks |

The shared report shape is unchanged (only its documentation comment changed).
No dependencies or lockfile changes. `App` owns the captured payload and explicit
replacement; report presentation owns no experiment/quote state. The existing
cost snapshot helper remains available; this builder also checks the supplied
financial result against a fresh calculation, so stale result/input pairs fail.
See [Phase 5 acceptance](phase-5.md), especially the remaining manual PDF gate,
before declaring the release ready.

## Phase 6 handoff

Release tooling and development-machine verification are prepared on `phases`.
The presentation laptop is a different machine. Human/device acceptance is still
pending, so 6.3 has not declared a release freeze or created a tag.

| Subphase | Prerequisite | Deliverables | Current evidence / remaining gate |
| --- | --- | --- | --- |
| 6.1 | 2.3 + 3.3 + 4.3 + 5.3 | Integrated suite, release audit/launcher tests and performance record | App and in-memory tests pass; development keyboard flow and Node benchmark pass; native PDF, outside tester and target-machine timings pending |
| 6.2 | 6.1 | Portable candidate, hashes, local-only asset audit, dependency-free launcher, instructions | Package integrity checked; actual launcher socket test, target-machine cold start, physical disconnection and offline print pending |
| 6.3 | 6.2 | Fixed-candidate metadata, demo script, checklist and submission/disclosure draft | Final clean commit/archive, two timed rehearsals and human submission details pending |

These supporting files can be reviewed while prerequisite manual gates remain
open. Do not equate preparing the tooling with passing those gates. No new app
features, solver/cost formulas, dependencies or shared contracts are introduced.
Source tests and release-script tests are explicitly separated in the runner.
See [Phase 6 evidence](phase-6.md) and [the acceptance checklist](release-checklist.md).

## Phase 7 handoff

The user authorized optional development on `phases` while Phase 6's manual gates
remain pending. Implementation is ready for review; this does not certify 6.1 or
merge anything into the other agent's `main`.

| Subphase | Prerequisite | Review boundaries | Acceptance |
| --- | --- | --- | --- |
| 7.1 Measurements | 4.3 + 5.1; integrate after 6.1 | Pure measurement engine/tests, session hook/form, report assessment and presentation, then app wiring | Unit/sign/association checks, repeat screening, immutable report capture, no automatic agreement claim |
| 7.2 Assembly pattern | 2.1 + 5.2; integrate after 6.1 | Pure geometry builder/tests, separate SVG/print component/styles, then app capture/navigation | Correct geometry/lengths/crossings, physical units and overflow guard; actual printer ruler check pending |

Review pure modules before their views. Integration owns the shared comment,
report changes, App wiring, boundary/integration tests and release packaging. The
shared data shape, solver, cost engine, fixtures and dependencies are unchanged.
7.1 and 7.2 can be reviewed independently, but their App edits need one integration
owner. Rerun release checks and package a new candidate after either is integrated.
Optional physical validation does not block the core release if the optional
demonstration is omitted. See [Phase 7](phase-7.md) and [physical checks](physical-checklist.md).

## Integration sequence

1. 2.1 → 2.2 solver → 2.3 ranking.
2. 3.1 → 3.2 reducer/history and fixture-driven views. Integration owns state;
   studio owns view components.
3. 2.3 + 3.2 → 3.3 live prediction and retest.
4. 4.1 → 4.2 cost interface; 4.2 + 3.3 → 4.3 isolation checks.
5. 3.3 + 4.3 → 5.1 report snapshot → 5.2 print → 5.3 export acceptance.
6. Required modules → 6.1 integrated checks → 6.2 offline production check →
   6.3 freeze and rehearsal.

7. Optional 7.1 and/or 7.2 after their prerequisites and 6.1; repeat affected release
   checks and rebuild the candidate before final freeze.

## PR checklist

- Name the subphase and prerequisite commits/PRs.
- List owned files, test evidence, and any assumptions.
- Put shared-type or dependency changes in an integration-owned prerequisite PR.
- Keep fake data out of the production entry graph.
- Update from the integration branch, then run relevant tests and `npm run check`.
- Only integration edits app state, shared fixtures, package files/lockfile, and
  reporting. Numerical fixture corrections require independent evidence.

Suggested branch names: `phase/2.1-preset`, `phase/3.1-studio`, `phase/4.1-costs`.
