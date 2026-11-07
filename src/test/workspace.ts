import { physicalCases } from './physical-cases';
import { fictionalQuoteDraft, quoteInputsFromDraft } from '../community/costs/draft';
import { compareQuotes } from '../community/costs';
import { buildDecisionSheet } from '../community/report';
import { buildAssemblyPattern } from '../community/template/pattern';
import { measurementCases, recordMeasurement } from '../community/measurements';
import type { Workspace } from '../projects/workspace';

export function savedWorkspace(): Workspace {
  const { trial, retest } = physicalCases(), quotes = fictionalQuoteDraft(), inputs = quoteInputsFromDraft(quotes);
  const recorded = recordMeasurement({ measuredNodeId: 'B1', units: 'mm', raw: '0.04\n0.041\n0.039', resolution: '0.01', method: 'Synthetic test', notes: 'No physical test performed.' }, measurementCases(trial)[1]!, 'saved-reading');
  if (recorded.status !== 'ok') throw new Error('Invalid test setup.');
  const readings = [recorded.reading];
  return { schemaVersion: 1, experiment: { round: { phase: 'revealed', roundId: trial.roundId, trialId: trial.id }, trials: [trial], selectedTrialId: trial.id, inspectedTrialId: null, retest: { status: 'ready', value: retest } }, quotes,
    measurements: { readings, drafts: {}, selectedKey: '' }, includeRetest: true,
    report: buildDecisionSheet({ trial, retest, quotes: inputs, costs: compareQuotes(inputs), readings, assumptions: [] }, 'saved-report', '2026-11-07T20:00:00.000Z'),
    pattern: buildAssemblyPattern(trial, true),
  };
}
