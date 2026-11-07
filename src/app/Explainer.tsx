export type ExplainerView = 'experiment' | 'costs' | 'report' | 'measurements' | 'template';

interface Block { readonly lead: string; readonly steps?: readonly string[]; readonly terms?: readonly [string, string][]; readonly limits?: string }

const COPY: Record<ExplainerView, Block> = {
  experiment: {
    lead: 'Forma is a small tabletop experiment. A 240 mm truss bridge carries a 10 N load. You may add exactly one diagonal brace, in one of four panels. The question: which panel stiffens the bridge most for the load you choose?',
    steps: [
      'Position the load at B1, B2 or B3, the three bottom joints that can carry it. Drag the arrow in the drawing, use the arrow keys, or pick a tile.',
      'Choose a panel, P1 to P4. Each adds one brace of the same length. The dashed line previews it.',
      'Commit your prediction. The app then solves the bridge four times, once per panel, and reveals how far the loaded joint moves with your brace versus the other three. Nothing is shown before you commit, so it is a genuine prediction.',
      'Move the load to retest the same brace, or start another prediction to try a different panel. Every committed trial is saved below and can be reopened read-only.',
    ],
    terms: [
      ['Deflection', 'How far the loaded joint moves down, in millimetres. Lower is better.'],
      ['Reduction', 'How much less the joint moves with that brace than with no brace at all.'],
      ['Rank', '1 of 4 is the best panel for that load. Ties share a rank.'],
      ['3D view and drawing', 'The shaded model and the line drawing show the same bridge. The drawing is where you drag the load and click panels.'],
    ],
    limits: 'This is a linear-elastic model of one side of the bridge with ideal pin joints. It predicts stiffness under this one load, not strength, and it is not a safety rating.',
  },
  costs: {
    lead: 'A separate planning scenario that never touches the bridge model. Enter two build packages that deliver the same thing, plus your budget, the number of years you care about and a real discount rate. The app compares what each package needs today against what it costs over time.',
    terms: [
      ['Upfront cost', 'Materials, freight and installation, minus any cash contribution. A contribution can only cover those costs; any excess does not reduce upkeep.'],
      ['Funding gap', 'How much of the upfront cost exceeds your budget. Zero means it fits.'],
      ['Discounted total', 'Upfront cost plus every year of upkeep, valued in today’s dollars at the real rate.'],
      ['Break-even', 'The yearly upkeep saving the pricier package must deliver to pay back its extra upfront cost over the horizon.'],
      ['Blank versus zero', 'Blank means unknown and stays unknown in every total. Type 0 only when a cost really is zero.'],
      ['Demo assumption', 'Fictional example amounts. Edit one and it becomes your estimate. Replace them before deciding.'],
    ],
  },
  measurements: {
    lead: 'Record what the physical model actually did under the same load. Each reading stays tied to its design, load, measured joint and test conditions, so it can be compared with the prediction without mixing cases.',
    limits: 'A reading is evidence, not validation. Keep raw repeats, the method and the instrument resolution with it.',
  },
  report: {
    lead: 'A frozen one-page record of the selected saved trial, the cost inputs at capture time and any matching measurements. Later edits never change a captured sheet; capture a new one instead. Print it on US Letter or save it as a PDF.',
  },
  template: {
    lead: 'A side-view pattern of the captured geometry at actual size, for positioning members on the table. Check the 100 mm bar with a ruler before trusting the print scale. Crossed diagonals are not joints.',
  },
};

/** Plain-language explanation of the current page. Static copy only; no state or engines. */
export function Explainer({ view, open }: { view: ExplainerView; open: boolean }) {
  const copy = COPY[view];
  return <details className="explainer" open={open || undefined} key={view}>
    <summary>How this works</summary>
    <div className="explainer-body">
      <p>{copy.lead}</p>
      {copy.steps && <ol>{copy.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>}
      {copy.terms && <dl>{copy.terms.map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}</dl>}
      {copy.limits && <p className="explainer-limits">{copy.limits}</p>}
    </div>
  </details>;
}
