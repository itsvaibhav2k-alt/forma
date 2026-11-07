import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PANEL_IDS, type Analysis, type Design, type LoadNodeId, type PanelId, type RankedBraces } from '../shared';
import { createBraceMember } from '../structures';
import type { AnalysisSuccess, Design as DrawDesign } from './drawTypes';
import { createV9LightingWorker, renderV9Assembly, type V9Solution } from './v9Renderer.js';

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
  onPartSelect?: (partId: string, label: string, description: string) => void;
  controlsHostId?: string;
  compact?: boolean;
}

const PARTS = {
  front: ['Front truss', 'These ten joints and their connecting members form the planar model used for the experiment.'],
  rear: ['Rear truss', 'The far truss shows the width and construction of the tabletop assembly. The solver uses the front truss.'],
  floor: ['Floor framing', 'The lengthwise stringers rest on crossbeams. Open a bay to see both below the deck.'],
  deck: ['Deck covers', 'A milled tread closes each bay. In Open bay, the selected tread lifts off its carrier.'],
  spacer: ['Deck spacers', 'The burgundy insert sits between the tread and its metal carrier. The four corners register the layers.'],
  carrier: ['Deck carriers', 'The carrier sits below the spacer and aligns the removable tread with the deck frame.'],
  supports: ['Bearings', 'The left pin restrains horizontal and vertical movement. The right roller restrains vertical movement.'],
  brace: ['Trial brace', 'The extra diagonal joins the two marked panel nodes. Commit a placement to compare its effect at the loaded joint.'],
  cheek: ['Cheek plates', 'These two plates sit on opposite sides of the brace connection, aligned along the pin axis.'],
  sleeve: ['Bushing', 'The bushing surrounds the pin where it passes through the joint.'],
  washer: ['Washer', 'The washer sits between the outer plate and the brace eye in the illustrated connection.'],
  pin: ['Shoulder pin', 'The shoulder pin passes through the plate assembly and the selected brace eye.'],
} as const;
type Part = keyof typeof PARTS;
const ASSEMBLY_PARTS: Part[] = ['front', 'rear', 'floor', 'deck', 'spacer', 'carrier', 'supports', 'brace'];
const JOINT_PARTS: Part[] = ['brace', 'cheek', 'sleeve', 'washer', 'pin'];

