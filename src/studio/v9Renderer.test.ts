import { describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { createBraceMember, createBridgePreset } from '../structures';
import { createV9LightingWorker, renderV9Assembly, type V9RenderOptions } from './v9Renderer.js';

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

it('keeps the lighting worker entry point stable when production minifies the serialized function name', async () => {
  const blobs: Blob[] = [];
  const createURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { blobs.push(blob as Blob); return 'blob:worker-test'; });
  const revokeURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('Worker', class { terminate() {} });
  try {
    createV9LightingWorker();
    const blob = blobs[0];
    if (!blob) throw new Error('Lighting worker source was not created');
    // Production minifiers rename the function declaration returned by toString().
    const source = (await blob.text()).replace('function calcAssemblyStudioPixels(', 'function minified(');
    const messages: unknown[] = [];
    const workerScope: { onmessage?: (event: unknown) => void; postMessage: (message: unknown) => void } = { postMessage: message => messages.push(message) };
    runInNewContext(source, { self: workerScope });
    workerScope.onmessage?.({ data: { requestId: 7, geometry: { width: 10, height: 10, faces: [], origin: [0, 0], axes: [[1, 0], [0, 1], [0, 0]], azimuth: 0, elevation: 0 } } });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ requestId: 7, pixels: { width: 10, height: 10 } });
  } finally {
    createURL.mockRestore(); revokeURL.mockRestore(); vi.unstubAllGlobals();
  }
});
