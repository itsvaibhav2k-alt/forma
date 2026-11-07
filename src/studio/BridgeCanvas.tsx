import { useLayoutEffect, useRef, useState } from 'react';
import { LOAD_NODE_IDS, PANEL_IDS, type Analysis, type Design, type LoadNodeId, type PanelId, type RankedBraces } from '../shared';
import { createBraceMember } from '../structures';
import { renderPlanarV4, type PlanarSolution } from './v9Planar.js';

export const DEFORMATION_SCALE = 250;
const LOAD_X = [205, 340, 475] as const;
export function snapLoadAtSvgX(x: number): LoadNodeId {
  const index = LOAD_X.reduce((nearest, value, i) => Math.abs(x - value) < Math.abs(x - LOAD_X[nearest]!) ? i : nearest, 0);
  return LOAD_NODE_IDS[index]!;
}
export interface BridgeCanvasProps {
  baseline: Design; loadNodeId: LoadNodeId; panelId: PanelId | null; results: RankedBraces | null;
  comparison: 'both' | 'original' | 'modified'; showDeformation: boolean; showForces: boolean;
  locked: boolean; readOnly?: boolean; onLoadChange: (id: LoadNodeId) => void;
  onPanelChange: (id: PanelId) => void; selectedMemberId?: string | null; onSelectMember?: (id: string) => void;
}

/** Adapt real application geometry/results; the reference renderer contains no solver. */
export function toPlanarSolution(design: Design, analysis?: Analysis): PlanarSolution {
  const nodes = [...design.nodes].sort((a, b) => {
    const index = (id: string) => Number(id.slice(1)) + (id.startsWith('T') ? 5 : 0);
    return index(a.id) - index(b.id);
  });
  return {
    nodes: nodes.map(node => ({ id: node.id, x: node.xMm, y: node.yMm, ux: analysis?.displacementMmByNode[node.id]?.x ?? 0, uy: analysis?.displacementMmByNode[node.id]?.y ?? 0 })),
    members: design.members.map(member => ({ id: member.id, a: nodes.findIndex(node => node.id === member.startNodeId), b: nodes.findIndex(node => node.id === member.endNodeId), extra: member.id.startsWith('brace-'), force: analysis?.axialForceNByMember[member.id] ?? 0 })),
    reactions: Object.fromEntries(Object.entries(analysis?.reactionNByNode ?? { B0: { x: 0, y: 0 }, B4: { x: 0, y: 0 } })),
  };
}

