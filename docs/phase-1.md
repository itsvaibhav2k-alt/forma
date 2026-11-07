# Phase 1 acceptance record

Phase 1 establishes a runnable, typed foundation. It does not claim that later
solver, financial, interaction, or release acceptance criteria have passed.

## 1.1 — Scope and decisions

- [x] Technical specification takes precedence for exact behavior and constants.
- [x] Fixed 10 N load and three legal UI positions are documented.
- [x] Geometry, supports, units, force signs, and tie policy are fixed.
- [x] Financial assumptions and unknown-versus-zero behavior are documented.
- [x] Required and optional work, owner boundaries, and exclusions are explicit.
- [ ] Human names, demo laptop/browser, and remaining schedule to be assigned by team.

## 1.2 — Shared contracts

- [x] Design, loads, analysis/errors, ranking, trial and retest contracts.
- [x] Quote/source/unknown inputs, partial financial outputs and validation errors.
- [x] Measurement and immutable report payload contracts.
- [x] Future reducer events and invariants; separate experiment/community state.
- [x] Shared function ports, with no fake-success implementations.
- [x] Deep-clone/freeze helper and isolation checks for plain contract data.
- [x] Strict TypeScript and negative readonly checks.

## 1.3 — App, fixtures and checks

- [x] React/TypeScript entry point, Vite development and production scripts.
- [x] Local assets/system fonts and explicit shell-only unavailable states.
- [x] Navigation between experiment and package-comparison placeholders.
- [x] Full bridge reference matrix, analytic triangle, failure inputs, quote examples.
- [x] Immutable summary-only mock trial with limitations documented.
- [x] Module directories and port imports using the same shared contracts.
- [x] Vitest and React Testing Library configured.
- [x] Fixture integrity, snapshot, contract, boundary, and navigation tests.
- [x] Local Git repository initialized; Phase 1 snapshot prepared on
  `feat/codex-phase-1` with independent history from the shared repository's main.

## Verification commands

Run `npm run check` to execute tests, strict TypeScript checking and production
build. Tests protect the Phase 1 deliverables rather than asserting that an absent
solver returns the fixture values.

Run `npm run dev` to inspect both shell views. The future commit and report buttons
must be disabled; neither view should display computed results or sample prices.
Check desktop and narrow widths, focus visibility, and keyboard navigation.

After `npm run build`, run `npm start` to serve `dist` on 127.0.0.1:4173. Verify
the shell loads from local assets. The complete disconnect/reload/judging/printing
exercise remains a Phase 6 gate after those capabilities exist.

### Recorded verification on 7 November 2026

- `npm run check`: **15 tests passed across 5 files**, strict TypeScript passed,
  and Vite production build passed.
- Dependency installation reported **0 vulnerabilities** in its audit at install
  time. This is not a guarantee against future advisories.
- Development server returned HTTP 200; both views were inspected in the browser.
- Desktop breakpoint inspected at 1280 × 900; mobile views inspected at 375 × 812.
  Both mobile views reported content width equal to viewport width (375 px).
- Keyboard activation switched between views; disabled future controls and empty
  states were visible. No browser console warnings or errors were observed.
- `npm start` successfully served the production build. The production browser
  loaded its script and stylesheet locally and rendered the expected shell.
- The output bundle contained none of the checked mock-trial marker or reference
  displacement/quote values. The source boundary test also passed.
- Test servers were stopped after verification. Start a fresh preview with the
  commands in the README.

This verifies the Phase 1 shell and contracts. No solver, financial calculation,
real trial reducer, disconnect test, or printed application report was validated.

## Ready for the next phase

Technical prerequisites for 2.1, 3.1, and 4.1 are present. Remaining team actions
are human assignment, review of decisions/interfaces, and agreement on the common
integration base before concurrent branches are opened. The separate Phase 1
snapshot does not resolve differences with the engines on the GitHub main branch.
