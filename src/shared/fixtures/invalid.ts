import type { Design, LoadCase } from '../structures';
import { snapshot } from '../snapshot';

export const unstableSquareFixture = snapshot({
  source: 'Forma_Technical_Specification.docx / Independent hand checks / Mechanism',
  note: 'The source specifies topology, not size; a 100 mm square is used here.',
  design: {
    id: 'unstable-square',
    presetVersion: 'square-test-v1',
    nodes: [
      { id: 'A', xMm: 0, yMm: 0, restrained: { x: true, y: true } },
      { id: 'B', xMm: 100, yMm: 0, restrained: { x: false, y: true } },
      { id: 'C', xMm: 100, yMm: 100, restrained: { x: false, y: false } },
      { id: 'D', xMm: 0, yMm: 100, restrained: { x: false, y: false } },
    ],
    stocks: [{ id: 'square-stock', elasticModulusNPerMm2: 1_000, areaMm2: 1 }],
    members: [
      { id: 'AB', startNodeId: 'A', endNodeId: 'B', stockId: 'square-stock' },
      { id: 'BC', startNodeId: 'B', endNodeId: 'C', stockId: 'square-stock' },
      { id: 'CD', startNodeId: 'C', endNodeId: 'D', stockId: 'square-stock' },
      { id: 'DA', startNodeId: 'D', endNodeId: 'A', stockId: 'square-stock' },
    ],
  } satisfies Design,
  load: { nodeId: 'C', fxN: 0, fyN: -1 } satisfies LoadCase,
  expectedCode: 'UNSTABLE' as const,
});

export const zeroLengthFixture = snapshot({
  source: 'Forma_Technical_Specification.docx / Independent hand checks / Mechanism',
  design: {
    ...unstableSquareFixture.design,
    id: 'zero-length-bar',
    members: [{ id: 'AA', startNodeId: 'A', endNodeId: 'A', stockId: 'square-stock' }],
  } satisfies Design,
  load: unstableSquareFixture.load,
  expectedCode: 'ZERO_LENGTH_MEMBER' as const,
});
