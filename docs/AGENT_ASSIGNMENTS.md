# Forma: two-agent build handoff

## Current baseline

This repository contains planning documents only, not an implemented application.
The original product brief is `docs/BUILD_PLAN.md`. Preserve its scope and positioning.
React + TypeScript, SVG, pure TypeScript calculations, browser print. Offline judging flow first.
This allocation does not launch agents. Vaibhav approves implementation and visual direction.

## Ownership

| Owner | Responsibility | Exclusive write scope |
| --- | --- | --- |
| ChatGPT 6 Astra | Foundation, shared contract, solver, financial math, immutable trial engine, final integration | package manifests and lockfile, tooling/config, `src/shared/`, `src/structures/`, `src/community/finance/`, `src/trials/`, app entry/shell, integration tests |
| Claude Fable 5.1 | Judge-facing experience, SVG bridge, quote forms, printable decision sheet | `src/studio/`, `src/community/ui/`, `src/community/export/`, `src/styles/`, component-local tests |
| Vaibhav | Scope, visual acceptance, merge approval, demo and submission | Final decisions |

Astra owns calculations; Claude consumes them. Neither creates duplicate math or types.
Claude owns presentation of the decision sheet; Astra wires its verified data.
One writer per file. No model narration, backend, auth, database or API dependency for the core demo.
Do not rewrite README/positioning, deploy, submit, or push agent work without approval.

## Sequence and isolation

1. Astra creates the React/TypeScript foundation on `feat/astra-engine`, adds build/typecheck/test scripts, and freezes the shared contract with tests and fixture data. The exact API shapes are not implemented yet.
2. Before Claude starts implementing, review and integrate that foundation checkpoint into main. Both lanes start from that same commit. Do not start Claude against invented placeholder contracts.
3. Use `feat/astra-engine` and `feat/claude-experience` in separate clones or worktrees. Different branches in the same working directory are NOT parallel isolation. Create worktrees only when execution is approved. On separate computers, separate clones suffice.
4. Astra implements numerical engines and trial state while Claude implements presentation against frozen types and clearly labeled test fixtures. Unavailable runtime calculations must show an honest pending state, not fabricated results.
5. Astra's engine checkpoint integrates first; Claude's presentation checkpoint follows. Astra alone wires app shell and resolves integration conflicts. Do not merge a lane while it is still writing.
6. Run combined unit, typecheck, build, interaction and print checks. A successful standalone lane is not proof of a working combined demo.

## Shared contract to freeze before parallel work

Astra creates `src/shared/types.ts` and `docs/CONTRACTS.md`, plus deterministic fixtures.
Document exact imports, props and return types for Claude before the split:

- Design: mm coordinates, member endpoint/stock IDs, area in mm², elastic modulus in N/mm², fixed directions, preset version. Point loads in N; x right, y up; downward load negative y.
- `analyze(design, loadCase)`: discriminated success/invalid result; signed axial forces (tension positive), reactions and displacement vectors; unstable/invalid results contain no stale performance values.
- `rankBraces(design, loadCase)`: original baseline plus all four opposite-diagonal interventions, loaded-joint downward displacement, reduction, tied best panel IDs. Numerical tie tolerance on unrounded values. Zero baseline yields absolute change, not division by zero.
- Trial API: commit preset version/load/panel and deep-copy original results into an immutable trial. Keep draft selection and current retest load separate. Moving load retains the committed brace and first trial; a new round hides rankings until commit.
- `compareQuotes(quoteA, quoteB, budget, years, rate)`: independent pure financial model. Upfront cost and funding gap, discounted year-end upkeep, annual break-even. Positive horizon; explicit rate convention and validation; zero-rate annuity factor equals years. Missing prices are unknown, never silently zero. Document donation treatment to avoid double counting.
- View props: `BridgeStudio`, `CompareBuildOptions`, `DecisionSheet`, their callbacks and data-only view models. Astra owns state transitions; Claude owns local presentation/interaction state only. The report uses computed results, not its own recalculation.
- Measurement record: design/preset and intervention ID, load position/magnitude, measured joint, value, units, method and uncertainty/conditions. Empty is “No measurement recorded.”

## Claude Fable 5.1 acceptance

- Fixed preset geometry and supports, accessible load controls snapping to three interior bottom joints, four brace previews.
- Commit before ranking reveal, ties visible, original/modified overlays, same brace retest, first trial retrieval, new-round hidden rankings.
- Deflection mm, force N, tension/compression, deformation magnification and ideal-model limitations explicitly labeled.
- Secondary quote UI with source labels, budget, delivery, installation, donations, upkeep, horizon/rate and unknown states. Fictional packages clearly labeled.
- One-page browser-print decision sheet with what changed, predicted, measured, cost comparison, open assumptions. Optional 1:1 template is separate and deferred.
- Responsive and keyboard-usable. Propose visual direction before substantial styling; the build plan does not establish visual approval.
- Run component tests and build/typecheck once available; report any engine dependency blockers honestly.

## ChatGPT 6 Astra acceptance

- Direct-stiffness planar pin-jointed truss; reject zero-length members, missing references, invalid material/geometry/load inputs and singular systems.
- Analytic triangle, unstable square, four-panel baseline and all opposite diagonal alternatives from the original brief. Unit/sign/reaction checks, symmetry/ties and load-position regressions.
- Cost tests for supplied 3%/0% examples, funding-gap-only budget edits, missing prices, invalid horizon, break-even equality. No coupling between quote edits and structural outputs.
- Deep immutable trial snapshots; retests cannot mutate first prediction or reveal a new round prematurely.
- Integrated commit → reveal → drag/retest → retrieve first result check; quote/horizon changes leave engineering output unchanged.
- Print preview inspected for one-page content and readable sketches. Local offline production build demo exercised; no claim that untested physical measurements validate predictions.

## Cross-review and finish line

After each writer stops, Claude reviews solver units/signs/constraints read-only; Astra reviews UI state provenance and finance presentation read-only. Findings go back to the owning writer. No competing fixes.
Each handoff lists branch/base commit, changed files, exact commands/results, assumptions, blockers and remaining integration steps. Do not call mocked component checks a real solver end-to-end test.
Cut model narration, assembly template and physical measurement capture before core prediction/retest, costs or decision sheet.
The original brief includes timed checkpoints; recheck the actual remaining time rather than treating them as current progress.
