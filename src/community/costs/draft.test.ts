import { expect, it } from 'vitest';
import { blankQuoteDraft, editAmount, fictionalQuoteDraft, parseNumber, quoteInputsFromDraft } from './draft';
import { compareQuotes } from './engine/compareQuotes';

it('distinguishes blank, zero and malformed text without silently truncating input', () => {
  const blank = blankQuoteDraft();
  expect(quoteInputsFromDraft(blank).packages[0].materials).toMatchObject({ status: 'unknown' });
  const demo = fictionalQuoteDraft();
  const setRaw = (raw: string) => quoteInputsFromDraft({ ...demo, packages: [{ ...demo.packages[0], amounts: { ...demo.packages[0].amounts, materials: { ...demo.packages[0].amounts.materials, raw } } }, demo.packages[1]] });
  expect(setRaw('0').packages[0].materials).toMatchObject({ status: 'known', usd: 0 });
  expect(setRaw('  ').packages[0].materials.status).toBe('unknown');
  for (const raw of ['-', '1e', '12 dollars', '0x20', '1,000']) expect(compareQuotes(setRaw(raw)).status).toBe('error');
  expect(parseNumber('1.25e3')).toBe(1250);
  expect(quoteInputsFromDraft(demo).realRate).toBe(0.03);
});

it('seeds only labeled fictional inputs and converts edited demo values into user estimates', () => {
  const draft = fictionalQuoteDraft();
  const value = draft.packages[0].amounts.materials;
  expect(value.sourceKind).toBe('demo-assumption');
  expect(editAmount(value, '11000')).toMatchObject({ raw: '11000', sourceKind: 'user-estimate' });
  expect(value.raw).toBe('12000');
  expect(compareQuotes(quoteInputsFromDraft(draft)).status).toBe('ok');
});
