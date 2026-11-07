# Phase 2 — Structural engine acceptance and handoff

Implemented on the existing `feat/codex-phase-1` implementation branch, without
merging the other agent's main. Phase 2 is a pure TypeScript module with no React,
network, persistence or financial dependencies. The app shell is unchanged; the
live experiment and trial history are Phase 3 work.

## 2.1 — Preset and input validation

Prerequisite: Phase 1.3 contracts, fixtures and tooling.

- `createBridgePreset()` generates a fresh, deeply frozen baseline: ten nodes,
  17 bars, four 60 mm bays, 40 mm height, B0 pin and B4 vertical roller.
- Stock is E=10,000 N/mm² and A=10 mm². The four prescribed opposite braces have
  equal length sqrt(5,200) mm. Crossing braces do not introduce joints.
- `validateDesign` rejects invalid IDs, duplicate nodes/stocks/member IDs,
  nonfinite coordinates, invalid restraints, nonpositive/nonfinite stock values,
  unknown stock/endpoints, zero-length bars and duplicate undirected node pairs.
  A different member ID or reversed endpoints cannot evade duplicate detection.
- `validateLoadCase` checks finite force components and an existing loaded node
  after design validation. The general analyzer accepts horizontal, upward and
  zero single-point loads, including loads at restrained nodes.

## 2.2 — Direct stiffness solver

Prerequisite: 2.1. Entry point: `analyze(design, load)`.

Each element contributes `(EA/L) tᵀt`, with `t=[-c,-s,c,s]`, to the global 2D
stiffness matrix. The solver removes the restrained degrees of freedom, solves
for the free displacements, and restores exact zero support displacements.

The reduced matrix is symmetrically equilibrated using the square root of its
diagonal. Partial-pivot Gaussian elimination solves the normalized system without
forming an inverse. A pivot at or below **1e-12 times the largest original
normalized entry** returns `UNSTABLE`. A zero free diagonal also returns
`UNSTABLE`. This conservative near-mechanism policy is not a condition-number
estimate. Nonfinite arithmetic or a stiffness outside representable positive
range returns `NUMERICAL_FAILURE`.

Before success, each free row must satisfy
`abs(Ku-F) <= 1e-9 * max(max(abs(F)), sum(abs(Kij*uj)))` against the original
unscaled stiffness. All displacement, force and reaction outputs must be finite.
This residual check measures equilibrium; it is not a guarantee of small forward
error for arbitrary ill-conditioned input.

Success includes all node displacement vectors, every support's reaction vector,
all member axial forces (positive tension), the absolute vertical loaded-joint
displacement, and solver version `forma-truss-2d-v1`. Reactions use `Ku-F` at
restrained components; unrestrained support components are zero. A fully
restrained design is valid and returns zero displacement with load-balancing
reactions. Errors contain only status, code, message and affected IDs where known.
The solver has no cache or previous-result fallback and does not mutate its input.

Model limits: static, linear-elastic, small-displacement, axial-only, pin-jointed
2D trusses with homogeneous zero prescribed displacements and one point load.
There is no bending, joint compliance, member self-weight, buckling, plasticity,
strength/failure prediction or time simulation. The dense solver is intended for
small educational trusses, not large finite-element meshes.

## 2.3 — Independent candidate ranking

Prerequisite: 2.2. Entry point: `rankBraces(baseline, load)`.

This judging API requires the canonical unbraced preset and exactly 10 N downward
at B1, B2 or B3. It validates geometry, supports, member IDs/topology and stock,
not merely the version label. It accepts different design IDs, array ordering and
reversed member directions. Edited trusses can be analyzed using `analyze` but
are outside the fixed-preset ranking contract.

The baseline and each of four single-brace candidates are solved independently.
Candidate braces never accumulate. Any failed solve returns an error instead of
a partial ranking. The result includes a deep frozen snapshot of all five designs
and analyses and the selected load, independent of later caller mutation.

Rank on unrounded absolute vertical displacement. Include every candidate within
`max(1e-9 mm, 1e-6 * best displacement)` of the best value, in panel order.
Reduction is baseline minus candidate. Percentage reduction uses the nonzero
baseline; the comparison helper returns absolute-only change for zero baseline.
Negative improvements remain negative. Rounded strings never enter the ranking.

Expected winners: **B1 → P1; B2 → P2 and P3; B3 → P4**.

## Integration example

```ts
import { createBridgePreset, rankBraces } from './structures';

const baseline = createBridgePreset();
const result = rankBraces(baseline, { nodeId: 'B2', fxN: 0, fyN: -10 });
if (result.status === 'error') {
  // Phase 3 dispatches a failure that clears the active result.
} else {
  // Phase 3 commits a trial snapshot before revealing result.bestIds.
}
```

Only the Phase 3 orchestration layer should connect this engine to commit/reveal,
trial IDs, same-brace retests and history. No fixture imports or hardcoded output
values belong in runtime modules. Shared contracts and independent fixtures were
not changed to make the solver pass.

## Verification

Run `npm run check` for correctness tests, strict TypeScript and the production
build. Run `npm run bench:structures` separately for performance. The benchmark
loads production modules through Vite in Node, with no listening server, browser,
fixtures or file watching; it excludes module startup time.

Coverage includes the analytic triangle, all 15 independent bridge values within
1e-6 mm, support reactions, member-by-member joint equilibrium, global force and
moment balance, an unbraced square, zero-length bars, a weakly braced near mechanism,
missing restraints, an isolated node, malformed data and floating-point range
failures. Additional checks cover reversed loads, mixed stock, stiffness scaling,
ordering and endpoint invariance, loads at supports, fully restrained geometry,
row pivot exchange, candidate independence, snapshot isolation and tie boundaries.

The triangle is checked against the specification's rounded values within 1% and
the exact virtual-work displacement. Equilibrium assertions use approximately
5e-10 N and 5e-8 N·mm absolute tolerances for these small fixtures. Independent
fixture data remains separate from both production code and benchmark code.

Recorded checks on 7 November 2026:

- `npm run check`: **89 tests passed in nine files**, strict TypeScript passed,
  and the Vite production build passed. This includes all 15 bridge matrix cases
  and the existing Phase 1 contract, fixture, boundary and shell tests.
- `git diff --check`: passed.
- `npm run bench:structures`: Node **v20.20.2**, **darwin/arm64**, 300 warmups,
  3,000 measured rankings, cycling B1/B2/B3. Median **0.421 ms**, p95 **0.694 ms**,
  p99 **0.795 ms**, maximum **1.665 ms**. Each ranking includes validation, all five
  solves, candidate construction, comparison, cloning and freezing.
- The measured p95 is below the proposed **8 ms** calculation target. These are
  local Node measurements, not a guarantee for another machine or a browser.
  The proposed **50 ms input-to-paint** target remains a Phase 3 browser check.

The result supports retaining TypeScript for this workload; there is no measured
calculation bottleneck requiring a Rust/Wasm port at this stage.

## Method references

The element transformation and stiffness assembly follow the conventional
[2D truss direct stiffness formulation](https://mechanics.ju.se/SolidMechanics/SystematicTrussAnalysis.html).
Equilibration and partial pivoting are standard linear-system techniques; see
[LAPACK DGESVX documentation](https://netlib.org/lapack/explore-html/d5/dbe/group__gesvx_ga82173a93234afc15d70b64233b3e5bc8.html).
This small implementation is not LAPACK and does not implement its condition
estimation, iterative refinement or error-bound reporting.
