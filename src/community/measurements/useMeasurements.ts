import { useState } from 'react';
import type { Reading } from '../../shared';
import type { MeasurementDraft } from './engine';

export function useMeasurements(initial?: { readonly readings: readonly Reading[]; readonly drafts: Readonly<Record<string, MeasurementDraft>>; readonly selectedKey: string }) {
  const [readings, setReadings] = useState<readonly Reading[]>(initial?.readings ?? []);
  const [drafts, setDrafts] = useState<Readonly<Record<string, MeasurementDraft>>>(initial?.drafts ?? {});
  const [selectedKey, setSelectedKey] = useState(initial?.selectedKey ?? '');
  return { readings, drafts, selectedKey, setSelectedKey,
    setDraft: (key: string, draft: MeasurementDraft) => setDrafts(current => ({ ...current, [key]: draft })),
    addReading: (reading: Reading) => setReadings(current => [...current, reading]),
    removeReading: (id: string) => setReadings(current => current.filter(reading => reading.id !== id)),
  };
}
