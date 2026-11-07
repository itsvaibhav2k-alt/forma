// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { createBridgePreset, rankBraces } from '../structures';
import { Results } from './Results';
import { formatChange, formatForce, formatMm } from './format';

afterEach(cleanup);

it('distinguishes zero, missing, nonfinite and absent member forces', async () => {
  expect(formatForce(0)).toBe('0.000 N · zero');
  expect(formatForce(-1e-12)).toBe('0.000 N · zero');
  expect(formatForce(undefined)).toBe('Unknown');
  expect(formatForce(NaN)).toBe('Unknown');
  expect(formatForce(Infinity)).toBe('Unknown');
  expect(formatMm(NaN)).toBe('Unknown');
  expect(formatChange({ kind: 'relative', reductionPercent: NaN, reductionMm: 0 })).toBe('Unknown');
  const result = rankBraces(createBridgePreset(), { nodeId: 'B1', fxN: 0, fyN: -10 });
  if (result.status !== 'ok') throw new Error(result.message);
  const changed = structuredClone(result);
  const member = changed.baseline.design.members[0]!;
  Reflect.deleteProperty(changed.baseline.analysis.axialForceNByMember, member.id);
  Reflect.set(changed.candidates.P2.analysis.axialForceNByMember, member.id, 0);
  Reflect.deleteProperty(changed.candidates.P2.analysis.reactionNByNode, 'B0');
  render(<Results results={changed} panelId="P2" isRetest={false} />);
  const user = userEvent.setup();
  await user.click(screen.getByText('All placements, member forces and reactions'));
  await user.click(screen.getByText('Member forces and support reactions'));
  const forces = screen.getByRole('table', { name: 'Axial member forces for load B1' });
  expect(within(forces).getByText('Unknown')).toBeVisible();
  expect(within(forces).getByText('Not present')).toBeVisible();
  expect(within(forces).getAllByText('0.000 N · zero').length).toBeGreaterThan(0);
  expect(screen.getByText('Unknown, Unknown')).toBeVisible();
});
