import { describe, expect, it } from 'vitest';
import type { Reading } from '../../shared';
import { physicalCases } from '../../test/physical-cases';
import { assessReading, blankMeasurementDraft, matchesReading, measurementCases, measurementNumber, readingsForCases, recordMeasurement, validateReading } from './engine';

const { trial, retest } = physicalCases();
const cases = measurementCases(trial, retest);
const target = cases[1]!;
const draft = () => ({ ...blankMeasurementDraft(target), raw: '0.040\n0.041\n0.039', resolution: '0.01', method: 'Dial indicator', notes: 'Synthetic test fixture; not a physical observation.' });
function saved(patch = {}) {
  const result = recordMeasurement({ ...draft(), ...patch }, target, 'reading-1');
  if (result.status !== 'ok') throw new Error(result.errors.join(' '));
  return result.reading;
}

describe('case-bound physical readings', () => {
  it('separates original/braced designs and saved/retest loads, deduplicating identical cases', () => {
    expect(cases).toHaveLength(4);
    const reading = saved();
    expect(cases.map(item => matchesReading(reading, item))).toEqual([false, true, false, false]);
    expect(readingsForCases([reading], [cases[0]!, cases[3]!])).toEqual([]);
    expect(measurementCases(trial, { ...retest, load: trial.load, results: trial.results })).toHaveLength(2);
    expect(() => measurementCases(trial, { ...retest, sourceTrialId: 'different' })).toThrow();
    expect(matchesReading({ ...reading, presetVersion: 'other' }, target)).toBe(false);
  });

  it('retains raw units, downward sign, mean, context and frozen copies', () => {
    const input = draft();
    const result = recordMeasurement(input, target, 'saved');
    if (result.status !== 'ok') throw new Error('Expected a reading');
    expect(result.reading.displacement).toBeCloseTo(0.04, 12);
    expect(result.reading.rawReadings).toEqual([0.04, 0.041, 0.039]);
    expect(result.reading.appliedLoad).toEqual(trial.load);
    expect(result.reading.designId).toBe(target.design.id);
    expect(Object.isFrozen(result.reading.rawReadings)).toBe(true);
    input.notes = 'Later edit';
    expect(result.reading.notes).toContain('Synthetic');
    expect(JSON.parse(JSON.stringify(result.reading))).toEqual(result.reading);
    expect(saved({ raw: '-0.04' }).displacement).toBe(-0.04);
    expect(saved({ raw: '0' }).displacement).toBe(0);
  });

  it.each(['', '0.1, 0.2', '0x10', '12 mm', '1e', '1e-999', 'Infinity', 'NaN'])('rejects malformed or missing raw reading %s', raw => {
    expect(recordMeasurement({ ...draft(), raw }, target, 'id').status).toBe('error');
  });

  it('rejects invalid metadata, excessive repeats, nonfinite conversions and inconsistent means', () => {
    for (const patch of [{ resolution: '0' }, { resolution: '-1' }, { resolution: 'NaN' }, { method: '' }, { notes: '' }, { measuredNodeId: 'missing' }, { raw: Array(21).fill('1').join('\n') }, { raw: '1e308', units: 'in' as const }]) {
      expect(recordMeasurement({ ...draft(), ...patch }, target, 'id').status).toBe('error');
    }
    expect(validateReading({ ...saved(), displacement: 99 }, target)).toContain('Recorded displacement must equal the mean of the raw readings.');
    expect(Number.isNaN(measurementNumber('1e-999'))).toBe(true);
    expect(measurementNumber('0e-999')).toBe(0);
  });

  it('compares resolution and repeat spread in mm without rewriting the captured unit', () => {
    for (const [units, scale] of [['mm', 1], ['cm', 10], ['in', 25.4]] as const) {
      const reading = saved({ units, resolution: String(0.01 / scale), raw: [0.04, 0.041, 0.039].map(value => value / scale).join('\n') });
      const assessment = assessReading(reading, target);
      expect(assessment.resolutionMm).toBeCloseTo(0.01, 12);
      expect(assessment.spreadMm).toBeCloseTo(0.002, 12);
      expect(assessment.status).toBe('inconclusive');
      expect(reading.units).toBe(units);
      expect(assessment.changeMm).toBeCloseTo(0.000475, 6);
    }
  });

  it('flags coarse resolution, excessive repeat spread and zero predicted changes', () => {
    expect(assessReading(saved(), target).reasons.join(' ')).toMatch(/resolution.*Repeat spread/);
    const atSupport = saved({ measuredNodeId: 'B0', raw: '0\n0\n0' });
    expect(assessReading(atSupport, target).status).toBe('inconclusive');
    const preciseButScattered = saved({ resolution: '0.000001', raw: '0.01\n0.1\n0.02' });
    expect(assessReading(preciseButScattered, target).reasons.join(' ')).toContain('Repeat spread');
  });

  it('never declares agreement merely from fine resolution and small repeat spread', () => {
    const goodInstrument = saved({ resolution: '0.00001', raw: '0.04000\n0.04001\n0.04000' });
    expect(assessReading(goodInstrument, target)).toMatchObject({ status: 'unassessed' });
    expect(assessReading(goodInstrument, target).reasons.join(' ')).toContain('matched physical tests');
    expect(assessReading(saved({ resolution: '', raw: '0.04' }), target).reasons.join(' ')).toMatch(/unknown.*Fewer than three/);
    const forged: Reading = { ...goodInstrument, assessment: 'resolved' };
    expect(assessReading(forged, target).status).toBe('unassessed');
  });
});
