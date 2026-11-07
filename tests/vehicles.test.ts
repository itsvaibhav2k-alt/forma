import { describe, expect, it } from 'vitest';
import { JUDGE_PRESET } from '../src/shared';
import { simulateVehicleAtPosition, simulateVehiclePass, type Vehicle } from '../src/vehicles';

const deck = ['b0', 'b1', 'b2', 'b3', 'b4'];
const vehicle: Vehicle = {
  id: 'demo-car', label: 'Two-axle demo vehicle',
  axles: [{ offsetMm: -25, loadN: 1 }, { offsetMm: 25, loadN: 1 }],
};

describe('quasi-static vehicle loads', () => {
  it('distributes both axles without losing vertical load', () => {
    const result = simulateVehicleAtPosition(JUDGE_PRESET.design, deck, vehicle, 120);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('Expected a valid vehicle position');
    expect(result.nodalLoads.reduce((total, load) => total + load.fyN, 0)).toBeCloseTo(-2, 12);
    expect(Object.values(result.analysis.reactionsN).reduce((total, reaction) => total + reaction.y, 0)).toBeCloseTo(2, 10);
    expect(result.axlePositionsMm).toEqual([95, 145]);
  });

  it('reports signed stress as force divided by member area', () => {
    const result = simulateVehicleAtPosition(JUDGE_PRESET.design, deck, vehicle, 120);
    if (result.status !== 'ok') throw new Error('Expected a valid vehicle position');
    for (const member of JUDGE_PRESET.design.members) {
      const stress = result.memberStresses[member.id]!;
      const stock = JUDGE_PRESET.design.stocks.find(({ id }) => id === member.stockId)!;
      expect(stress.stressNPerMm2).toBeCloseTo(stress.forceN / stock.areaMm2, 12);
    }
    expect(Math.abs(result.criticalMember.stressNPerMm2)).toBeGreaterThan(0);
  });

  it('samples a full pass and identifies its worst frame deterministically', () => {
    const result = simulateVehiclePass(JUDGE_PRESET.design, deck, vehicle, 21);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('Expected a valid vehicle pass');
    expect(result.frames).toHaveLength(21);
    expect(result.frames[0]!.axlePositionsMm[0]).toBe(0);
    expect(result.frames.at(-1)!.axlePositionsMm[1]).toBe(240);
    const maximum = Math.max(...result.frames.map(({ criticalMember }) => Math.abs(criticalMember.stressNPerMm2)));
    expect(Math.abs(result.worst.criticalMember.stressNPerMm2)).toBeCloseTo(maximum, 12);
    expect(result.worst).toBe(result.frames[result.worstFrameIndex]);
  });

  it('rejects off-bridge axles and invalid vehicle data without performance output', () => {
    expect(simulateVehicleAtPosition(JUDGE_PRESET.design, deck, vehicle, 10)).toMatchObject({ status: 'invalid' });
    expect(simulateVehicleAtPosition(JUDGE_PRESET.design, deck, { ...vehicle, axles: [] }, 120)).toMatchObject({ status: 'invalid' });
    expect(simulateVehiclePass(JUDGE_PRESET.design, deck, vehicle, 1)).toMatchObject({ status: 'invalid' });
  });
});
