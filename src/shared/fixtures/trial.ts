import type { Analysis, BraceCandidate, PanelId, Trial } from '../structures';
import { snapshot } from '../snapshot';
import { bridgeFixture } from './bridge';

const row = bridgeFixture.downwardDisplacementMm.B1;
const solverVersion = 'fixture-summary-only-not-a-solver';

// These maps are deliberately empty: the source does not give full displacement/force vectors.
// This mock supports summary/history development only, never force overlays or solver verification.
const summary = (d: number): Analysis => ({
  status: 'ok', solverVersion, loadedJointDisplacementMm: d,
  displacementMmByNode: {}, reactionNByNode: {}, axialForceNByMember: {},
});

const candidate = (panelId: PanelId): BraceCandidate => ({
  panelId,
  design: {
    ...bridgeFixture.design,
    id: `four-panel-${panelId}`,
    members: [...bridgeFixture.design.members, bridgeFixture.additions[panelId]],
  },
  analysis: summary(row[panelId]),
  // Derived only for UI development from rounded reference values, not full-precision ground truth.
  change: { kind: 'relative', reductionMm: row.baseline - row[panelId], reductionPercent: 100 * (row.baseline - row[panelId]) / row.baseline },
});

export const developmentTrialFixture = snapshot({
  fixtureOnly: true,
  source: bridgeFixture.source,
  coverage: 'Summary/history only. Full displacement, reaction and force maps are intentionally absent.',
  trial: {
    id: 'fixture-trial-b1-p2', roundId: 'fixture-round-1',
    presetVersion: 'forma-four-panel-v1', solverVersion,
    load: { nodeId: 'B1', fxN: 0, fyN: -10 }, chosenPanelId: 'P2',
    results: {
      status: 'ok', load: { nodeId: 'B1', fxN: 0, fyN: -10 },
      baseline: { design: bridgeFixture.design, analysis: summary(row.baseline) },
      candidates: { P1: candidate('P1'), P2: candidate('P2'), P3: candidate('P3'), P4: candidate('P4') },
      bestIds: ['P1'],
    },
  } satisfies Trial,
});
