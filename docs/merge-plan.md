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

## Later integration order

1. 2.1 → 2.2 solver → 2.3 ranking.
2. 3.1 → 3.2 reducer/history and fixture-driven views. Integration owns state;
   studio owns view components.
3. 2.3 + 3.2 → 3.3 live prediction and retest.
4. 4.1 → 4.2 cost interface; 4.2 + 3.3 → 4.3 isolation checks.
5. 3.3 + 4.3 → 5.1 report snapshot → 5.2 print → 5.3 export acceptance.
6. Required modules → 6.1 integrated checks → 6.2 offline production check →
   6.3 freeze and rehearsal.

Optional measurements and templates do not block release. Consult the PDF for
their prerequisites and rerun release checks if optional work is merged.

## PR checklist

- Name the subphase and prerequisite commits/PRs.
- List owned files, test evidence, and any assumptions.
- Put shared-type or dependency changes in an integration-owned prerequisite PR.
- Keep fake data out of the production entry graph.
- Update from the integration branch, then run relevant tests and `npm run check`.
- Only integration edits app state, shared fixtures, package files/lockfile, and
  reporting. Numerical fixture corrections require independent evidence.

Suggested branch names: `phase/2.1-preset`, `phase/3.1-studio`, `phase/4.1-costs`.
