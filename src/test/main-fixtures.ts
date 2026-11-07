// Main regression inputs/oracles: test-only, never imported by the app.
import { snapshot as immutableCopy } from '../shared/snapshot';
import type {
  Design, FinanceInputs, Member, PanelId, 
  Preset, PriceInput, Quote, TrussNode,
} from '../engines/main/types';

export const JUDGE_PRESET_VERSION = 'judge-bridge-v1';
const stock = { id: 'demo-stock', areaMm2: 1, elasticModulusNPerMm2: 1_000 } as const;
const member = (id: string, startNodeId: string, endNodeId: string): Member => ({
  id, startNodeId, endNodeId, stockId: stock.id,
});
const nodes: TrussNode[] = [];
const members: Member[] = [];
for (let station = 0; station <= 4; station += 1) {
  nodes.push({ id: `b${station}`, x: station * 60, y: 0 });
  nodes.push({ id: `t${station}`, x: station * 60, y: 40 });
  members.push(member(`vertical-${station}`, `b${station}`, `t${station}`));
  if (station < 4) {
    members.push(member(`bottom-${station + 1}`, `b${station}`, `b${station + 1}`));
    members.push(member(`top-${station + 1}`, `t${station}`, `t${station + 1}`));
    members.push(station < 2
      ? member(`diagonal-${station + 1}`, `b${station}`, `t${station + 1}`)
      : member(`diagonal-${station + 1}`, `t${station}`, `b${station + 1}`));
  }
}
export const JUDGE_PRESET: Preset = immutableCopy({
  version: JUDGE_PRESET_VERSION,
  label: 'Four-panel tabletop bridge',
  design: {
    id: 'judge-bridge-original',
    presetVersion: JUDGE_PRESET_VERSION,
    nodes,
    members,
    stocks: [stock],
    supports: [
      { nodeId: 'b0', fixedX: true, fixedY: true },
      { nodeId: 'b4', fixedX: false, fixedY: true },
    ],
    braceOptions: [0, 1, 2, 3].map((panel) => ({
      panelId: `panel-${panel + 1}` as PanelId,
      label: `Panel ${panel + 1}`,
      member: panel < 2
        ? member(`added-brace-${panel + 1}`, `t${panel}`, `b${panel + 1}`)
        : member(`added-brace-${panel + 1}`, `b${panel}`, `t${panel + 1}`),
    })),
  },
  loadNodeIds: ['b1', 'b2', 'b3'],
  defaultLoad: { nodeId: 'b1', fxN: 0, fyN: -1 },
} satisfies Preset);

export const TRIANGLE_DESIGN: Design = immutableCopy({
  id: 'analytic-triangle', presetVersion: 'analytic-triangle-v1',
  nodes: [
    { id: 'left', x: 0, y: 0 }, { id: 'right', x: 200, y: 0 },
    { id: 'apex', x: 100, y: 100 },
  ],
  members: [
    member('bottom-tie', 'left', 'right'), member('left-incline', 'left', 'apex'),
    member('right-incline', 'right', 'apex'),
  ],
  stocks: [stock],
  supports: [
    { nodeId: 'left', fixedX: true, fixedY: true },
    { nodeId: 'right', fixedX: false, fixedY: true },
  ],
  braceOptions: [],
} satisfies Design);
export const TRIANGLE_LOAD = immutableCopy({ nodeId: 'apex', fxN: 0, fyN: -1 });
/** Analytic oracle from the brief; never present as computed application output. */
export const TRIANGLE_EXPECTED = immutableCopy({
  reactionYEachN: 0.5,
  inclinedForceN: -Math.SQRT1_2,
  bottomTieForceN: 0.5,
  apexDownwardMm: 0.05 + Math.SQRT2 / 10,
  relativeTolerance: 0.01,
});
export const UNSTABLE_SQUARE_DESIGN: Design = immutableCopy({
  id: 'unbraced-square', presetVersion: 'unbraced-square-v1',
  nodes: [
    { id: 'left', x: 0, y: 0 }, { id: 'right', x: 100, y: 0 },
    { id: 'top-left', x: 0, y: 100 }, { id: 'top-right', x: 100, y: 100 },
  ],
  members: [
    member('bottom', 'left', 'right'), member('right-side', 'right', 'top-right'),
    member('top', 'top-right', 'top-left'), member('left-side', 'top-left', 'left'),
  ],
  stocks: [stock],
  supports: [
    { nodeId: 'left', fixedX: true, fixedY: true },
    { nodeId: 'right', fixedX: false, fixedY: true },
  ],
  braceOptions: [],
} satisfies Design);
export const UNSTABLE_SQUARE_LOAD = immutableCopy({ nodeId: 'top-right', fxN: 0, fyN: -1 });
/** Approximate ideal-model references from BUILD_PLAN.md, not solver output. */
export const BRIDGE_EXPECTED = immutableCopy({
  firstInterior: { panel1ReductionPercent: 26, panel2ReductionPercent: 1 },
  center: { bestPanelIds: ['panel-2', 'panel-3'], reductionPercent: 10.5 },
});
const demoPrice = (amountUSD: number): PriceInput => ({
  amountUSD, source: { kind: 'demonstration', label: 'Fictional demonstration assumption; not a vendor quote' },
});
const quote = (id: string, label: string, purchaseUSD: number, annualUpkeepUSD: number): Quote => ({
  id, label,
  scopeId: 'same-scope-demo-package-v1',
  scopeLabel: 'Fictional equal-scope installed package; same service level',
  purchase: demoPrice(purchaseUSD), delivery: demoPrice(500), installation: demoPrice(500),
  donation: demoPrice(0), annualUpkeep: demoPrice(annualUpkeepUSD),
});
export const DEMO_FINANCE_INPUTS: FinanceInputs = immutableCopy({
  quoteA: quote('demo-a', 'Fictional package A', 18_000, 900),
  quoteB: quote('demo-b', 'Fictional package B', 20_000, 450),
  budgetUSD: 20_000, years: 10, rate: 0.03,
});
/** Rounded acceptance values only. Calculations must retain full precision. */
export const FINANCE_EXPECTED = immutableCopy({
  upfrontAUSD: 19_000, upfrontBUSD: 21_000,
  fundingGapAUSD: 0, fundingGapBUSD: 1_000,
  roundedPresentAUSD: 26_677, roundedPresentBUSD: 24_839,
  breakEvenAt3PercentUSD: 234.46, breakEvenAt0PercentUSD: 200,
});

export type * from '../engines/main/types';