export function BridgeCanvas({ baseline, loadNodeId, panelId, results, comparison, showDeformation, showForces, locked, readOnly = false, onLoadChange, onPanelChange, selectedMemberId, onSelectMember }: BridgeCanvasProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 680, height: 600 });
  const [camera, setCamera] = useState({ zoom: 1, panX: 0, panY: 0 });
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene || typeof ResizeObserver === 'undefined') return;
    const update = () => { const bounds = scene.getBoundingClientRect(); if (bounds.width > 0 && bounds.height > 0) setSize({ width: Math.round(bounds.width), height: Math.round(bounds.height) }); };
    const observer = new ResizeObserver(update); observer.observe(scene); update();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const zoomAt = (factor: number, clientX: number, clientY: number) => {
      const bounds = scene.getBoundingClientRect();
      const px = clientX - bounds.left, py = clientY - bounds.top;
      const ox = bounds.width / 2, oy = (bounds.height - Math.min(30, bounds.height * .12)) / 2 + 1;
      setCamera(current => { const zoom = Math.max(.45, Math.min(4.5, current.zoom * factor)); const ratio = zoom / current.zoom; return { zoom, panX: px - ox - (px - ox - current.panX) * ratio, panY: py - oy - (py - oy - current.panY) * ratio }; });
    };
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoomAt(Math.exp(-event.deltaY * (event.ctrlKey ? .008 : .0015)), event.clientX, event.clientY); };
    const touches = new Map<number, { x: number; y: number }>(); let distance = 0;
    const down = (event: PointerEvent) => { if (event.pointerType === 'touch') { touches.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (touches.size === 2) { const [a, b] = [...touches.values()]; distance = Math.hypot(a!.x - b!.x, a!.y - b!.y); } } };
    const move = (event: PointerEvent) => { if (!touches.has(event.pointerId)) return; touches.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (touches.size === 2) { event.preventDefault(); const [a, b] = [...touches.values()]; const next = Math.hypot(a!.x - b!.x, a!.y - b!.y); if (distance > 0) zoomAt(next / distance, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2); distance = next; } };
    const up = (event: PointerEvent) => { touches.delete(event.pointerId); distance = 0; };
    scene.addEventListener('wheel', wheel, { passive: false }); scene.addEventListener('pointerdown', down); scene.addEventListener('pointermove', move, { passive: false }); scene.addEventListener('pointerup', up); scene.addEventListener('pointercancel', up);
    return () => { scene.removeEventListener('wheel', wheel); scene.removeEventListener('pointerdown', down); scene.removeEventListener('pointermove', move); scene.removeEventListener('pointerup', up); scene.removeEventListener('pointercancel', up); };
  }, []);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const focused = document.activeElement;
    const restoreLoadFocus = focused?.hasAttribute('data-planar-load');
    const restoreMemberFocus = focused instanceof Element ? focused.getAttribute('data-member-id') : null;
    const original = toPlanarSolution(baseline, results?.baseline.analysis);
    const candidate = panelId && results ? results.candidates[panelId] : null;
    const modified = comparison === 'original' && showForces ? original : candidate ? toPlanarSolution(candidate.design, candidate.analysis) : toPlanarSolution({ ...baseline, members: [...baseline.members, ...(panelId ? [createBraceMember(panelId)] : [])] });
    const selected = modified.members.find(member => member.id === selectedMemberId);
    const pickMember = (key: string) => { const member = modified.members.find(item => `${item.a}-${item.b}` === key); if (member) onSelectMember?.(member.id); };
    renderPlanarV4(svg, {
      ...size, load: LOAD_NODE_IDS.indexOf(loadNodeId) + 1, brace: panelId ? PANEL_IDS.indexOf(panelId) + 1 : 0,
      locked: !!results, layer: results ? showForces ? 'forces' : showDeformation ? 'deformation' : 'layout' : 'layout',
      original, modified, member: selected ? `${selected.a}-${selected.b}` : null,
      showOriginal: comparison !== 'modified', showModified: comparison !== 'original', showLabels: true, showGrid: true, showDimensions: true,
      ...camera,
      onLoad: joint => { if (!readOnly) onLoadChange(LOAD_NODE_IDS[joint - 1]!); },
      onPick: panel => { if (!locked && !readOnly) onPanelChange(PANEL_IDS[panel - 1]!); }, onMember: pickMember,
    });
    svg.setAttribute('role', 'group');
    // Preserve keyboard access and real application member IDs around the original visual renderer.
    const loadHandle = svg.querySelector<SVGGElement>('[data-planar-load]');
    if (loadHandle) {
      loadHandle.setAttribute('role', 'slider'); loadHandle.setAttribute('tabindex', readOnly ? '-1' : '0');
      loadHandle.setAttribute('aria-label', 'Load position on bridge'); loadHandle.setAttribute('aria-disabled', String(readOnly));
      loadHandle.setAttribute('aria-valuemin', '1'); loadHandle.setAttribute('aria-valuemax', '3'); loadHandle.setAttribute('aria-valuenow', String(LOAD_NODE_IDS.indexOf(loadNodeId) + 1));
      loadHandle.setAttribute('aria-valuetext', `${loadNodeId}, 10 N downward`);
      loadHandle.onkeydown = event => {
        if (readOnly) return;
        const index = LOAD_NODE_IDS.indexOf(loadNodeId);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? Math.max(0, index - 1) : ['ArrowRight', 'ArrowUp'].includes(event.key) ? Math.min(2, index + 1) : null;
        if (next !== null) { event.preventDefault(); onLoadChange(LOAD_NODE_IDS[next]!); }
      };
    }
    svg.querySelectorAll<SVGGElement>('[data-planar-member]').forEach(element => {
      const member = modified.members.find(item => `${item.a}-${item.b}` === element.dataset.planarMember);
      if (!member) return;
      element.dataset.memberId = member.id; element.setAttribute('role', 'button'); element.setAttribute('tabindex', '0');
      element.setAttribute('aria-label', `Inspect member ${member.id}`); element.setAttribute('aria-pressed', String(selectedMemberId === member.id));
      element.onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelectMember?.(member.id); } };
      element.onclick = () => onSelectMember?.(member.id);
    });
    svg.querySelectorAll<SVGGElement>('[data-planar-panel]').forEach(element => {
      element.setAttribute('role', 'button'); element.setAttribute('tabindex', readOnly ? '-1' : '0');
      element.setAttribute('aria-label', `Preview brace in panel ${element.dataset.planarPanel}`);
      element.onkeydown = event => { if (!readOnly && !locked && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onPanelChange(PANEL_IDS[Number(element.dataset.planarPanel) - 1]!); } };
    });
    if (restoreLoadFocus) loadHandle?.focus();
    else if (restoreMemberFocus) [...svg.querySelectorAll<SVGGElement>('[data-member-id]')].find(element => element.dataset.memberId === restoreMemberFocus)?.focus();
  }, [baseline, loadNodeId, panelId, results, comparison, showDeformation, showForces, locked, readOnly, onLoadChange, onPanelChange, selectedMemberId, onSelectMember, size, camera]);
  return <div ref={sceneRef} className="bridge-canvas" data-zoom={camera.zoom.toFixed(3)} style={{ touchAction: 'none' }}><svg ref={svgRef} className="bridge-svg" /></div>;
}
