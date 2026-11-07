import { useState } from 'react';
import type { Reading } from '../../shared';
import type { MeasurementDraft } from './engine';

export function useMeasurements() {
  const [readings, setReadings] = useState<readonly Reading[]>([]);
  const [drafts, setDrafts] = useState<Readonly<Record<string, MeasurementDraft>>>({});
  const [selectedKey, setSelectedKey] = useState('');
  return { readings, drafts, selectedKey, setSelectedKey,
    setDraft: (key: string, draft: MeasurementDraft) => setDrafts(current => ({ ...current, [key]: draft })),
    addReading: (reading: Reading) => setReadings(current => [...current, reading]),
    removeReading: (id: string) => setReadings(current => current.filter(reading => reading.id !== id)),
  };
}
