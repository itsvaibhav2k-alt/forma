import type { Design, LoadCase } from '../structures';
import { snapshot } from '../snapshot';

export const triangleFixture = snapshot({
  source: 'Forma_Technical_Specification.docx / Independent hand checks / Triangle',
  design: {
    id: 'analytic-triangle',
    presetVersion: 'analytic-triangle-v1',
    nodes: [
      { id: 'A', xMm: 0, yMm: 0, restrained: { x: true, y: true } },
      { id: 'B', xMm: 200, yMm: 0, restrained: { x: false, y: true } },
      { id: 'C', xMm: 100, yMm: 100, restrained: { x: false, y: false } },
    ],
    // The source specifies EA = 1,000 N. E=1,000 and A=1 are one equivalent factorization.
    stocks: [{ id: 'triangle-stock', elasticModulusNPerMm2: 1_000, areaMm2: 1 }],
    members: [
      { id: 'AB', startNodeId: 'A', endNodeId: 'B', stockId: 'triangle-stock' },
      { id: 'AC', startNodeId: 'A', endNodeId: 'C', stockId: 'triangle-stock' },
      { id: 'BC', startNodeId: 'B', endNodeId: 'C', stockId: 'triangle-stock' },
    ],
  } satisfies Design,
  load: { nodeId: 'C', fxN: 0, fyN: -1 } satisfies LoadCase,
  expected: {
    reactionNByNode: { A: { x: 0, y: 0.5 }, B: { x: 0, y: 0.5 } },
    axialForceNByMember: { AB: 0.5, AC: -0.7071, BC: -0.7071 },
    apexUyMm: -0.1914,
  },
  relativeTolerance: 0.01,
});
