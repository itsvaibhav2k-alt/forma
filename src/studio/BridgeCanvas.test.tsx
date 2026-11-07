// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { bridgeFixture } from '../shared/fixtures/bridge';
import { createBridgePreset, rankBraces } from '../structures';
import { BridgeCanvas, snapLoadAtSvgX, type BridgeCanvasProps } from './BridgeCanvas';

afterEach(cleanup);
const props: BridgeCanvasProps = {
  baseline: createBridgePreset(), loadNodeId: 'B1', panelId: 'P2', results: null,
  comparison: 'both', showDeformation: false, showForces: false, locked: false,
  onLoadChange: vi.fn(), onPanelChange: vi.fn(),
};

it.each([[-100, 'B1'], [205, 'B1'], [272.5, 'B1'], [272.51, 'B2'], [340, 'B2'], [407.5, 'B2'], [407.51, 'B3'], [1000, 'B3']])('snaps SVG x=%s to the nearest legal load position %s', (x, expected) => {
  expect(snapLoadAtSvgX(Number(x))).toBe(expected);
});

it('draws every independently specified member and brace with the correct upward-y conversion', () => {
  const { container } = render(<BridgeCanvas {...props} />);
  const expectedMembers = [...bridgeFixture.design.members, bridgeFixture.additions.P2];
  expect(container.querySelectorAll('line')).toHaveLength(18);
  for (const member of expectedMembers) {
    const line = container.querySelector(`[data-member-id="${member.id}"]`)!;
    const start = bridgeFixture.design.nodes.find(node => node.id === member.startNodeId)!;
    const end = bridgeFixture.design.nodes.find(node => node.id === member.endNodeId)!;
    expect(line.getAttribute('x1')).toBe(String(70 + 2.25 * start.xMm));
    expect(line.getAttribute('y1')).toBe(String(190 - 2.25 * start.yMm));
    expect(line.getAttribute('x2')).toBe(String(70 + 2.25 * end.xMm));
    expect(line.getAttribute('y2')).toBe(String(190 - 2.25 * end.yMm));
  }
  expect(container.querySelectorAll('[data-node-id]')).toHaveLength(10);
});

it('magnifies original and chosen displacements by exactly the same factor, leaving geometry fixed', () => {
  const results = rankBraces(props.baseline, { nodeId: 'B1', fxN: 0, fyN: -10 });
  if (results.status === 'error') throw new Error(results.message);
  const { container } = render(<BridgeCanvas {...props} results={results} showDeformation />);
  const original = container.querySelector('[data-overlay="original"] [data-member-id="bottom-01"]')!;
  const modified = container.querySelector('[data-overlay="modified"] [data-member-id="bottom-01"]')!;
  for (const [line, analysis] of [[original, results.baseline.analysis], [modified, results.candidates.P2.analysis]] as const) {
    expect(Number(line.getAttribute('y2'))).toBeCloseTo(190 - 2.25 * 200 * analysis.displacementMmByNode.B1!.y, 12);
    expect(Number(line.getAttribute('x2'))).toBeCloseTo(205 + 2.25 * 200 * analysis.displacementMmByNode.B1!.x, 12);
  }
  expect(container.querySelector('[data-node-id="B1"] circle')).toHaveAttribute('cy', '190');
});


it('selects the same member by pointer and keyboard and exposes live reactions', () => {
  const onSelectMember = vi.fn();
  const results = rankBraces(props.baseline, { nodeId: 'B1', fxN: 0, fyN: -10 });
  if (results.status === 'error') throw new Error(results.message);
  const { container } = render(<BridgeCanvas {...props} results={results} selectedMemberId="bottom-01" onSelectMember={onSelectMember} />);
  const member = screen.getByRole('button', { name: 'Inspect member bottom-01' });
  expect(member).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(member);
  fireEvent.keyDown(member, { key: 'Enter' });
  expect(onSelectMember.mock.calls).toEqual([['bottom-01'], ['bottom-01']]);
  expect(container.querySelector('.support-reactions')).toHaveTextContent('Ry 7.50 N');
});
