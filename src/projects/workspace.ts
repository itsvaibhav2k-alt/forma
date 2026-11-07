import { z } from 'zod';
import type { ExperimentState, Reading, ReportPayload, Trial, Retest } from '../shared';
import { PRESET_VERSION } from '../shared';
import { snapshot } from '../shared/snapshot';
import { SOLVER_VERSION, validateDesign, validateLoadCase } from '../structures';
import type { QuoteDraft } from '../community/costs/draft';
import type { MeasurementDraft } from '../community/measurements/engine';
import { assessReading, measurementCases } from '../community/measurements';
import { validateReading } from '../community/measurements/engine';
import { buildDecisionSheet } from '../community/report';
import { buildAssemblyPattern, type AssemblyPattern } from '../community/template/pattern';

export interface Workspace {
  readonly schemaVersion: 1;
  readonly experiment: ExperimentState;
  readonly quotes: QuoteDraft;
  readonly measurements: {
    readonly readings: readonly Reading[];
    readonly drafts: Readonly<Record<string, MeasurementDraft>>;
    readonly selectedKey: string;
  };
  readonly report: ReportPayload | null;
  readonly pattern: AssemblyPattern | null;
  readonly includeRetest: boolean;
}

/** Stable comparison across JSONB's property ordering; array order remains significant. */
export function workspaceSignature(value: Workspace): string {
  return JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
}

