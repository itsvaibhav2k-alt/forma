# Phase 1.1 — First-release decisions

Status: adopted for this implementation; engine integration is documented in
[the combined handoff](main-engine-integration.md). These are engineering decisions from the
agreed plan, not claims that all four human owners have reviewed or been assigned.

## Product scope

Forma asks where **one extra brace** should go on a prescribed bridge. A judge
selects a load position and panel, commits before the ranking is visible, then
moves the load while keeping the brace. The original saved result remains available.

The technical specification controls exact geometry, signs, constants, state
behavior, and test values. The build plan controls delivery priorities. Where the
build plan mentions storing load magnitude, the stricter technical specification
wins: the judging load remains **10 N downward**. The generic solver still accepts
a 1 N load for the independent triangle test.

## Locked configuration

| Decision | Value |
| --- | --- |
| Runtime | React + TypeScript, built with Vite; locally served in a browser |
| Calculation | Pure TypeScript functions; synchronous first implementation |
| Geometry | Four 60 mm bays, 40 mm height; ten labeled nodes |
| Nodes | B0–B4 at y=0, T0–T4 at y=40; x=60i |
| Baseline | 17 members, including four preset diagonals |
| Supports | B0 restrains x/y; B4 restrains y and permits x |
| Coordinates | Positive y upward; geometry and displacement in mm |
| Load UI | B1, B2, or B3; fx=0 N and fy=-10 N |
| Stock | E=10,000 N/mm²; A=10 mm²; illustrative demo constants |
| Candidate allowance | Add exactly one opposite diagonal, independently, to the original |
| Crossings | Only labeled nodes are joints; crossing bars are unconnected |
| Forces | N; positive axial force is tension, negative is compression |
| Ranking | Minimum absolute vertical displacement at the loaded joint |
| Ties | Full precision; tolerance max(1e-9 mm, 1e-8 × best displacement), from main |
| Zero baseline | Absolute change only at baseline ≤1e-12 mm, from main |
| History | Immutable session snapshots; no persistence across reloads |
| Printing | Frozen selected-trial payload; one US Letter page |
| Assets | Bundled local assets or system fonts; no required CDN/API |

Baseline diagonals: B0–T1, B1–T2, T2–B3, T3–B4.
Candidates: P1=T0–B1, P2=T1–B2, P3=B2–T3, P4=B3–T4.

## Independent package comparison

Prices are USD and each amount carries a source/status. A blank price is unknown;
an explicitly entered zero is known. Quote packages represent equal scope and
service over the chosen horizon. Record material donations at actual purchase
cost and explain them in a note; never subtract the donation twice.

Initial costs are materials + freight + installation. Cash contributions are
nonnegative. Main’s engine caps the applied contribution at those costs; excess
is not a credit against upkeep. Upfront cost subtracts the applied contribution.
Budget describes available upfront cash and changes only the funding gap.

The horizon is a positive integer number of years. The real discount rate is a
nonnegative finite decimal (0.03 = 3%). Annual real upkeep is constant and paid at
year end. At zero rate, the annuity factor is the number of years. Replacement
costs and residual values are outside this first-release formula; the report must
state scope and assumptions rather than claim a universally cheapest option.

Compute an output only when its dependencies are known. Upfront affordability can
remain known when upkeep is missing. Quote inputs never alter the structural
preset, loads, saved trials, or rankings.

## Required versus deferred

Required in the complete release: commit/reveal, same-brace retest, history
retrieval, tied rankings, keyboard controls, explicit failures, editable costs,
selected-trial report, and the offline manual release check.

Deferred: freeform geometry, load-magnitude slider, accounts/backend, durable
history, Rust/Wasm, dynamic simulation, 3D, buckling/failure-load prediction, and
model-generated narration. Measurements and a separate assembly template are
optional. Drop narration, template, then live measurements if time is short.

## Language decision

The bridge has 20 displacement variables minus three restraints: 17 free
variables. One complete ranking needs five small solves. Start in TypeScript and
benchmark the implemented engine; a Rust port is not a Phase 1 requirement.
TypeScript type checks do not replace runtime validation of numerical inputs.

The proposed later performance targets are p95 under 8 ms for a warmed five-design
calculation and under 50 ms from a snapped input change to painted results on the
demo laptop. No such benchmark has been run in Phase 1. Numerical correctness and
independent checks take precedence over performance claims.

## Human assignments still needed

The source plan names Vaibhav as integration owner. Assign people to structures,
studio, and community; identify the presentation laptop, browser and available
time. These assignments do not block the foundation files, but should be settled
before simultaneous implementation begins.
