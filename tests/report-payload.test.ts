
// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAppController } from '../src/app/useAppController';
import { createReportPayload } from '../src/community/reportPayload';

afterEach(cleanup);

describe('ReportPayload adapter', () => {
  it('creates a JSON-serializable finance snapshot', () => {
    const { result } = renderHook(useAppController);

    const payload = createReportPayload(
      result.current.community.model,
    );

    const serialized = JSON.stringify(payload);
    const restored = JSON.parse(serialized);

    expect(restored).toEqual(payload);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.generatedFor).toBe(
      'community-cost-comparison',
    );
    expect(payload.result.status).toBe('ok');
  });

  it('preserves unknown prices and calculated amounts', () => {
    const { result } = renderHook(useAppController);

    const inputs = result.current.community.model.inputs;

    act(() => {
      result.current.community.onInputsChange({
        ...inputs,
        quoteA: {
          ...inputs.quoteA,
          annualUpkeep: {
            amountUSD: null,
            source: {
              kind: 'unknown',
              label: 'Not provided',
            },
          },
        },
      });
    });

    const payload = createReportPayload(
      result.current.community.model,
    );

    expect(payload.inputs.quoteA.annualUpkeep.amountUSD).toBeNull();
    expect(payload.inputs.quoteA.annualUpkeep.source.kind).toBe('unknown');

    expect(payload.result.status).toBe('ok');

    if (payload.result.status !== 'ok') {
      throw new Error('Expected valid financial results');
    }

    expect(payload.result.quoteA.annualUpkeep.status).toBe('unknown');
    expect(JSON.stringify(payload)).toContain('"amountUSD":null');
  });

  it('keeps the snapshot unchanged after finance inputs change', () => {
    const { result } = renderHook(useAppController);

    const payload = createReportPayload(
      result.current.community.model,
    );

    const originalBudget = payload.inputs.budgetUSD;
    const originalLabel = payload.inputs.quoteA.label;
    const originalJSON = JSON.stringify(payload);

    act(() => {
      result.current.community.onInputsChange({
        ...result.current.community.model.inputs,
        budgetUSD: originalBudget + 5000,
        quoteA: {
          ...result.current.community.model.inputs.quoteA,
          label: 'Updated package name',
        },
      });
    });

    expect(payload.inputs.budgetUSD).toBe(originalBudget);
    expect(payload.inputs.quoteA.label).toBe(originalLabel);
    expect(JSON.stringify(payload)).toBe(originalJSON);
  });

  it('preserves source labels in exported inputs', () => {
    const { result } = renderHook(useAppController);

    const payload = createReportPayload(
      result.current.community.model,
    );

    expect(payload.inputs.quoteA.purchase.source).toEqual(
      result.current.community.model.inputs.quoteA.purchase.source,
    );

    expect(payload.inputs.quoteB.annualUpkeep.source).toEqual(
      result.current.community.model.inputs.quoteB.annualUpkeep.source,
    );
  });
});
