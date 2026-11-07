import { useEffect, useId, useRef, useState } from 'react';
import { PANEL_IDS, type Analysis, type Design, type LoadNodeId, type PanelId, type RankedBraces } from '../shared';
import { createBraceMember } from '../structures';
import { DEFORMATION_SCALE } from './BridgeCanvas';
import { drawModel } from './drawModel';
import type { AnalysisSuccess, Design as DrawDesign } from './drawTypes';

const WIDTH = 760;
const HEIGHT = 400;

/** Presentation-only adapters: the renderer reads plain geometry, never engine modules. */
export function toDrawDesign(baseline: Design): DrawDesign {
  return {
    nodes: baseline.nodes.map(node => ({ id: node.id, x: node.xMm, y: node.yMm })),
    members: baseline.members,
    supports: baseline.nodes.filter(node => node.restrained.x || node.restrained.y)
      .map(node => ({ nodeId: node.id, fixedX: node.restrained.x, fixedY: node.restrained.y })),
    braceOptions: PANEL_IDS.map(id => ({ panelId: id, label: id, member: createBraceMember(id) })),
  };
}
export const toDrawAnalysis = (analysis: Analysis): AnalysisSuccess => ({
  displacementsMm: analysis.displacementMmByNode, memberForcesN: analysis.axialForceNByMember,
});

export interface ModelViewProps {
  baseline: Design;
  loadNodeId: LoadNodeId;
  panelId: PanelId | null;
  results: RankedBraces | null;
  locked: boolean;
  selectedMemberId?: string | null;
  onSelectMember?: (id: string | null) => void;
}

const PARTS = { front: 'Front truss', rear: 'Rear truss', deck: 'Removable deck', brace: 'Added brace', supports: 'Support blocks' } as const;
type Part = keyof typeof PARTS;

