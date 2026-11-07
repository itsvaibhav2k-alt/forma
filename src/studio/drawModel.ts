/**
 * Ported from the Claude presentation lane (feat/claude-experience 470ba0b): the Forma Studio
 * prototype's drawFormaModel: a lightly shaded tabletop truss
 * in iso or elevation view. No React, no DOM reads; every number comes from the options.
 */
import type {
  AnalysisSuccess, Design, NodeId, PanelId, TrussNode, Vector2,
} from './drawTypes';

export type ViewMode = 'iso' | 'side';
export type DrawMode = 'layout' | 'deflect' | 'forces';
export interface DrawOptions {
  design: Design;
  loadNodeId: NodeId;
  previewPanelId: PanelId | null;
  committedPanelId: PanelId | null;
  locked: boolean;
  view: ViewMode;
  mode: DrawMode;
  orbit: number;
  width: number;
  height: number;
  deformationScale: number;
  original?: AnalysisSuccess;
  modified?: AnalysisSuccess;
}
export interface Anchor { x: number; y: number }
export interface DrawResult {
  svgInner: string;
  viewBox: string;
  height: number;
  ariaLabel: string;
  anchors: { panels: Anchor[]; load: Anchor; joints: Anchor[] };
}

type Pt = readonly [number, number];
type Palette = readonly [string, string, string, string, string];
type BoxPalette = readonly [string, string, string];
type Displacements = Readonly<Record<NodeId, Vector2>> | undefined;
interface Scene {
  readonly P: (x: number, y: number, z: number) => Pt;
  readonly s: number;
  readonly id: string;
  readonly isSide: boolean;
}
interface Beam {
  readonly a: Pt; readonly b: Pt; readonly layer: number; readonly thick: number;
  readonly force: number | undefined;
}

const DEPTH = 34;
const SAFE_ID = /^[A-Za-z0-9-]+$/;
const PURPLE = '#2761d3';
// ponytail: deck/abutment presentation geometry is fixed to the judge span like the prototype
const ABUTMENT_XS = [0, 240] as const;
const SLATS = ['#a4afc2', '#bbc5d4', '#b0bcce', '#c2cad8', '#aebacc'] as const;
const PALETTE = {
  rear: ['#8a98b1', '#bcc8dd', '#53617b', '#37445e', '#c7d3e9'],
  tension: ['#77d5d4', '#c7fffa', '#3a8e99', '#255b63', '#dbffff'],
  compression: ['#f29d78', '#ffe0ba', '#c26e53', '#8f503e', '#ffebcf'],
  neutral: ['#8d98a9', '#adb7c6', '#596679', '#3d495f', '#bec8d6'],
} as const satisfies Record<string, Palette>;
let renderCount = 0;

const digits = (n: number): number => Number(n.toFixed(2));
const attrs = (pts: readonly Pt[]): string =>
  pts.map((p) => `${digits(p[0])},${digits(p[1])}`).join(' ');
const poly = (points: readonly Pt[], fill: string, extra = ''): string =>
  `<polygon points="${attrs(points)}" fill="${fill}" ${extra}/>`;
const line = (a: Pt, b: Pt, color: string, thick = 1, extra = ''): string =>
  `<line x1="${digits(a[0])}" y1="${digits(a[1])}" x2="${digits(b[0])}" y2="${digits(b[1])}" `
  + `stroke="${color}" stroke-width="${digits(thick)}" ${extra}/>`;
const circ = (p: Pt, r: number, fill: string, extra = ''): string =>
  `<circle cx="${digits(p[0])}" cy="${digits(p[1])}" r="${digits(r)}" fill="${fill}" ${extra}/>`;

function makeScene(
  view: ViewMode, orbit: number, width: number, height: number, drop = 0,
): Scene {
  const isSide = view === 'side';
  const azimuth = (22 + Math.max(-16, Math.min(16, orbit))) * Math.PI / 180;
  const ca = Math.cos(azimuth); const sa = Math.sin(azimuth); const elev = 0.47;
  const proj = (x: number, y: number, z: number): Pt => isSide ? [x, -y]
    : [x * ca - z * sa, -x * sa * Math.sin(elev) - y * Math.cos(elev) - z * ca * Math.sin(elev)];
  const extent = isSide ? 267 : 263 * ca + (DEPTH + 10) * sa;
  const s = Math.min(
    (width - Math.max(28, width * 0.10)) / extent,
    (height - 58) / ((isSide ? 109 : 125) + drop),
  );
  // drop: how far (mm) a magnified deflected shape reaches below the deck; keeps it in frame.
  const [cx, cy] = proj(120, 23 - drop / 2, DEPTH / 2);
  const origin: Pt = [width * 0.5 - cx * s, height * 0.5 - cy * s];
  const P = (x: number, y: number, z: number): Pt => {
    const p = proj(x, y, z);
    return [origin[0] + p[0] * s, origin[1] + p[1] * s];
  };
  renderCount += 1;
  return { P, s, isSide, id: `fxb${renderCount}` };
}

