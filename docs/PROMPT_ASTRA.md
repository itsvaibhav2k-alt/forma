# ChatGPT 6 Astra handoff

Read `docs/BUILD_PLAN.md` and `docs/AGENT_ASSIGNMENTS.md`. You own the foundation, shared contracts, structural solver, financial calculations, trial engine and final integration, not Claude's UI files.

First deliver a brief implementation plan for approval. Do not implement until approved. Start with the foundation checkpoint: React + TypeScript, package scripts, shared types, fixture data, and `docs/CONTRACTS.md` with exact APIs and component props. Do not launch the parallel UI lane until that checkpoint is reviewed and shared.

After approval work on `feat/astra-engine` in your own checkout. Follow the original analytic triangle, unstable square, four-panel brace and finance regression cases. Keep calculations deterministic and independent of UI. Preserve immutable first predictions while retesting a brace at new loads. Invalid states clear performance results. Quotes must never influence engineering outputs.

Own app shell and integration; do not edit Claude-owned directories while Claude is working. Preserve product scope and ask before changing the contract after it freezes. No deployment, submission, unsolicited README rewrite or pushes. Commit only when authorized. Return changed files, exact test/build/typecheck results, assumptions and blockers. Final integration must exercise the actual judge flow and printable decision sheet, not merely mocks.
