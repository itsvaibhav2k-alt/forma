import { describe, expect, it } from 'vitest';
import { createBraceMember, createBridgePreset } from '../structures';
import { renderV9Assembly, type V9RenderOptions } from './v9Renderer.js';

function options(): V9RenderOptions {
  const baseline = createBridgePreset();
  const nodes = baseline.nodes.map(node => ({ id: node.id, x: node.xMm, y: node.yMm }));
  const brace = createBraceMember('P1');
  return { instanceId: 'test', width: 1000, height: 620, pick: 1, load: 1, lift: true,
    orbit: 0, zoom: 1, panX: 0, panY: 0, detail: false, locked: false,
    solution: { nodes, members: [...baseline.members, brace].map(member => ({
      id: member.id, a: nodes.findIndex(node => node.id === member.startNodeId),
      b: nodes.findIndex(node => node.id === member.endNodeId), extra: member.id === brace.id, force: 0,
    })) }, showLabels: false, showDimensions: false,
  };
}

describe('v9 handoff renderer', () => {
  it('preserves all physical assembly layers and live member identities through a full orbit', () => {
    const input = options();
    const views = [0, 90, 180, 270, 360].map(orbit => renderV9Assembly({ ...input, orbit }));
    for (const view of views) {
      expect(view.svgInner).not.toMatch(/NaN|Infinity|undefined/);
      for (const part of ['front', 'rear', 'floor', 'deck', 'spacer', 'carrier', 'supports', 'brace']) {
        expect(view.svgInner).toContain(`data-forma-part="${part}"`);
      }
      expect(view.svgInner).toContain('data-member="brace-P1"');
      expect(view.svgInner).toContain('data-member="diagonal-1"');
      expect(view.lighting?.faces.length).toBeGreaterThan(100);
    }
    expect(views[0]?.svgInner).not.toEqual(views[1]?.svgInner);
  });

  it('uses the selected brace endpoints for an exploded connection with independently isolatable hardware', () => {
    const result = renderV9Assembly({ ...options(), detail: true });
    expect(result.ariaLabel).toContain('B1, panel 1');
    for (const part of ['cheek', 'brace', 'sleeve', 'washer', 'pin']) {
      expect(result.svgInner).toContain(`data-forma-part="${part}"`);
    }
    expect(result.svgInner).not.toMatch(/NaN|Infinity|undefined/);
    expect(result.lighting).toBeNull();
  });
});