function defs({ id, s }: Scene): string {
  return `<defs><linearGradient id="${id}front" x1="0" y1="1" x2=".9" y2="0" `
    + 'gradientUnits="objectBoundingBox"><stop stop-color="#8896af"/>'
    + '<stop offset=".38" stop-color="#b1bed2"/><stop offset=".72" stop-color="#dae2ed"/>'
    + `<stop offset="1" stop-color="#adbad0"/></linearGradient><linearGradient id="${id}purple" `
    + 'x2=".85" y2="1"><stop stop-color="#bbdcff"/><stop offset=".34" stop-color="#438bff"/>'
    + `<stop offset="1" stop-color="#2a57dc"/></linearGradient><linearGradient id="${id}concrete" `
    + 'x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#e4dfd7"/>'
    + `<stop offset="1" stop-color="#ada9aa"/></linearGradient><filter id="${id}soft" x="-30%" `
    + `width="160%" y="-90%" height="280%"><feGaussianBlur stdDeviation="${
      digits(Math.max(1.7, s * 1.4))}"/></filter></defs>`;
}

function box(
  { P }: Scene, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
  [face, top, end]: BoxPalette,
): string {
  const front = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)] as const;
  return poly([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], end)
    + poly(front, face)
    + poly([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], top)
    + line(front[3], front[2], '#ffffff', 0.45, 'opacity=".38"');
}

function abutments(scene: Scene): string {
  const { P, id, isSide } = scene;
  const concrete: BoxPalette = [`url(#${id}concrete)`, '#f0eeea', '#c2beb8'];
  const base: BoxPalette = ['#aca8a4', '#dad7cf', '#a59f98'];
  let out = poly(
    [P(-12, -13, -6), P(254, -13, -6), P(261, -13, 40), P(-5, -13, 40)],
    '#786a60', `opacity=".32" filter="url(#${id}soft)"`,
  );
  for (const x of ABUTMENT_XS) {
    out += box(scene, x - 9, x + 9, -12, -9, -3, DEPTH + 3, base);
    out += box(scene, x - 8.5, x + 8.5, -9, -2.8, -2.8, DEPTH + 2.8, concrete);
    out += line(P(x - 8.5, -8.1, -2.8), P(x + 8.5, -8.1, -2.8), '#d7dfec', 0.75, 'opacity=".4"');
    for (const z of (isSide ? [0] : [DEPTH, 0])) {
      out += box(scene, x - 3.4, x + 3.4, -2.8, -1.8, z - 2, z + 2,
        ['#555f76', '#b7c2d4', '#69748b']);
      out += box(scene, x - 2.5, x + 2.5, -1.8, -0.55, z - 1.8, z + 1.8,
        ['#42475d', '#7c89a1', '#566079']);
    }
  }
  return out;
}

function deck(scene: Scene): string {
  let out = '';
  for (let i = 0; i < 5; i += 1) {
    const x = i * 60;
    out += box(scene, x - 0.9, x + 0.9, -0.8, 0.65, 0.3, DEPTH, ['#727f98', '#c2cddc', '#8491a8']);
  }
  for (let j = 0; j < 40; j += 1) {
    const x = j * 6;
    const top = SLATS[(j * 3 + Math.floor(j / 5)) % SLATS.length] ?? SLATS[0];
    out += box(scene, x + 0.1, x + 5.85, -0.2, 1.1, 1.65, DEPTH - 1.1, ['#737e93', top, '#778298']);
  }
  return out;
}

