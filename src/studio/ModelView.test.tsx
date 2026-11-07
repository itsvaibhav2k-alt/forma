// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createBridgePreset, rankBraces } from '../structures';
import { ModelView, toDrawDesign } from './ModelView';

afterEach(cleanup);
const baseline = createBridgePreset();

it('adapts the app design without touching ids, members or supports', () => {
  const design = toDrawDesign(baseline);
  expect(design.nodes.map(node => node.id)).toEqual(baseline.nodes.map(node => node.id));
  expect(design.nodes.find(node => node.id === 'T2')).toMatchObject({ x: 120, y: 40 });
  expect(design.members).toHaveLength(17);
  expect(design.supports).toEqual([{ nodeId: 'B0', fixedX: true, fixedY: true }, { nodeId: 'B4', fixedX: false, fixedY: true }]);
  expect(design.braceOptions.map(option => option.member.id)).toEqual(['brace-P1', 'brace-P2', 'brace-P3', 'brace-P4']);
});

it('keeps assembly read-only before and after reveal and follows the selected panel and load', () => {
  const { container, rerender } = render(<ModelView baseline={baseline} loadNodeId="B1" panelId="P2" results={null} locked={false} />);
  expect(screen.getByRole('img', { name: /Load at B1/ })).toBeInTheDocument();
  expect(container.querySelector('[data-overlay]')).toBeNull();
  expect(screen.queryByRole('slider')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Deflection' })).toBeNull();
  const results = rankBraces(baseline, { nodeId: 'B1', fxN: 0, fyN: -10 });
  if (results.status === 'error') throw new Error(results.message);
  rerender(<ModelView baseline={baseline} loadNodeId="B1" panelId="P2" results={results} locked />);
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.getByText(/Read-only assembly/)).toBeVisible();
  rerender(<ModelView baseline={baseline} loadNodeId="B3" panelId="P4" results={null} locked={false} />);
  expect(screen.getByRole('img', { name: /Load at B3, brace in P4/ })).toBeVisible();
  expect(screen.queryByRole('slider')).toBeNull();
});
