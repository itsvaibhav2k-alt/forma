import { useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { LOAD_NODE_IDS, PANEL_IDS, type Analysis, type Design, type LoadNodeId, type Member, type PanelId, type RankedBraces } from '../shared';
import { formatForce } from './format';
import { createBraceMember } from '../structures';

export const DEFORMATION_SCALE = 200;
const PIXELS_PER_MM = 2.25;
const screenX = (x: number) => 70 + x * PIXELS_PER_MM;
const screenY = (y: number) => 190 - y * PIXELS_PER_MM;
const LOAD_X = [205, 340, 475] as const;

export function snapLoadAtSvgX(x: number): LoadNodeId {
  const index = LOAD_X.reduce((nearest, value, i) => Math.abs(x - value) < Math.abs(x - LOAD_X[nearest]!) ? i : nearest, 0);
  return LOAD_NODE_IDS[index]!;
}

export interface BridgeCanvasProps {
  baseline: Design;
  loadNodeId: LoadNodeId;
  panelId: PanelId | null;
  results: RankedBraces | null;
  comparison: 'both' | 'original' | 'modified';
  showDeformation: boolean;
  showForces: boolean;
  locked: boolean;
  readOnly?: boolean;
  onLoadChange: (id: LoadNodeId) => void;
  onPanelChange: (id: PanelId) => void;
}

export function BridgeCanvas({ baseline, loadNodeId, panelId, results, comparison, showDeformation, showForces, locked, readOnly = false, onLoadChange, onPanelChange }: BridgeCanvasProps) {
  const titleId = useId();
  const descriptionId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<number | null>(null);
  const lastSnap = useRef(loadNodeId);
  const nodes = new Map(baseline.nodes.map(node => [node.id, node]));
  const candidate = panelId && results ? results.candidates[panelId] : null;
  const forceAnalysis = comparison === 'original' ? results?.baseline.analysis : candidate?.analysis;
  const loadX = LOAD_X[LOAD_NODE_IDS.indexOf(loadNodeId)]!;

  function movePointer(event: PointerEvent<SVGGElement>) {
    if (readOnly) return;
    const transform = svgRef.current?.getScreenCTM();
    if (!transform) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
    const snapped = snapLoadAtSvgX(point.x);
    if (lastSnap.current !== snapped) {
      lastSnap.current = snapped;
      onLoadChange(snapped);
    }
  }
  function moveKeyboard(event: KeyboardEvent<SVGGElement>) {
    if (readOnly) return;
    const index = LOAD_NODE_IDS.indexOf(loadNodeId);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? Math.max(0, index - 1) : ['ArrowRight', 'ArrowUp'].includes(event.key) ? Math.min(2, index + 1) : null;
    if (next !== null) { event.preventDefault(); onLoadChange(LOAD_NODE_IDS[next]!); }
  }
  function line(member: Member, analysis?: Analysis, className = 'bridge-member') {
    const start = nodes.get(member.startNodeId)!;
    const end = nodes.get(member.endNodeId)!;
    const u1 = analysis?.displacementMmByNode[start.id];
    const u2 = analysis?.displacementMmByNode[end.id];
    const force = (analysis ?? forceAnalysis)?.axialForceNByMember[member.id];
    const sign = showForces && force !== undefined ? Math.abs(force) < 1e-9 ? 'zero-force' : force > 0 ? 'tension' : 'compression' : '';
    return <line key={member.id} data-member-id={member.id} className={`${className} ${analysis ? '' : sign}`}
      x1={screenX(start.xMm + (u1?.x ?? 0) * DEFORMATION_SCALE)} y1={screenY(start.yMm + (u1?.y ?? 0) * DEFORMATION_SCALE)}
      x2={screenX(end.xMm + (u2?.x ?? 0) * DEFORMATION_SCALE)} y2={screenY(end.yMm + (u2?.y ?? 0) * DEFORMATION_SCALE)}>
      <title>{member.id}: {start.id}–{end.id}{force !== undefined ? `; ${formatForce(force)}` : ''}</title>
    </line>;
  }
  return <div className="bridge-canvas">
    <svg ref={svgRef} className="bridge-svg" viewBox="0 0 680 310" aria-labelledby={`${titleId} ${descriptionId}`}>
      <title id={titleId}>Four-panel bridge with a 10 N load at {loadNodeId}{panelId ? ` and brace ${panelId}` : ''}</title>
      <desc id={descriptionId}>B0 is pinned; B4 is a vertical roller. Crossed bars are not joined. Use the load handle with arrow keys or the load controls. {results && showDeformation ? 'Displacements are magnified 200 times for both designs.' : 'The drawing shows undeformed geometry.'}</desc>
      {PANEL_IDS.map((id, i) => <g key={id} aria-hidden="true" onClick={() => { if (!locked && !readOnly) onPanelChange(id); }} className={locked ? '' : 'panel-target'}>
        <rect x={70 + i * 135} y="64" width="135" height="135" rx="5" className={panelId === id ? 'panel-zone selected' : 'panel-zone'} />
        <text x={137.5 + i * 135} y="45" textAnchor="middle" className={panelId === id ? 'panel-label selected' : 'panel-label'}>{id}</text>
      </g>)}
      <g className="baseline-members">{baseline.members.map(member => line(member))}</g>
      {panelId && comparison !== 'original' && line(createBraceMember(panelId), undefined, 'preview-brace')}
      {results && showDeformation && <g aria-label="Magnified displacement overlays" className="deformation-overlays">
        {comparison !== 'modified' && <g data-overlay="original">{results.baseline.design.members.map(member => line(member, results.baseline.analysis, 'deformed original'))}</g>}
        {comparison !== 'original' && candidate && <g data-overlay="modified">{candidate.design.members.map(member => line(member, candidate.analysis, 'deformed modified'))}</g>}
      </g>}
      <g className="support-symbols" aria-label="B0 pin support and B4 roller support">
        <path d="M70 194 l-13 19 h26 Z M48 218 h44 M610 194 l-13 19 h26 Z M588 227 h44" />
        <circle cx="602" cy="219" r="4" /><circle cx="618" cy="219" r="4" />
      </g>
      {baseline.nodes.map(node => <g key={node.id} className="bridge-node" data-node-id={node.id}>
        <circle cx={screenX(node.xMm)} cy={screenY(node.yMm)} r="5" />
        <text x={screenX(node.xMm)} y={screenY(node.yMm) - 14} textAnchor="middle">{node.id}</text>
      </g>)}
      <g role="slider" tabIndex={readOnly ? -1 : 0} aria-disabled={readOnly} aria-label="Load position on bridge" aria-valuemin={1} aria-valuemax={3}
        aria-valuenow={LOAD_NODE_IDS.indexOf(loadNodeId) + 1} aria-valuetext={`${loadNodeId}, 10 N downward`} aria-orientation="horizontal"
        className="load-handle" onKeyDown={moveKeyboard}
        onPointerDown={event => { if (readOnly || event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); dragging.current = event.pointerId; lastSnap.current = loadNodeId; event.currentTarget.setPointerCapture(event.pointerId); movePointer(event); }}
        onPointerMove={event => { if (dragging.current === event.pointerId) movePointer(event); }}
        onPointerUp={event => { if (dragging.current === event.pointerId) { movePointer(event); dragging.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }}
        onPointerCancel={() => { dragging.current = null; }} onLostPointerCapture={() => { dragging.current = null; }}>
        <rect x={loadX - 48} y="199" width="96" height="96" rx="9" className="load-hit-area" />
        <path d={`M${loadX} 205 V253 m-9 -11 9 11 9 -11`} />
        <text x={loadX + 22} y="242">10 N</text>
        <text x={loadX} y="297" textAnchor="middle" className="drag-caption">{readOnly ? 'Saved load' : '↔ drag load'}</text>
      </g>
    </svg>
  </div>;
}