function beam({ P, s }: Scene, a: Pt, b: Pt, z: number, t: number, material: Palette): string {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let nx = -(b[1] - a[1]) / length; let ny = (b[0] - a[0]) / length;
  if (ny < 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
  const hi = (p: Pt, k: number, v: number): Pt => P(p[0] + nx * k, p[1] + ny * k, v);
  const A = hi(a, t / 2, z); const B = hi(b, t / 2, z); const C = hi(b, -t / 2, z);
  const D = hi(a, -t / 2, z);
  const A2 = hi(a, t / 2, z + 2); const B2 = hi(b, t / 2, z + 2); const C2 = hi(b, -t / 2, z + 2);
  const [face, top, side, ridge, edge] = material;
  return poly([B, C, C2, B2], side) + poly([A, B, B2, A2], top) + poly([A, B, C, D], face)
    + line(A, B, edge, Math.max(0.42, s * 0.22), 'opacity=".82"')
    + line(hi(a, -t * 0.28, z - 0.01), hi(b, -t * 0.28, z - 0.01), ridge,
      Math.max(0.46, s * 0.24), 'opacity=".72"');
}

function hardware({ P, s }: Scene, points: readonly Pt[], z0: number): string {
  const OUTLINE = [[-1.55, -1.15], [0.9, -1.25], [1.65, -0.5], [1.4, 1.05], [-0.7, 1.35],
    [-1.6, 0.65]] as const;
  let out = '';
  for (const [x, y] of points) {
    out += poly(OUTLINE.map(([a, b]) => P(x + a, y + b, z0)), '#a2aec2',
      'stroke="#56647d" stroke-width=".42"');
    out += circ(P(x, y, z0), Math.max(0.78, s * 0.64), '#63502f')
      + circ(P(x - 0.07, y + 0.1, z0), Math.max(0.51, s * 0.44), '#c9a45b')
      + circ(P(x - 0.16, y + 0.18, z0), Math.max(0.24, s * 0.19), '#fbebba');
  }
  return out;
}

/** Tension/compression/neutral palette for a signed force; neutral when it rounds to 0.00 N. */
function forcePalette(force: number | undefined): Palette {
  const rounded = Math.round((force ?? 0) * 100) / 100;
  if (rounded === 0) return PALETTE.neutral;
  return rounded > 0 ? PALETTE.tension : PALETTE.compression;
}

/** "panel-3" is P3; an unparseable id falls back to its position. */
function panelNumber(panelId: PanelId, index: number): number {
  const n = Number(panelId.replace(/^panel-/, ''));
  return Number.isInteger(n) && n > 0 ? n : index + 1;
}

function hoverCues(
  scene: Scene, candidates: readonly (readonly [Pt, Pt])[], numbers: readonly number[],
  pick: number,
): string {
  const { P, s } = scene;
  let rules = '[data-forma-cue]{opacity:0;pointer-events:none}'
    + '@media (hover:hover){g[data-forma-hit]:hover>[data-forma-cue]{opacity:.78}}';
  for (const n of numbers) {
    rules += `svg[data-hover-panel="${n}"] g[data-forma-hit="${n}"]>[data-forma-cue]{opacity:.78}`;
  }
  let out = `<style>${rules}</style>`;
  candidates.forEach(([a, b], i) => {
    const p = P(a[0], a[1], -0.15); const q = P(b[0], b[1], -0.15);
    const dash = pick === i ? '' : ' stroke-dasharray="5 4"';
    const cue = line(p, q, PURPLE, Math.max(2.6, s * 1.4),
      `stroke-linecap="round" data-forma-cue=""${dash}`);
    const hit = line(p, q, 'transparent', Math.max(18, s * 6), 'pointer-events="stroke"');
    const n = numbers[i] ?? i + 1;
    out += `<g data-panel="${n}" data-forma-hit="${n}" style="cursor:pointer">${cue}${hit}</g>`;
  });
  return out;
}

export function drawModel(options: DrawOptions): DrawResult {
  const { design, mode, locked, deformationScale, loadNodeId } = options;
  const width = Math.max(230, Math.round(options.width || 700));
  const height = Math.round(options.height || Math.max(225, Math.min(416, width * 0.61)));
  const current = options.modified ?? options.original;
  const magnify = mode === 'deflect' ? deformationScale : 0;
  const results = [options.original, options.modified];
  const drop = magnify ? Math.max(0, ...design.nodes.flatMap((n) => results.map(
    (r) => -(n.y + (r?.displacementsMm[n.id]?.y ?? 0) * magnify),
  ))) : 0;
  const scene = makeScene(options.view, options.orbit, width, height, drop);
  const { P, s, isSide, id } = scene;
  const nodes = new Map<NodeId, TrussNode>(design.nodes.map((node) => [node.id, node]));
  const node = (nodeId: NodeId): TrussNode => {
    const found = nodes.get(nodeId);
    if (!found || !SAFE_ID.test(nodeId)) throw new Error(`drawModel: unknown node ${nodeId}`);
    return found;
  };
  const at = (nodeId: NodeId, disp: Displacements = current?.displacementsMm): Pt => {
    const n = node(nodeId); const d = disp?.[nodeId] ?? { x: 0, y: 0 };
    return [n.x + d.x * magnify, n.y + d.y * magnify];
  };
  const braceIds = new Set(design.braceOptions.map((option) => option.member.id));
  const forces = mode === 'forces' ? current?.memberForcesN : undefined;
  const beams: Beam[] = design.members.filter((m) => !braceIds.has(m.id)).map((m) => {
    const start = node(m.startNodeId); const end = node(m.endNodeId);
    const vertical = start.x === end.x; const chord = start.y === end.y;
    return {
      a: at(m.startNodeId), b: at(m.endNodeId),
      layer: chord ? 2 : vertical ? 1 : 0, thick: vertical ? 2.2 : chord ? 3.05 : 2.3,
      force: forces?.[m.id],
    };
  }).sort((x, y) => x.layer - y.layer);
  const pickId = options.committedPanelId ?? options.previewPanelId;
  const pick = design.braceOptions.findIndex((option) => option.panelId === pickId);
  const candidates = design.braceOptions.map((option) =>
    [at(option.member.startNodeId), at(option.member.endNodeId)] as const);
  const materials = {
    front: [`url(#${id}front)`, '#e1e7f3', '#64718a', '#435069', '#f5f7fc'] as Palette,
    selected: [`url(#${id}purple)`, '#9bc9ff', '#254db9', '#1f429a', '#e5f2ff'] as Palette,
  };

  const frame = (z: number, near: boolean): string => {
    let out = '';
    for (const b of beams) {
      const material = near && forces ? forcePalette(b.force)
        : near ? materials.front : PALETTE.rear;
      out += beam(scene, b.a, b.b, z, b.thick, material);
    }
    const brace = design.braceOptions[pick]; const pair = candidates[pick];
    if (near && brace && pair) {
      const material = forces ? forcePalette(forces[brace.member.id]) : materials.selected;
      out += beam(scene, pair[0], pair[1], z - 0.1, 2.65, material);
    }
    return near ? out + hardware(scene, design.nodes.map((n) => at(n.id)), z - 0.19) : out;
  };

  let out = defs(scene) + abutments(scene);
  if (!isSide) out += frame(DEPTH, false) + deck(scene);
  if (magnify) {
    const overlay = options.original ?? options.modified;
    for (const m of design.members) {
      if (braceIds.has(m.id)) continue;
      const a = at(m.startNodeId, overlay?.displacementsMm);
      const b = at(m.endNodeId, overlay?.displacementsMm);
      out += line(P(a[0], a[1], -0.05), P(b[0], b[1], -0.05), '#5676a5', 1,
        'opacity=".74" stroke-dasharray="3.5 4"');
    }
  }
  out += frame(0, true);
  if (!locked) {
    candidates.forEach(([a, b], i) => {
      if (i === pick) return;
      out += line(P(a[0], a[1], -0.12), P(b[0], b[1], -0.12), '#827e88', 1.2,
        'opacity=".48" stroke-dasharray="3 5"');
    });
  }
  const marker = at(loadNodeId);
  const tip = P(marker[0], marker[1], -0.3); const tipY = tip[1] - Math.max(4, s * 1.6);
  const peg = P(marker[0], 68, -0.3); const tagY = peg[1] - 8;
  out += line([tip[0], peg[1] + 4], [tip[0], tipY - 1], PURPLE, 1.4, 'stroke-dasharray="3 4"');
  out += poly([[tip[0] - 4.2, tipY - 5], [tip[0], tipY + 1.5], [tip[0] + 4.2, tipY - 5]], PURPLE);
  out += circ(tip, Math.max(3, 1.9 * s), 'none', `stroke="${PURPLE}" stroke-width="1.3"`);
  const numbers = design.braceOptions.map((option, i) => panelNumber(option.panelId, i));
  if (!locked && mode === 'layout') out += hoverCues(scene, candidates, numbers, pick);

  const point = ([x, y]: Pt): Anchor => ({ x, y });
  const panels = design.braceOptions.map((option) => {
    const mid = (node(option.member.startNodeId).x + node(option.member.endNodeId).x) / 2;
    return point(P(mid, -16, 0));
  });
  // Load joints: bottom-chord nodes that are not supports, left to right (b1, b2, b3).
  const bottomY = Math.min(...design.nodes.map((n) => n.y));
  const supported = new Set(design.supports.map((support) => support.nodeId));
  const joints = design.nodes
    .filter((n) => n.y === bottomY && !supported.has(n.id))
    .sort((p, q) => p.x - q.x)
    .map((n) => { const [x, y] = P(at(n.id)[0], 68, -0.3); return { x, y: y - 6.5 }; });
  const xs = design.nodes.map((n) => n.x);
  const span = Math.max(...xs) - Math.min(...xs);
  const pickWord = pick === -1 ? '' : `, brace in P${numbers[pick] ?? pick + 1}`;
  const count = design.braceOptions.length;
  const ariaLabel = `${count === 4 ? 'Four' : count}-panel truss span, ${span} mm. `
    + `Load at ${loadNodeId.toUpperCase()}${pickWord}.`;
  return {
    svgInner: out, viewBox: `0 0 ${width} ${height}`, height, ariaLabel,
    anchors: { panels, load: { x: peg[0], y: tagY + 1.5 }, joints },
  };
}