export function ModelView({ baseline, loadNodeId, panelId, results, locked, selectedMemberId, onSelectMember, onPartSelect, controlsHostId, compact = false }: ModelViewProps) {
  const instanceId = `assembly-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [orbit, setOrbit] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const [part, setPart] = useState<Part | ''>('');
  const [isolated, setIsolated] = useState<Part | null>(null);
  const [detail, setDetail] = useState(false);
  const [lifted, setLifted] = useState(!compact);
  const [overlaysOpen, setOverlaysOpen] = useState(false);
  const [labels, setLabels] = useState(false);
  const [dimensions, setDimensions] = useState(false);
  const [size, setSize] = useState({ width: 1000, height: 620 });
  const [controlsHost, setControlsHost] = useState<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lightingRef = useRef<HTMLCanvasElement>(null);
  const lightingWorker = useRef<Worker | null>(null);
  const lightingGeneration = useRef(0);
  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    try { lightingWorker.current = createV9LightingWorker(); } catch { return; }
    const worker = lightingWorker.current;
    worker.onmessage = (event: MessageEvent<{ requestId: number; pixels: { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } }>) => {
      const canvas = lightingRef.current;
      if (!canvas || event.data.requestId !== lightingGeneration.current) return;
      const { pixels } = event.data;
      canvas.width = pixels.width; canvas.height = pixels.height;
      const context = canvas.getContext('2d');
      if (context) { context.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0); canvas.hidden = false; }
    };
    worker.onerror = () => { if (lightingRef.current) lightingRef.current.hidden = true; };
    return () => { worker.terminate(); lightingWorker.current = null; };
  }, []);
  const sceneRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean; target: Element | null } | null>(null);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const width = size.width, height = size.height;
  useEffect(() => { setControlsHost(controlsHostId ? document.getElementById(controlsHostId) : null); }, [controlsHostId]);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const rect = scene.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize(previous => {
        const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
        return next.width === previous.width && next.height === previous.height ? previous : next;
      });
    };
    const observer = new ResizeObserver(measure); observer.observe(scene); measure();
    return () => observer.disconnect();
  }, []);
  const selectPart = (id: Part) => { setPart(id); onPartSelect?.(id, PARTS[id][0], PARTS[id][1]); };
  const changeView = (nextDetail: boolean, nextLifted: boolean) => {
    setDetail(nextDetail); setLifted(nextLifted); setIsolated(null); setCamera({ zoom: 1, x: 0, y: 0 });
    setPart('');
  };
  const zoomAt = (factor: number, x: number, y: number) => setCamera(c => {
    const zoom = Math.max(.45, Math.min(4.5, c.zoom * factor)), ratio = zoom / c.zoom;
    return { zoom, x: x - width / 2 - (x - width / 2 - c.x) * ratio, y: y - height / 2 - (y - height / 2 - c.y) * ratio };
  });
  const point = (clientX: number, clientY: number) => {
    const svg = svgRef.current, matrix = svg?.getScreenCTM?.();
    if (svg && matrix) { const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY; return p.matrixTransform(matrix.inverse()); }
    return { x: width / 2, y: height / 2 };
  };
  useEffect(() => {
    const svg = svgRef.current; if (!svg) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) setOrbit(o => (o - event.deltaX * .32) % 360);
      else { const p = point(event.clientX, event.clientY); zoomAt(Math.exp(-event.deltaY * (event.ctrlKey ? .012 : .002)), p.x, p.y); }
    };
    let gestureScale = 1;
    const gestureStart = (event: Event) => { event.preventDefault(); gestureScale = (event as Event & { scale?: number }).scale ?? 1; };
    const gestureChange = (event: Event) => {
      event.preventDefault(); if (touches.current.size >= 2) return;
      const gesture = event as Event & { scale?: number; clientX?: number; clientY?: number };
      const next = gesture.scale ?? gestureScale;
      const p = gesture.clientX !== undefined && gesture.clientY !== undefined ? point(gesture.clientX, gesture.clientY) : { x: width / 2, y: height / 2 };
      zoomAt(next / gestureScale, p.x, p.y); gestureScale = next;
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    svg.addEventListener('gesturestart', gestureStart, { passive: false });
    svg.addEventListener('gesturechange', gestureChange, { passive: false });
    return () => { svg.removeEventListener('wheel', wheel); svg.removeEventListener('gesturestart', gestureStart); svg.removeEventListener('gesturechange', gestureChange); };
  }, [width, height]);
  const solution = useMemo<V9Solution>(() => {
    const nodes = [...baseline.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(n => ({ id: n.id, x: n.xMm, y: n.yMm }));
    const analysis = panelId ? results?.candidates[panelId].analysis : results?.baseline.analysis;
    const brace = createBraceMember(panelId ?? 'P2');
    const members = [...baseline.members, brace].map(member => ({ id: member.id,
      a: nodes.findIndex(n => n.id === member.startNodeId), b: nodes.findIndex(n => n.id === member.endNodeId),
      extra: member.id === brace.id, force: analysis?.axialForceNByMember[member.id] ?? 0,
    }));
    return { nodes, members };
  }, [baseline, panelId, results]);
  const referenceMember = solution.members.find(member => member.id === selectedMemberId);
  const drawn = useMemo(() => renderV9Assembly({ instanceId, width, height, pick: Number(panelId?.slice(1) ?? 0), load: Number(loadNodeId.slice(1)),
    lift: lifted, orbit: compact ? -7 + orbit : orbit, pitch: compact ? 1 + pitch : pitch, zoom: camera.zoom, panX: camera.x, panY: camera.y, detail, locked, solution,
    ...(referenceMember ? { referenceMember } : {}), ...(isolated ? { isolatedPart: isolated } : {}),
    showLabels: labels, showDimensions: dimensions,
  }), [instanceId, width, height, panelId, loadNodeId, lifted, orbit, pitch, compact, camera, detail, locked, solution, referenceMember, isolated, labels, dimensions]);
  useEffect(() => {
    const canvas = lightingRef.current; if (canvas) canvas.hidden = true;
    const requestId = ++lightingGeneration.current;
    if (!drawn.lighting || isolated || !lightingWorker.current) return;
    const timer = window.setTimeout(() => lightingWorker.current?.postMessage({ requestId, geometry: drawn.lighting }), 62);
    return () => window.clearTimeout(timer);
  }, [drawn.lighting, isolated]);
  const selectedStyle = part && !isolated ? `<style>#${instanceId} [data-forma-part="${part}"]{filter:drop-shadow(0 0 1.15px #497890)}</style>` : '';
  const isolation = isolated ? `<style>#${instanceId} [data-forma-part]{display:none}#${instanceId} [data-forma-part="${isolated}"]{display:inline}#${instanceId} [data-forma-ground],#${instanceId} [data-forma-overlay],#${instanceId} [data-forma-hit]{display:none}</style>` : '';
  const topControls = <div className="assembly-toolbar" role="group" aria-label="Assembly inspection">
    <button type="button" aria-pressed={!detail && !lifted} onClick={() => changeView(false, false)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m2 8 8-4 8 4-8 4zM2 8v4l8 4 8-4V8m-8 4v4" /></svg>Assembled</button>
    <button type="button" aria-pressed={!detail && lifted} onClick={() => changeView(false, true)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m2 5.7 8-3.6 8 3.6-8 3.6zm0 7.5 8 3.7 8-3.7M3.5 9.1v1.3m13-1.3v1.3M10 11v1.4" /></svg>Open bay</button>
    <button type="button" aria-pressed={detail} onClick={() => changeView(true, true)}><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m12.5 12.5 4.3 4.3" /><circle cx="8.5" cy="8.5" r="1.45" /></svg>Joint detail</button>
  </div>;
  return <figure className={`model-view${compact ? ' model-view-compact' : ''}`}>
    {!compact && (controlsHost ? createPortal(topControls, controlsHost) : topControls)}
    <div className="assembly-scene" ref={sceneRef}>
      {!compact && <div className="assembly-specimen v8-specimen"><h1>{detail ? 'Brace connection' : 'Four-panel truss'}</h1><p>{detail ? `Panel ${panelId?.slice(1) ?? '2'} · exploded joint detail` : 'Tabletop model · 240 mm span'}</p></div>}
      <svg id={instanceId} ref={svgRef} className="model-view-svg assembly" role="img" aria-label={`Load at ${loadNodeId}${panelId ? `, brace in ${panelId}` : ''}. ${drawn.ariaLabel}`} viewBox={drawn.viewBox}
        style={{ touchAction: 'none', cursor: 'grab', overflow: 'hidden' }}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          drag.current = { x: event.clientX, y: event.clientY, moved: false, target: event.target instanceof Element ? event.target : null };
          if (touches.current.size > 1) { const [a, b] = [...touches.current.values()]; if (a && b) pinch.current = Math.hypot(a.x - b.x, a.y - b.y); }
        }}
        onPointerMove={event => {
          const d = drag.current; if (!d || !touches.current.has(event.pointerId)) return;
          touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          if (touches.current.size > 1) {
            const [a, b] = [...touches.current.values()];
            if (a && b) { const distance = Math.hypot(a.x - b.x, a.y - b.y), p = point((a.x + b.x) / 2, (a.y + b.y) / 2); if (pinch.current) zoomAt(distance / pinch.current, p.x, p.y); pinch.current = distance; d.moved = true; }
            return;
          }
          const dx = event.clientX - d.x, dy = event.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < 4) return;
          d.moved = true;
          if (event.shiftKey) { const a = point(d.x, d.y), b = point(event.clientX, event.clientY); setCamera(c => ({ ...c, x: c.x + b.x - a.x, y: c.y + b.y - a.y })); }
          else { setOrbit(o => (o + dx * .4) % 360); const homePitch = .665 * 180 / Math.PI; setPitch(p => Math.max(-88 - homePitch, Math.min(88 - homePitch, p + dy * .32))); }
          d.x = event.clientX; d.y = event.clientY;
        }}
        onPointerUp={event => {
          const d = drag.current;
          if (d && !d.moved && touches.current.size === 1) {
            const id = d.target?.closest('[data-forma-part]')?.getAttribute('data-forma-part') as Part | null;
            const member = d.target?.closest('[data-member]')?.getAttribute('data-member');
            onSelectMember?.(member ?? null);
            if (id && id in PARTS) selectPart(id);
          }
          touches.current.delete(event.pointerId); pinch.current = null; if (!touches.current.size) drag.current = null;
        }}
        onPointerCancel={() => { touches.current.clear(); drag.current = null; pinch.current = null; }}
        dangerouslySetInnerHTML={{ __html: isolation + selectedStyle + drawn.svgInner }} />
      <canvas ref={lightingRef} className="assembly-studio-light" aria-hidden="true" hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />
    </div>
    {!compact && <>
      <div className="assembly-inspector assembly-materials v8-materials" aria-label="Illustrative assembly finishes">
        <div className="forma-parts-control" role="group" aria-label="Assembly components">
          <label htmlFor={`${instanceId}-part`}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m2 5 6-3 6 3-6 3Zm0 3 6 3 6-3M2 11l6 3 6-3" /></svg>Parts</label>
          <select id={`${instanceId}-part`} aria-label="Select component" value={part} onChange={event => { const value = event.target.value as Part | ''; if (value) selectPart(value); else setPart(''); }}><option value="">Choose a part</option>{(detail ? JOINT_PARTS : ASSEMBLY_PARTS).filter(id => id !== 'brace' || panelId).map(id => <option key={id} value={id}>{PARTS[id][0]}</option>)}</select>
          <button type="button" disabled={!part} hidden={!!isolated} onClick={() => part && setIsolated(part)}>Isolate</button>
          <button type="button" hidden={!isolated} onClick={() => { setIsolated(null); setPart(''); }}>Show all</button>
        </div>
        <small>Visual finishes</small>
        <span className="material-chip"><i className="material-steel v8-metal-frame" />{detail ? 'Cheek plates' : 'Truss frame'}</span>
        <span className="material-chip"><i className="material-deck v8-metal-deck" />{detail ? 'Pin' : 'Deck cassette'}</span>
        {!detail && <span className="material-chip"><i className="material-spacer finish-spacer" />Spacer</span>}
        <span className="material-chip v8-brace-key"><i className="material-brass v8-metal-brace" />{detail ? 'Brace eye' : 'Trial brace'}</span>
      </div>
      <div className="assembly-camera-bar v8-status">
        <span className="camera-gesture fs-gestures"><span className="fs-mouse">Drag to orbit · Scroll to zoom</span><span className="fs-touch">Drag to orbit · Pinch to zoom</span></span>
        <span className="assembly-scope">{detail ? 'Exploded connection · illustrative hardware' : 'Front truss analyzed · deck and hardware illustrative'}</span>
        <div className="assembly-zoom fs-shelf" role="group" aria-label="Viewport controls">
          <button type="button" className="fs-icon" aria-label="Fit view" title="Fit view" onClick={() => { setCamera({ zoom: 1, x: 0, y: 0 }); setOrbit(0); setPitch(0); }}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M3.5 7V3.5H7m6 0h3.5V7m0 6v3.5H13m-6 0H3.5V13" /><path d="m7.5 10 2.5-2.5 2.5 2.5-2.5 2.5z" /></svg></button>
          <div className="fs-zoom" role="group" aria-label="Zoom">
            <button type="button" className="fs-icon" aria-label="Zoom out" title="Zoom out" onClick={() => zoomAt(.8, width / 2, height / 2)}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M5 10h10" /></svg></button>
            <span aria-label="Current zoom">{Math.round(camera.zoom * 100)}%</span>
            <button type="button" className="fs-icon" aria-label="Zoom in" title="Zoom in" onClick={() => zoomAt(1.25, width / 2, height / 2)}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M5 10h10m-5-5v10" /></svg></button>
          </div>
          <button type="button" className="assembly-overlays" aria-label="Viewport overlays" aria-expanded={overlaysOpen} aria-controls={`${instanceId}-overlays`} onClick={() => setOverlaysOpen(v => !v)}><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m3 7 7-4 7 4-7 4zM3 10.5l7 4 7-4M3 14l7 4 7-4" /></svg><span>Overlays</span><svg aria-hidden="true" className="fs-chevron" viewBox="0 0 12 12"><path d="m3 7 3-3 3 3" /></svg></button>
          <div className="pop fs-options" id={`${instanceId}-overlays`} role="group" aria-label="Viewport overlay settings" hidden={!overlaysOpen}>
            <label><input type="checkbox" checked={labels} onChange={event => setLabels(event.target.checked)} />Model labels</label>
            <label><input type="checkbox" checked={dimensions} onChange={event => setDimensions(event.target.checked)} />Dimensions</label>
            <label className="fs-range"><span>Zoom</span><input aria-label="Zoom" type="range" min="45" max="450" step="1" value={Math.round(camera.zoom * 100)} onChange={event => zoomAt(Number(event.target.value) / 100 / camera.zoom, width / 2, height / 2)} /></label>
          </div>
        </div>
      </div>
    </>}
  </figure>;
}
