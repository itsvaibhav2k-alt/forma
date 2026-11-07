import { PRESET_DEFAULTS, PRESET_VERSION, type Design, type Member, type PanelId, type TrussNode } from '../shared';
import { snapshot } from '../shared/snapshot';

const STOCK_ID = 'demo-stock';
const ENDPOINTS = {
  P1: ['T0', 'B1'], P2: ['T1', 'B2'], P3: ['B2', 'T3'], P4: ['B3', 'T4'],
} as const satisfies Record<PanelId, readonly [string, string]>;

function member(id: string, startNodeId: string, endNodeId: string): Member {
  return { id, startNodeId, endNodeId, stockId: STOCK_ID };
}

/** Production geometry. Expected data lives separately under shared/fixtures. */
export function createBridgePreset(): Design {
  const { bayCount, bayWidthMm, heightMm, areaMm2, elasticModulusNPerMm2 } = PRESET_DEFAULTS;
  const nodes: TrussNode[] = [];
  const members: Member[] = [];
  for (const chord of ['B', 'T'] as const) {
    for (let station = 0; station <= bayCount; station += 1) {
      nodes.push({
        id: `${chord}${station}`, xMm: station * bayWidthMm, yMm: chord === 'B' ? 0 : heightMm,
        restrained: { x: chord === 'B' && station === 0, y: chord === 'B' && (station === 0 || station === bayCount) },
      });
    }
    for (let bay = 0; bay < bayCount; bay += 1) {
      members.push(member(`${chord === 'B' ? 'bottom' : 'top'}-${bay}${bay + 1}`, `${chord}${bay}`, `${chord}${bay + 1}`));
    }
  }
  for (let station = 0; station <= bayCount; station += 1) {
    members.push(member(`vertical-${station}`, `B${station}`, `T${station}`));
  }
  for (let bay = 0; bay < bayCount; bay += 1) {
    members.push(member(`diagonal-${bay + 1}`, `${bay < 2 ? 'B' : 'T'}${bay}`, `${bay < 2 ? 'T' : 'B'}${bay + 1}`));
  }
  return snapshot({ id: 'four-panel-baseline', presetVersion: PRESET_VERSION, nodes, members, stocks: [{ id: STOCK_ID, areaMm2, elasticModulusNPerMm2 }] });
}

/** Crossings never create extra nodes. Each panel adds this one opposite diagonal. */
export function createBraceMember(panelId: PanelId): Member {
  const [start, end] = ENDPOINTS[panelId];
  return Object.freeze(member(`brace-${panelId}`, start, end));
}
