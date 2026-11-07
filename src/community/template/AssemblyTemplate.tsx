import { useLayoutEffect, useRef, useState } from 'react';
import type { AssemblyPattern } from './pattern';
import './template.css';

export function AssemblyTemplate({ pattern }: { pattern: AssemblyPattern }) {
  const svg = useRef<SVGSVGElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const [fits, setFits] = useState(false);
  useLayoutEffect(() => {
    const page = sheet.current;
    if (!page) return;
    // Letter landscape minus 10 mm margins, with a little height allowance.
    const measure = () => {
      // Native print hides overfull paper. Do not reinterpret that zero-sized
      // hidden layout as fitting and accidentally unblock the print guard.
      if (typeof window.matchMedia === 'function' && window.matchMedia('print').matches) return;
      setFits(page.scrollHeight <= 194 * 96 / 25.4 && page.scrollWidth <= 254 * 96 / 25.4 + 1);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(page);
    return () => observer?.disconnect();
  }, [pattern]);
  const nodes = new Map(pattern.design.nodes.map(node => [node.id, node]));
  const x = (value: number) => 7 + value - pattern.minX;
  const y = (value: number) => 20 + pattern.maxY - value;
  const groups = [...new Set(pattern.members.map(member => member.group))];
  function download() {
    if (!svg.current) return;
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg.current)], { type: 'image/svg+xml' }));
    const link = document.createElement('a'); link.href = url; link.download = `forma-assembly-${pattern.addedMemberId ?? 'original'}.svg`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="template-preview" data-print-fits={fits}><div className="template-actions"><div><h2>One side-panel pattern</h2><p>Print separately on US Letter landscape at 100% / actual size. Disable fit-to-page and browser headers/footers. Measure the 100 mm check bar on the actual print before using the pattern.</p><p>This captured geometry stays fixed when you change trials. A printer calibration check is still required; this screen cannot verify physical scale.</p></div><div><button className="primary-button" type="button" disabled={!fits} onClick={() => window.print()}>Print assembly template</button><button className="outline-button" type="button" onClick={download}>Download 1:1 SVG</button></div></div>
    {!fits && <p className="report-overflow" role="alert">This layout exceeds the landscape Letter allowance. Use the SVG in an application that preserves millimeter dimensions, print at 100%, and verify its check bar. Do not shrink to fit.</p>}
    <div className="template-paper-scroll"><article ref={sheet} className="assembly-sheet" aria-label="Captured assembly template">
      <header><p>FORMA / OPTIONAL ASSEMBLY PATTERN</p><h1>{pattern.label} · one modeled side</h1><p>Design {pattern.design.id} · {pattern.design.presetVersion} · span {pattern.spanMm} mm · height {pattern.heightMm} mm</p></header>
      <svg ref={svg} xmlns="http://www.w3.org/2000/svg" width="254mm" height="100mm" viewBox="0 0 254 100" role="img" aria-label={`${pattern.label} assembly pattern, 1 SVG unit equals 1 mm, with a 100 mm check bar`} fontFamily="Arial, sans-serif" fill="black">
        <title>Forma {pattern.label} — actual-size side panel with calibration bar</title><desc>Geometry in millimeters, undeformed. Print at 100 percent. Solid dots are joints; interrupted diagonal crossings are not joined. Verify the check bar measures 100 mm before assembly.</desc>
        <text x="7" y="5" fontSize="3.1">{pattern.label} · {pattern.spanMm} × {pattern.heightMm} mm · 100% / actual size</text>
        {pattern.members.map(member => { const a = nodes.get(member.start)!, b = nodes.get(member.end)!; return <line key={member.id} data-member-id={member.id} x1={x(a.xMm)} y1={y(a.yMm)} x2={x(b.xMm)} y2={y(b.yMm)} stroke="black" strokeWidth={member.id === pattern.addedMemberId ? 0.55 : 0.35} strokeDasharray={member.id === pattern.addedMemberId ? '2 1' : undefined}><title>{member.start}–{member.end}: {member.lengthMm.toFixed(3)} mm center to center</title></line>; })}
        {pattern.crossings.map((crossing, i) => <g key={i} data-crossing="unconnected"><circle cx={x(crossing.x)} cy={y(crossing.y)} r="1.2" fill="white" /><line x1={x(crossing.x - crossing.dx * 1.4)} y1={y(crossing.y - crossing.dy * 1.4)} x2={x(crossing.x + crossing.dx * 1.4)} y2={y(crossing.y + crossing.dy * 1.4)} stroke="black" strokeWidth="0.35" /></g>)}
        {pattern.design.nodes.map(node => <g key={node.id} data-node-id={node.id}><circle cx={x(node.xMm)} cy={y(node.yMm)} r="0.7" fill="black" /><text x={x(node.xMm)} y={y(node.yMm) + (node.yMm === pattern.maxY ? -3 : 5)} textAnchor="middle" fontSize="3">{node.id}</text></g>)}
        <text x="7" y="73" fontSize="2.8">Dots = joints. Diagonal crossings are NOT joints. Dashed heavy line = added brace.</text>
        <path data-check-bar-mm="100" d="M7 82 H107 M7 79 V85 M107 79 V85" fill="none" stroke="black" strokeWidth="0.3" />
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${17 + i * 10} 81 V83`} stroke="black" strokeWidth="0.2" />)}
        <text x="7" y="90" fontSize="3">CHECK BAR: 100 mm — measure the actual print with a ruler.</text><text x="7" y="96" fontSize="2.8">Do not use a scaled-to-fit print. Pattern is undeformed; no displacement magnification.</text>
      </svg>
      <table className="assembly-lengths"><caption>Member lengths from the captured geometry — center to center</caption><thead><tr><th>Group</th><th>Node pairs</th><th>Length (mm)</th></tr></thead><tbody>{groups.map(group => { const members = pattern.members.filter(member => member.group === group); return <tr key={group}><th scope="row">{group} ({members.length})</th><td>{members.map(member => `${member.start}–${member.end}`).join(', ')}</td><td>{[...new Set(members.map(member => member.lengthMm.toFixed(3)))].join(', ')}</td></tr>; })}</tbody></table>
      <footer><p>Only labeled nodes are joints. Keep diagonal crossings unconnected; the drawing gap marks a crossing, not a cut or missing member. Center-to-center lengths are not cut lengths: allow separately for joint details and overlap.</p><p>This is a tabletop positioning pattern for one side, not a complete physical construction or full-size structural design. Verify material, joints, load sharing and actual printer scale. Separate from the decision sheet.</p><p>Captured trial: {pattern.trialId}. B0 pin and B4 vertical roller are model assumptions; reproduce and document physical supports separately.</p></footer>
    </article></div>
  </div>;
}
