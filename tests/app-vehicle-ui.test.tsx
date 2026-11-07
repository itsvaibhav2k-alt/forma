// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

afterEach(cleanup);

describe('vehicle stress lab UI', () => {
  it('exposes the live bridge, vehicle controls, stress results and model limitation', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Drive a vehicle across the bridge' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /bridge members colored/i })).toBeTruthy();
    expect(screen.getByRole('slider', { name: /vehicle center position/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /drive vehicle/i })).toBeTruthy();
    expect(screen.getByText(/worst sampled position/i)).toBeTruthy();
    expect(screen.getByText(/not a load-capacity certification/i)).toBeTruthy();
  });

  it('recalculates when the user changes vehicle load and bridge design', async () => {
    const user = userEvent.setup();
    render(<App />);
    const load = screen.getByRole('spinbutton', { name: /total vehicle load/i });
    await user.clear(load);
    await user.type(load, '4');
    expect((load as HTMLInputElement).value).toBe('4');
    const design = screen.getByRole('combobox', { name: /bridge design/i });
    await user.selectOptions(design, 'panel-2');
    expect((design as HTMLSelectElement).value).toBe('panel-2');
    expect(screen.getAllByText(/MPa/).length).toBeGreaterThan(2);
  });
});