export function ModelView({ baseline, loadNodeId, panelId, locked, selectedMemberId, onSelectMember }: ModelViewProps) {
  const instanceId = `assembly-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [orbit, setOrbit] = useState(0);
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const [part, setPart] = useState<Part>('front');
  const [isolated, setIsolated] = useState<Part | null>(null);
  const [detail, setDetail] = useState(false);
  const [lifted, setLifted] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean; target: Element | null } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const zoomAt = (factor: number, x: number, y: number) => setCamera(c => {
    const zoom = Math.max(.45, Math.min(4.5, c.zoom * factor));
    const ratio = zoom / c.zoom;
    return { zoom, x: x - WIDTH / 2 - (x - WIDTH / 2 - c.x) * ratio, y: y - HEIGHT / 2 - (y - HEIGHT / 2 - c.y) * ratio };
  });
  const point = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (svg && matrix) { const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY; return p.matrixTransform(matrix.inverse()); }
    return { x: WIDTH / 2, y: HEIGHT / 2 };
  };
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) setOrbit(o => o + event.deltaX * .35);
      else { const p = point(event.clientX, event.clientY); zoomAt(Math.exp(-event.deltaY * (event.ctrlKey ? .012 : .002)), p.x, p.y); }
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => svg.removeEventListener('wheel', wheel);
  }, []);
  const drawn = drawModel({
    design: toDrawDesign(baseline), loadNodeId,
    previewPanelId: locked ? null : panelId, committedPanelId: locked ? panelId : null, locked,
    view: 'iso', mode: 'layout', orbit, width: WIDTH, height: HEIGHT, deformationScale: DEFORMATION_SCALE,
    selectedMemberId: selectedMemberId ?? null, deckLift: lifted ? 22 : 0, jointDetail: detail,
  });
  const isolation = isolated ? `<style>#${instanceId} [data-part]{visibility:hidden}#${instanceId} [data-part="${isolated}"],#${instanceId} [data-part="${isolated}"] *{visibility:visible}#${instanceId} [data-forma-hit]{display:none}</style>` : '';
  const transform = `translate(${WIDTH / 2 + camera.x} ${HEIGHT / 2 + camera.y}) scale(${camera.zoom * (detail ? 3.5 : 1)}) translate(${-WIDTH / 2} ${-HEIGHT / 2})`;
  return <figure className="model-view">
    <div className="assembly-toolbar" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" aria-pressed={!detail} onClick={() => setDetail(false)}>Assembled</button>
      <button type="button" aria-pressed={detail} onClick={() => { setDetail(true); setLifted(true); }}>Joint detail</button>
      <button type="button" aria-pressed={lifted} onClick={() => setLifted(v => !v)}>Lift deck</button>
      <span style={{ flex: 1 }} />
      <button type="button" aria-label="Zoom out" onClick={() => zoomAt(.8, WIDTH / 2, HEIGHT / 2)}>−</button>
      <span aria-label="Assembly zoom">{Math.round(camera.zoom * 100)}%</span>
      <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.25, WIDTH / 2, HEIGHT / 2)}>+</button>
      <button type="button" onClick={() => { setCamera({ zoom: 1, x: 0, y: 0 }); setOrbit(0); }}>Fit</button>
    </div>
    <svg id={instanceId} ref={svgRef} className="model-view-svg" role="img" aria-label={drawn.ariaLabel} viewBox={drawn.viewBox}
      style={{ touchAction: 'none', cursor: 'grab', overflow: 'hidden' }}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        drag.current = { x: event.clientX, y: event.clientY, moved: false, target: event.target instanceof Element ? event.target : null };
        if (touches.current.size > 1) { const [a, b] = [...touches.current.values()]; if (a && b) pinch.current = Math.hypot(a.x - b.x, a.y - b.y); }
      }}
      onPointerMove={event => {
        const d = drag.current; if (!d || !touches.current.has(event.pointerId)) return;
        touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touches.current.size > 1) {
          const [a, b] = [...touches.current.values()];
          if (a && b) { const distance = Math.hypot(a.x - b.x, a.y - b.y); const p = point((a.x + b.x) / 2, (a.y + b.y) / 2); if (pinch.current) zoomAt(distance / pinch.current, p.x, p.y); pinch.current = distance; d.moved = true; }
          return;
        }
        const dx = event.clientX - d.x; const dy = event.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        d.moved = true;
        if (event.shiftKey) { const a = point(d.x, d.y); const b = point(event.clientX, event.clientY); setCamera(c => ({ ...c, x: c.x + b.x - a.x, y: c.y + b.y - a.y })); }
        else setOrbit(o => o + dx * .65);
        d.x = event.clientX; d.y = event.clientY;
      }}
      onPointerUp={event => {
        const d = drag.current;
        if (d && !d.moved && touches.current.size === 1) {
          const id = d.target?.closest('[data-part]')?.getAttribute('data-part') as Part | null;
          if (id && id in PARTS) setPart(id);
          const member = d.target?.closest('[data-member]')?.getAttribute('data-member');
          if (member) onSelectMember?.(member);
        }
        touches.current.delete(event.pointerId); pinch.current = null; if (!touches.current.size) drag.current = null;
      }}
      onPointerCancel={() => { touches.current.clear(); drag.current = null; pinch.current = null; }}
      dangerouslySetInnerHTML={{ __html: `${isolation}<g transform="${transform}">${drawn.svgInner}</g>` }} />
    <div className="assembly-inspector" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
      <label>Inspect part <select aria-label="Inspect assembly part" value={part} onChange={event => setPart(event.target.value as Part)}>{Object.entries(PARTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <button type="button" onClick={() => setIsolated(part)}>Isolate</button>
      <button type="button" disabled={!isolated} onClick={() => setIsolated(null)}>Show all</button>
      <span>{PARTS[part]}{selectedMemberId ? ` · ${selectedMemberId}` : ''}</span>
    </div>
    <figcaption>Drag to orbit 360° · Shift-drag to pan · Scroll or pinch to zoom · Click a part to inspect</figcaption>
  </figure>;
}
