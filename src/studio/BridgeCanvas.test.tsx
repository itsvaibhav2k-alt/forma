// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { bridgeFixture } from '../shared/fixtures/bridge';
import { createBridgePreset, rankBraces } from '../structures';
import { BridgeCanvas, DEFORMATION_SCALE, snapLoadAtSvgX, toPlanarSolution, type BridgeCanvasProps } from './BridgeCanvas';

afterEach(cleanup);
const props: BridgeCanvasProps = {
  baseline: createBridgePreset(), loadNodeId: 'B1', panelId: 'P2', results: null,
  comparison: 'both', showDeformation: false, showForces: false, locked: false,
  onLoadChange: vi.fn(), onPanelChange: vi.fn(),
};

it.each([[-100, 'B1'], [205, 'B1'], [272.5, 'B1'], [272.51, 'B2'], [340, 'B2'], [407.5, 'B2'], [407.51, 'B3'], [1000, 'B3']])('snaps SVG x=%s to the nearest legal load position %s', (x, expected) => {
  expect(snapLoadAtSvgX(Number(x))).toBe(expected);
});

it('adapts canonical geometry and actual solver output without changing units or inventing force data', () => {
  const results = rankBraces(props.baseline, { nodeId: 'B1', fxN: 0, fyN: -10 });
  if (results.status === 'error') throw new Error(results.message);
  const adapted = toPlanarSolution(results.candidates.P2.design, results.candidates.P2.analysis);
  expect(adapted.nodes.map(node => node.id)).toEqual(['B0','B1','B2','B3','B4','T0','T1','T2','T3','T4']);
  for (const node of adapted.nodes) {
    const source = bridgeFixture.design.nodes.find(item => item.id === node.id)!;
    expect([node.x,node.y]).toEqual([source.xMm,source.yMm]);
    expect([node.ux,node.uy]).toEqual([results.candidates.P2.analysis.displacementMmByNode[node.id]!.x,results.candidates.P2.analysis.displacementMmByNode[node.id]!.y]);
  }
  for (const member of adapted.members) {
    const source = results.candidates.P2.design.members.find(item => item.id === member.id)!;
    expect(adapted.nodes[member.a]!.id).toBe(source.startNodeId);
    expect(adapted.nodes[member.b]!.id).toBe(source.endNodeId);
    expect(member.force).toBe(results.candidates.P2.analysis.axialForceNByMember[member.id]);
  }
  expect(adapted.reactions).toEqual(results.candidates.P2.analysis.reactionNByNode);
});

it('uses the verbatim reference projection and actual magnified solver displacement for selectable members', () => {
  const results = rankBraces(props.baseline, { nodeId: 'B1', fxN: 0, fyN: -10 });
  if (results.status === 'error') throw new Error(results.message);
  const { container } = render(<BridgeCanvas {...props} results={results} showDeformation />);
  const line = container.querySelector('[data-member-id="bottom-01"] line')!;
  const scale = (680 - 2 * 51) / 240;
  const displacement = results.candidates.P2.analysis.displacementMmByNode.B1!;
  expect(Number(line.getAttribute('x2'))).toBeCloseTo(340 + (60 + displacement.x * DEFORMATION_SCALE - 120) * scale, 2);
  expect(Number(line.getAttribute('y2'))).toBeCloseTo(285 + (11 - displacement.y * DEFORMATION_SCALE) * scale + 1, 2);
  expect(container.querySelector('svg')).toHaveAttribute('data-structural-plate', 'deformation');
  expect(container.querySelector('[data-planar-grid]')).not.toBeNull();
});

it('selects members by pointer and keyboard and exposes real live reactions', () => {
  const onSelectMember = vi.fn();
  const results = rankBraces(props.baseline, { nodeId: 'B1', fxN: 0, fyN: -10 });
  if (results.status === 'error') throw new Error(results.message);
  const { container } = render(<BridgeCanvas {...props} results={results} showForces selectedMemberId="bottom-01" onSelectMember={onSelectMember} />);
  const member = screen.getByRole('button', { name: 'Inspect member bottom-01' });
  expect(member).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(member); fireEvent.keyDown(member, { key: 'Enter' });
  expect(onSelectMember.mock.calls).toEqual([['bottom-01'], ['bottom-01']]);
  expect(container.querySelector('[data-reaction-joint="B0"]')).toHaveAttribute('data-reaction-n', '7.500000');
  expect(container.querySelector('[data-analysis-trace="forces"]')).not.toBeNull();
});
