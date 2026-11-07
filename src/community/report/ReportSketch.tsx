import type { Analysis, Design, Load } from '../../shared';

/** Uses the captured node/member coordinates. Both sketches share the screen's 200× magnification. */
export function ReportSketch({ design, analysis, load, title, braceId }: { design: Design; analysis: Analysis; load: Load; title: string; braceId?: string | undefined }) {
  const nodes = new Map(design.nodes.map(node => [node.id, node]));
  const point = (id: string, deformed: boolean) => {
    const node = nodes.get(id)!;
    const d = analysis.displacementMmByNode[id]!;
    return { x: 22 + node.xMm, y: 85 - node.yMm, ...(deformed ? { x: 22 + node.xMm + 200 * d.x, y: 85 - node.yMm - 200 * d.y } : {}) };
  };
  const arrow = point(load.nodeId, false);
  return <figure className="report-sketch"><figcaption>{title}</figcaption><svg viewBox="0 0 286 115" role="img" aria-label={`${title}; 10 N at ${load.nodeId}; deformation magnified 200 times`}>
    <title>{title}</title>
    {design.members.map(member => {
      const start = point(member.startNodeId, false), end = point(member.endNodeId, false);
      return <line key={`ref-${member.id}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#aaa" strokeWidth="1" />;
    })}
    {design.members.map(member => {
      const start = point(member.startNodeId, true), end = point(member.endNodeId, true);
      return <line key={member.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#111" strokeWidth={member.id === braceId ? 2.6 : 1.2} strokeDasharray={member.id === braceId ? undefined : '4 2'} />;
    })}
    {design.nodes.map(node => { const p = point(node.id, false); return <g key={node.id}><circle cx={p.x} cy={p.y} r="2" fill="#222" /><text x={p.x} y={p.y + (node.id.startsWith('B') ? 17 : -7)} textAnchor="middle" fontSize="9">{node.id}</text></g>; })}
    <path d={`M${arrow.x},12 v20 m-4,-5 l4,5 4,-5`} fill="none" stroke="#111" strokeWidth="1.6" /><text x={arrow.x + 8} y="22" fontSize="9">10 N</text>
    <path d="M17,88 l5,-3 5,3 z M257,88 l5,-3 5,3 z" fill="none" stroke="#111" /><circle cx="260" cy="91" r="1.5" stroke="#111" fill="none" /><circle cx="264" cy="91" r="1.5" stroke="#111" fill="none" />
  </svg></figure>;
}