const text = z.string().max(10000), id = z.string().min(1).max(200), n = z.number().finite();
const obj = z.strictObject;
const panel = z.enum(['P1', 'P2', 'P3', 'P4']);
const load = obj({ nodeId: z.enum(['B1', 'B2', 'B3']), fxN: z.literal(0), fyN: z.literal(-10) });
const vector = obj({ x: n, y: n });
// Legacy calculations remain frozen under their original provenance. Only newly
// committed predictions use the current solver; importing never relabels a result.
const solverVersion = z.enum([SOLVER_VERSION, 'forma-truss-2d-v1']);
const boundedRecord = <T extends z.ZodType>(value: T) => z.record(id, value).refine(items => Object.keys(items).length <= 200, 'Too many records.');
const design = obj({ id, presetVersion: z.literal(PRESET_VERSION),
  nodes: z.array(obj({ id, xMm: n, yMm: n, restrained: obj({ x: z.boolean(), y: z.boolean() }) })).length(10),
  members: z.array(obj({ id, startNodeId: id, endNodeId: id, stockId: id })).min(17).max(18),
  stocks: z.array(obj({ id, elasticModulusNPerMm2: n.positive(), areaMm2: n.positive() })).length(1),
});
const analysis = obj({ status: z.literal('ok'), solverVersion, displacementMmByNode: boundedRecord(vector), reactionNByNode: boundedRecord(vector), axialForceNByMember: boundedRecord(n), loadedJointDisplacementMm: n.nonnegative() });
const candidate = obj({ panelId: panel, design, analysis, change: z.discriminatedUnion('kind', [obj({ kind: z.literal('relative'), reductionMm: n, reductionPercent: n }), obj({ kind: z.literal('absolute-only'), reductionMm: n })]) });
const ranking = obj({ status: z.literal('ok'), load, baseline: obj({ design, analysis }), candidates: obj({ P1: candidate, P2: candidate, P3: candidate, P4: candidate }), bestIds: z.array(panel).min(1).max(4) });
const trial = obj({ id, roundId: id, presetVersion: z.literal(PRESET_VERSION), solverVersion, load, chosenPanelId: panel, results: ranking });
const retest = obj({ sourceTrialId: id, load, chosenPanelId: panel, results: ranking });
const failure = obj({ status: z.literal('error'), code: z.enum(['INVALID_INPUT', 'MISSING_ENDPOINT', 'DUPLICATE_MEMBER', 'ZERO_LENGTH_MEMBER', 'INVALID_STOCK', 'UNSTABLE', 'NUMERICAL_FAILURE']), message: text, nodeIds: z.array(id).max(100), memberIds: z.array(id).max(100) });
const amountDraft = obj({ raw: text, sourceKind: z.enum(['supplier-quote', 'user-estimate', 'demo-assumption']), sourceLabel: text });
const packageDraft = obj({ id, label: text, donationNote: text, amounts: obj({ materials: amountDraft, freight: amountDraft, installation: amountDraft, cashContribution: amountDraft, annualUpkeep: amountDraft }) });
const quotesDraft = obj({ packages: z.tuple([packageDraft, packageDraft]), scope: text, budget: text, years: text, ratePercent: text });
const units = z.enum(['mm', 'cm', 'in']);
const reading = obj({ id, designId: id, presetVersion: z.literal(PRESET_VERSION), appliedLoad: load, measuredNodeId: id, displacement: n, units, method: text, instrumentResolution: n.positive().nullable(), rawReadings: z.array(n).max(20), assessment: z.enum(['unassessed', 'inconclusive', 'resolved']), notes: text });
const draft = obj({ measuredNodeId: id, units, raw: text, resolution: text, method: text, notes: text });
const source = obj({ kind: z.enum(['supplier-quote', 'user-estimate', 'demo-assumption']), label: text });
const amount = z.discriminatedUnion('status', [obj({ status: z.literal('known'), usd: n, source }), obj({ status: z.literal('unknown'), note: text })]);
const quote = obj({ id, label: text, scope: text, materials: amount, freight: amount, installation: amount, cashContribution: amount, annualUpkeep: amount, donationNote: text });
const quoteInputs = obj({ packages: z.tuple([quote, quote]), budgetUsd: n, years: n, realRate: n });
const missing = z.array(obj({ packageId: id, field: z.enum(['materials', 'freight', 'installation', 'cashContribution', 'annualUpkeep']) })).max(20);
const calculated = z.discriminatedUnion('status', [obj({ status: z.literal('known'), usd: n }), obj({ status: z.literal('unknown'), missing })]);
const packageCosts = obj({ packageId: id, upfront: calculated, fundingGap: calculated, presentCost: calculated });
const costs = obj({ status: z.literal('ok'), annuityFactor: n, packages: z.tuple([packageCosts, packageCosts]), breakEven: z.discriminatedUnion('status', [
  obj({ status: z.literal('premium'), higherUpfrontPackageId: id, upfrontPremiumUsd: n, requiredAnnualSavingsUsd: n, expectedAnnualSavings: calculated }),
  obj({ status: z.literal('equal-upfront'), requiredAnnualSavingsUsd: z.literal(0) }), obj({ status: z.literal('unknown'), missing }),
]) });
const report = obj({ schemaVersion: z.literal(1), reportId: id, createdAtIso: z.iso.datetime(), trial, retest: retest.nullable(), quotes: quoteInputs, costs, readings: z.array(reading).max(200), assumptions: z.array(text).max(100) });
const pattern = obj({ design, trialId: id, label: text, addedMemberId: id.nullable(), minX: n, maxY: n, spanMm: n, heightMm: n,
  members: z.array(obj({ id, start: id, end: id, lengthMm: n, group: text })).max(18), crossings: z.array(obj({ x: n, y: n, dx: n, dy: n })).max(20),
});
const schema: z.ZodType<Workspace> = obj({ schemaVersion: z.literal(1),
  experiment: obj({
    round: z.discriminatedUnion('phase', [obj({ phase: z.literal('predicting'), roundId: id, load, panelId: panel.nullable() }), obj({ phase: z.literal('revealed'), roundId: id, trialId: id }), obj({ phase: z.literal('error'), roundId: id, load, panelId: panel.nullable(), error: failure })]),
    trials: z.array(trial).max(100), selectedTrialId: id.nullable(), inspectedTrialId: id.nullable().default(null),
    retest: z.discriminatedUnion('status', [obj({ status: z.literal('idle') }), obj({ status: z.literal('ready'), value: retest }), obj({ status: z.literal('error'), load, error: failure })]),
  }), quotes: quotesDraft, measurements: obj({ readings: z.array(reading).max(200), drafts: boundedRecord(draft), selectedKey: text }),
  report: report.nullable(), pattern: pattern.nullable(), includeRetest: z.boolean(),
});

/** Untrusted persisted JSON is bounded and validated before replacing any live state.
 * This validates consistency, not the authenticity of client-computed analyses. */
