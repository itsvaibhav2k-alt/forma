// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { physicalCases } from '../../test/physical-cases';
import { buildAssemblyPattern } from './pattern';
import { AssemblyTemplate } from './AssemblyTemplate';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const { trial } = physicalCases();
describe('actual-size assembly pattern', () => {
  it('uses the real geometry and center-to-center lengths for independent original and braced patterns', () => {
    const original = buildAssemblyPattern(trial, false), braced = buildAssemblyPattern(trial, true);
    expect(original.members).toHaveLength(17); expect(braced.members).toHaveLength(18);
    expect(original.crossings).toHaveLength(0); expect(braced.crossings).toHaveLength(1);
    expect(braced.crossings[0]).toMatchObject({ x: 90, y: 20 });
    expect(braced.spanMm).toBe(240); expect(braced.heightMm).toBe(40);
    expect(braced.members.filter(item => item.group === 'Horizontal members')).toHaveLength(8);
    expect(braced.members.find(item => item.group === 'Added brace')?.lengthMm).toBeCloseTo(Math.sqrt(5200), 12);
    expect(braced.members.filter(item => item.group === 'Vertical members').every(item => item.lengthMm === 40)).toBe(true);
    expect(Object.isFrozen(braced.design.nodes)).toBe(true);
    expect(JSON.parse(JSON.stringify(braced))).toEqual(braced);
    expect(original.design.members).toHaveLength(17);
  });

  it('renders physical SVG units, full span, unconnected crossing and calibration dimensions without deformation', () => {
    const { container } = render(<AssemblyTemplate pattern={buildAssemblyPattern(trial, true)} />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', '254mm'); expect(svg).toHaveAttribute('height', '100mm');
    expect(svg).toHaveAttribute('viewBox', '0 0 254 100');
    const left = container.querySelector('[data-node-id="B0"] circle')!, right = container.querySelector('[data-node-id="B4"] circle')!;
    expect(Number(right.getAttribute('cx')) - Number(left.getAttribute('cx'))).toBe(240);
    const top = container.querySelector('[data-node-id="T0"] circle')!;
    expect(Number(left.getAttribute('cy')) - Number(top.getAttribute('cy'))).toBe(40);
    expect(container.querySelectorAll('[data-member-id]')).toHaveLength(18);
    expect(container.querySelectorAll('[data-crossing="unconnected"]')).toHaveLength(1);
    expect(container.querySelector('[data-check-bar-mm="100"]')).toHaveAttribute('d', 'M7 82 H107 M7 79 V85 M107 79 V85');
    expect(screen.getByRole('article')).toHaveTextContent('72.111');
    expect(screen.getByRole('article')).toHaveTextContent('not cut lengths');
    expect(container.querySelector('.decision-sheet')).toBeNull();
  });

  it('keeps captures immutable and rejects unsupported or broken geometry', () => {
    const mutable = structuredClone(trial) as any;
    const pattern = buildAssemblyPattern(mutable, true), text = JSON.stringify(pattern);
    mutable.results.candidates.P2.design.nodes[0].xMm = -100;
    expect(JSON.stringify(pattern)).toBe(text);
    expect(() => buildAssemblyPattern(mutable, true)).toThrow('fixed');
    const broken = structuredClone(trial) as any;
    broken.results.candidates.P2.design.members[0].endNodeId = 'absent';
    expect(() => buildAssemblyPattern(broken, true)).toThrow('endpoint');
  });

  it('invokes native printing only through the explicit template action', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<AssemblyTemplate pattern={buildAssemblyPattern(trial, false)} />);
    expect(print).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Print assembly template' }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('blocks printing an oversized page without shrinking its millimeter drawing', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(750);
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<AssemblyTemplate pattern={buildAssemblyPattern(trial, true)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Do not shrink to fit');
    expect(screen.getByRole('article').closest('.template-preview')).toHaveAttribute('data-print-fits', 'false');
    expect(screen.getByRole('button', { name: 'Print assembly template' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download 1:1 SVG' })).toBeEnabled();
    expect(screen.getByRole('img')).toHaveAttribute('width', '254mm');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Print assembly template' }));
    expect(print).not.toHaveBeenCalled();
  });
});
