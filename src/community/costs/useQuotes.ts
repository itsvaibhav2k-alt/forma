import { useMemo, useState } from 'react';
import { blankQuoteDraft, quoteInputsFromDraft, type QuoteDraft } from './draft';
import { compareQuotes } from './engine/compareQuotes';

/** Called by App so raw edits survive navigation, independently of experiment state. */
export function useQuotes(initial?: QuoteDraft) {
  const [draft, setDraft] = useState(() => initial ?? blankQuoteDraft());
  const inputs = useMemo(() => quoteInputsFromDraft(draft), [draft]);
  const result = useMemo(() => compareQuotes(inputs), [inputs]);
  return { draft, setDraft, inputs, result };
}