export function parseWorkspace(input: unknown): Workspace {
  if (new TextEncoder().encode(JSON.stringify(input)).length > 2_000_000) throw new Error('This project exceeds the 2 MB workspace limit.');
  const result = schema.safeParse(input);
  if (!result.success) throw new Error('This project contains unsupported or invalid workspace data. Your current workspace has not changed.');
  const value = result.data, state = value.experiment;
  const ids = new Set(state.trials.map(item => item.id));
  if (ids.size !== state.trials.length || new Set(state.trials.map(item => item.roundId)).size !== state.trials.length) throw new Error('Duplicate saved trials.');
  const selected = state.trials.find(item => item.id === state.selectedTrialId);
  if (state.selectedTrialId && !selected) throw new Error('The selected trial is missing.');
  if (state.inspectedTrialId && !ids.has(state.inspectedTrialId)) throw new Error('The inspected trial is missing.');
  if (state.round.phase === 'revealed' && (!selected || state.round.trialId !== selected.id || state.round.roundId !== selected.roundId)) throw new Error('The active trial is inconsistent.');
  if (state.round.phase !== 'revealed' && state.retest.status !== 'idle') throw new Error('A retest requires a revealed trial.');
  // Reuse report association validation without changing saved trial results.
  const active = state.retest.status === 'ready' ? state.retest.value : null;
  function checkScenario(item: Trial | Retest, expectedSolver: string, versionError: string) {
    const sameLoad = (a: typeof item.load, b: typeof item.load) => a.nodeId === b.nodeId && a.fxN === b.fxN && a.fyN === b.fyN;
    if (!sameLoad(item.load, item.results.load)) throw new Error('Trial load does not match its results.');
    for (const target of [item.results.baseline, ...Object.values(item.results.candidates)]) {
      if (target.analysis.solverVersion !== expectedSolver) throw new Error(versionError);
      if (validateDesign(target.design) || validateLoadCase(target.design, item.load)) throw new Error('Invalid saved geometry or load.');
      for (const node of target.design.nodes) if (!target.analysis.displacementMmByNode[node.id]) throw new Error('Missing displacement results.');
      for (const node of target.design.nodes) if ((node.restrained.x || node.restrained.y) && !target.analysis.reactionNByNode[node.id]) throw new Error('Missing reaction results.');
      for (const member of target.design.members) if (target.analysis.axialForceNByMember[member.id] === undefined) throw new Error('Missing member results.');
    }
    for (const [key, target] of Object.entries(item.results.candidates)) if (key !== target.panelId) throw new Error('Invalid brace association.');
  }
  for (const item of state.trials) checkScenario(item, item.solverVersion, 'Saved trial results must use the trial solver version.');
  if (active && (!selected || active.results.load.nodeId !== active.load.nodeId)) throw new Error('Retest results are inconsistent.');
  if (active && selected) {
    checkScenario(active, selected.solverVersion, 'Retest results must use the source trial solver version.');
    measurementCases(selected, active);
  }
  const allCases = state.trials.flatMap(item => measurementCases(item, selected?.id === item.id ? active : null));
  if (new Set(value.measurements.readings.map(item => item.id)).size !== value.measurements.readings.length) throw new Error('Duplicate observations.');
  for (const item of value.measurements.readings) {
    // Earlier retest readings outlive the active retest. Validate their raw evidence
    // against the saved design without assessing it against a different load's prediction.
    const designCase = allCases.find(c => c.design.id === item.designId);
    if (!designCase) throw new Error('An observation has no saved design.');
    const errors = validateReading(item, { ...designCase, load: load.parse(item.appliedLoad) });
    if (errors.length) throw new Error(errors.join(' '));
    const target = allCases.find(c => c.design.id === item.designId && c.load.nodeId === item.appliedLoad.nodeId && c.load.fxN === item.appliedLoad.fxN && c.load.fyN === item.appliedLoad.fyN);
    if (target) assessReading(item, target);
  }
  if (value.report) buildDecisionSheet(value.report, value.report.reportId, value.report.createdAtIso);
  if (value.pattern) {
    const sourceTrial = state.trials.find(item => item.id === value.pattern!.trialId);
    if (!sourceTrial) throw new Error('The assembly pattern source trial is missing.');
    const expected = buildAssemblyPattern(sourceTrial, value.pattern.addedMemberId !== null);
    if (JSON.stringify(pattern.parse(expected)) !== JSON.stringify(value.pattern)) throw new Error('The assembly pattern does not match its source trial.');
  }
  return snapshot(value);
}
