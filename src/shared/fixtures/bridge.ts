import type { Design, LoadNodeId, Member, PanelId } from '../structures';
import { snapshot } from '../snapshot';

/** Independent expected data transcribed from the technical specification, not a preset generator. */
export const bridgeFixture = snapshot({
  source: 'Forma_Technical_Specification.docx / Preset and units; Regression fixtures',
  design: {
    id: 'four-panel-baseline',
    presetVersion: 'forma-four-panel-v1',
    nodes: [
      { id: 'B0', xMm: 0, yMm: 0, restrained: { x: true, y: true } },
      { id: 'B1', xMm: 60, yMm: 0, restrained: { x: false, y: false } },
      { id: 'B2', xMm: 120, yMm: 0, restrained: { x: false, y: false } },
      { id: 'B3', xMm: 180, yMm: 0, restrained: { x: false, y: false } },
      { id: 'B4', xMm: 240, yMm: 0, restrained: { x: false, y: true } },
      { id: 'T0', xMm: 0, yMm: 40, restrained: { x: false, y: false } },
      { id: 'T1', xMm: 60, yMm: 40, restrained: { x: false, y: false } },
      { id: 'T2', xMm: 120, yMm: 40, restrained: { x: false, y: false } },
      { id: 'T3', xMm: 180, yMm: 40, restrained: { x: false, y: false } },
      { id: 'T4', xMm: 240, yMm: 40, restrained: { x: false, y: false } },
    ],
    stocks: [{ id: 'demo-stock', elasticModulusNPerMm2: 10_000, areaMm2: 10 }],
    members: [
      { id: 'bottom-01', startNodeId: 'B0', endNodeId: 'B1', stockId: 'demo-stock' },
      { id: 'bottom-12', startNodeId: 'B1', endNodeId: 'B2', stockId: 'demo-stock' },
      { id: 'bottom-23', startNodeId: 'B2', endNodeId: 'B3', stockId: 'demo-stock' },
      { id: 'bottom-34', startNodeId: 'B3', endNodeId: 'B4', stockId: 'demo-stock' },
      { id: 'top-01', startNodeId: 'T0', endNodeId: 'T1', stockId: 'demo-stock' },
      { id: 'top-12', startNodeId: 'T1', endNodeId: 'T2', stockId: 'demo-stock' },
      { id: 'top-23', startNodeId: 'T2', endNodeId: 'T3', stockId: 'demo-stock' },
      { id: 'top-34', startNodeId: 'T3', endNodeId: 'T4', stockId: 'demo-stock' },
      { id: 'vertical-0', startNodeId: 'B0', endNodeId: 'T0', stockId: 'demo-stock' },
      { id: 'vertical-1', startNodeId: 'B1', endNodeId: 'T1', stockId: 'demo-stock' },
      { id: 'vertical-2', startNodeId: 'B2', endNodeId: 'T2', stockId: 'demo-stock' },
      { id: 'vertical-3', startNodeId: 'B3', endNodeId: 'T3', stockId: 'demo-stock' },
      { id: 'vertical-4', startNodeId: 'B4', endNodeId: 'T4', stockId: 'demo-stock' },
      { id: 'diagonal-1', startNodeId: 'B0', endNodeId: 'T1', stockId: 'demo-stock' },
      { id: 'diagonal-2', startNodeId: 'B1', endNodeId: 'T2', stockId: 'demo-stock' },
      { id: 'diagonal-3', startNodeId: 'T2', endNodeId: 'B3', stockId: 'demo-stock' },
      { id: 'diagonal-4', startNodeId: 'T3', endNodeId: 'B4', stockId: 'demo-stock' },
    ],
  } satisfies Design,
  additions: {
    P1: { id: 'brace-P1', startNodeId: 'T0', endNodeId: 'B1', stockId: 'demo-stock' },
    P2: { id: 'brace-P2', startNodeId: 'T1', endNodeId: 'B2', stockId: 'demo-stock' },
    P3: { id: 'brace-P3', startNodeId: 'B2', endNodeId: 'T3', stockId: 'demo-stock' },
    P4: { id: 'brace-P4', startNodeId: 'B3', endNodeId: 'T4', stockId: 'demo-stock' },
  } satisfies Record<PanelId, Member>,
  downwardDisplacementMm: {
    B1: { baseline: 0.043702, P1: 0.032189, P2: 0.043227, P3: 0.042423, P4: 0.042423 },
    B2: { baseline: 0.069936, P1: 0.064819, P2: 0.062624, P3: 0.062624, P4: 0.064819 },
    B3: { baseline: 0.043702, P1: 0.042423, P2: 0.042423, P3: 0.043227, P4: 0.032189 },
  } satisfies Record<LoadNodeId, Record<'baseline' | PanelId, number>>,
  bestIds: { B1: ['P1'], B2: ['P2', 'P3'], B3: ['P4'] } satisfies Record<LoadNodeId, PanelId[]>,
  verticalReactionsN: { B1: { B0: 7.5, B4: 2.5 }, B2: { B0: 5, B4: 5 }, B3: { B0: 2.5, B4: 7.5 } },
  loadFyN: -10,
  absoluteToleranceMm: 0.000001,
});
