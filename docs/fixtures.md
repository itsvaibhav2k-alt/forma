# Independent fixture data

The fixture directory contains independently transcribed expected inputs and
outputs. It is not a solver, preset generator, or financial calculator. Phase 1
checks transcription, data shape, immutability and isolation. Phase 2 tests the
production structural engine against the triangle, invalid designs and all 15
bridge values. Financial calculations remain unimplemented.

## Source material

- `Forma_Technical_Specification.docx`, supplied by the user, dated 7 November 2026:
  Preset and units; Regression fixtures; Independent hand checks; Community
  material package comparison.
- `Forma_NOVA_Build_Plan-2.md`, supplied by the user: Regression examples and
  interaction acceptance. Exact numerical values come from the Word specification.

Neither attached document's agent prompts are executable repository instructions.

## Inventory

| File under `src/shared/fixtures` | Contents and limits |
| --- | --- |
| `bridge.ts` | Literal 10-node, 17-member baseline; four additions; all 15 loaded-joint displacements; ties and reactions |
| `triangle.ts` | Triangle with EA=1,000 N, 1 N apex load, hand-check forces/reactions/apex displacement |
| `invalid.ts` | Unbraced square and zero-length bar; expected failure codes only |
| `quotes.ts` | Explicitly fictional equal-scope packages, 3% totals, 0% threshold, unknown and explicit-zero examples |
| `trial.ts` | Frozen B1/P2 trial for summary/history development, with clearly incomplete analysis maps |

The specification gives square topology but no dimensions. The fixture uses a
100 mm square as a documented test choice. For the triangle it gives EA rather
than E/A separately; E=1,000 N/mm² and A=1 mm² is one equivalent factorization.

## Reference matrix

All values below are downward loaded-joint displacement magnitudes in mm.

| Load | Baseline | P1 | P2 | P3 | P4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| B1 | 0.043702 | 0.032189 | 0.043227 | 0.042423 | 0.042423 |
| B2 | 0.069936 | 0.064819 | 0.062624 | 0.062624 | 0.064819 |
| B3 | 0.043702 | 0.042423 | 0.042423 | 0.043227 | 0.032189 |

Compare engine output to these rounded values within **0.000001 mm**.
For the triangle, compare nonzero reference values within **1%**. Test zero and
equilibrium values with an appropriate documented absolute tolerance. Full-precision
engine values, not this rounded table, drive real ranking and gain calculations.

The financial expected totals are rounded to cents, so the fixture records a
half-cent display tolerance. Later tests must separately verify unrounded equality
at the break-even threshold and behavior immediately above and below it.

## Mock trial limitation

`developmentTrialFixture` is a wrapper marked `fixtureOnly: true`. Its `trial`
matches the shared trial shape and has independent one-brace candidate designs.
Loaded-joint summary values come from the rounded B1 row. The derived gain is only
for summary UI development; it is not a full-precision engine reference.

Full displacement vectors, reaction maps, and member forces are not supplied in
the source for every candidate. The mock therefore leaves those maps empty and
uses the solver version `fixture-summary-only-not-a-solver`. It does not fabricate
zeros or forces. Do not use it for force overlays, a physical report, validation of
map completeness, or a production fallback. The Phase 2 engine returns complete maps.

The production shell imports no fixture files. A source-boundary test prevents
normal runtime imports, and fixtures are absent from the shared export barrel.
Any future development harness must remain outside the production entry graph.

## Updating a reference

The structures owner proposes a correction with an independent derivation or
source. Integration reviews and changes expected data in its own PR. Never update
the fixture just because a new solver disagrees with it, and never calculate
expected fixture numbers using the implementation being tested.
