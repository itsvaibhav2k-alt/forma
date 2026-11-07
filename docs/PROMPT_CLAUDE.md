# Claude Fable 5.1 handoff

Read `docs/BUILD_PLAN.md` and `docs/AGENT_ASSIGNMENTS.md`. You own the judge-facing UI, SVG bridge, quote forms and print decision sheet. Astra owns all calculations, shared types, trial transitions, app shell and integration.

First deliver a brief implementation and visual-direction proposal for approval; do not implement yet. If `docs/CONTRACTS.md` is missing, the foundation is not ready: report that dependency and do not invent APIs or duplicate a solver.

After approval and the shared foundation checkpoint, work on `feat/claude-experience` in an isolated checkout. Only write `src/studio/`, `src/community/ui/`, `src/community/export/`, `src/styles/` and their component tests. Request package/config changes from Astra.

Build load snapping and accessible keyboard controls, one-brace preview, commit/reveal with ties, original/modified overlays, retesting the same brace and first-trial retrieval. New prediction rounds hide rankings. Use canonical callbacks for state changes and computed data for display. Keep force signs, units and deformation magnification explicit.

Build the secondary same-scope quote UI, visible source/fictional/unknown states and a one-page printable report with the five required sections. No invented physical readings. Use “No measurement recorded” when empty. Optional assembly template comes last, separately.

Do not rewrite product positioning, compute independent numerical results, deploy, submit or push. Commit only when authorized. Test your components, run available build/typecheck gates, and report changed files, actual commands/results and integration dependencies. Do not claim the full demo works against mocked fixtures. After both lanes stop, review Astra's solver units/signs/constraints read-only and send findings to its owner.
