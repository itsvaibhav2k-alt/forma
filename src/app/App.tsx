import { useEffect, useMemo, useState } from 'react';
import { JUDGE_PRESET, type Design, type PanelId } from '../shared';
import { simulateVehicleAtPosition, simulateVehiclePass, type Vehicle } from '../vehicles';
import './app.css';

const deckNodeIds = ['b0', 'b1', 'b2', 'b3', 'b4'] as const;
const panelChoices: readonly (PanelId | 'original')[] = ['original', 'panel-1', 'panel-2', 'panel-3', 'panel-4'];

function withBrace(panelId: PanelId | 'original'): Design {
  if (panelId === 'original') return JUDGE_PRESET.design;
  const option = JUDGE_PRESET.design.braceOptions.find((brace) => brace.panelId === panelId)!;
  return { ...JUDGE_PRESET.design, id: `${JUDGE_PRESET.design.id}+${panelId}`, members: [...JUDGE_PRESET.design.members, option.member] };
}

const memberColor = (stress: number, maximum: number): string => {
  if (maximum === 0 || Math.abs(stress) / maximum < 0.04) return '#94a3b8';
  return stress > 0 ? '#2563eb' : '#dc2626';
};

export function App() {
  const [centerXMm, setCenterXMm] = useState(120);
  const [totalLoadN, setTotalLoadN] = useState(2);
  const [wheelbaseMm, setWheelbaseMm] = useState(50);
  const [panelId, setPanelId] = useState<PanelId | 'original'>('original');
  const [driving, setDriving] = useState(false);
  const design = useMemo(() => withBrace(panelId), [panelId]);
  const vehicle: Vehicle = useMemo(() => ({
    id: 'demo-vehicle', label: 'Two-axle demonstration vehicle',
    axles: [
      { offsetMm: -wheelbaseMm / 2, loadN: totalLoadN / 2 },
      { offsetMm: wheelbaseMm / 2, loadN: totalLoadN / 2 },
    ],
  }), [totalLoadN, wheelbaseMm]);
  const minimum = wheelbaseMm / 2;
  const maximum = 240 - wheelbaseMm / 2;
  useEffect(() => { setCenterXMm((current) => Math.min(maximum, Math.max(minimum, current))); }, [minimum, maximum]);
  useEffect(() => {
    if (!driving) return undefined;
    const timer = window.setInterval(() => setCenterXMm((current) => {
      if (current >= maximum) { setDriving(false); return maximum; }
      return Math.min(maximum, current + 2);
    }), 40);
    return () => window.clearInterval(timer);
  }, [driving, maximum]);
  const result = useMemo(() => simulateVehicleAtPosition(design, deckNodeIds, vehicle, centerXMm), [centerXMm, design, vehicle]);
  const pass = useMemo(() => simulateVehiclePass(design, deckNodeIds, vehicle, 49), [design, vehicle]);
  const stressMaximum = result.status === 'ok'
    ? Math.max(...Object.values(result.memberStresses).map(({ stressNPerMm2 }) => Math.abs(stressNPerMm2))) : 0;
  const topStresses = result.status === 'ok' ? Object.values(result.memberStresses)
    .sort((a, b) => Math.abs(b.stressNPerMm2) - Math.abs(a.stressNPerMm2)).slice(0, 5) : [];
  const nodes = new Map(design.nodes.map((node) => [node.id, node]));
  const svgPoint = (nodeId: string) => ({ x: nodes.get(nodeId)!.x + 30, y: 165 - nodes.get(nodeId)!.y });
  return (
    <main className="vehicle-lab">
      <header>
        <p className="eyebrow">Forma physics lab</p>
        <h1>Drive a vehicle across the bridge</h1>
        <p>Move two axle loads across the truss and inspect calculated axial stress at every position.</p>
      </header>

      <section className="bridge-card" aria-labelledby="bridge-title">
        <div className="card-heading">
          <div><h2 id="bridge-title">Live stress view</h2><p>Blue = tension · Red = compression · N/mm² = MPa</p></div>
          {result.status === 'ok' && <strong>{result.criticalMember.memberId}: {result.criticalMember.stressNPerMm2.toFixed(3)} MPa</strong>}
        </div>
        <svg viewBox="0 0 300 205" role="img" aria-label="Bridge members colored by calculated axial stress">
          <line x1="30" y1="165" x2="270" y2="165" className="deck-guide" />
          {design.members.map((member) => {
            const start = svgPoint(member.startNodeId); const end = svgPoint(member.endNodeId);
            const stress = result.status === 'ok' ? result.memberStresses[member.id]!.stressNPerMm2 : 0;
            return <line key={member.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}
              stroke={memberColor(stress, stressMaximum)} strokeWidth={3 + 3 * Math.abs(stress) / Math.max(stressMaximum, Number.EPSILON)} />;
          })}
          {design.nodes.map((node) => <circle key={node.id} cx={node.x + 30} cy={165 - node.y} r="4" />)}
          <g transform={`translate(${centerXMm + 30} 0)`} className="vehicle">
            <rect x={-wheelbaseMm / 2 - 12} y="137" width={wheelbaseMm + 24} height="15" rx="5" />
            <path d={`M ${-wheelbaseMm / 4} 137 L ${-wheelbaseMm / 8} 126 H ${wheelbaseMm / 4} L ${wheelbaseMm / 2} 137`} />
            <circle cx={-wheelbaseMm / 2} cy="158" r="6" /><circle cx={wheelbaseMm / 2} cy="158" r="6" />
          </g>
        </svg>
        <label className="position-control">Vehicle center: <output>{centerXMm.toFixed(0)} mm</output>
          <input aria-label="Vehicle center position" type="range" min={minimum} max={maximum} step="1" value={centerXMm}
            onChange={(event) => { setDriving(false); setCenterXMm(Number(event.target.value)); }} />
        </label>
        <div className="button-row">
          <button onClick={() => { setCenterXMm(minimum); setDriving(true); }} disabled={driving}>▶ Drive vehicle</button>
          <button className="secondary" onClick={() => { setDriving(false); setCenterXMm(pass.status === 'ok' ? pass.worst.centerXMm : 120); }}>Jump to worst case</button>
        </div>
      </section>

      <section className="controls-card" aria-labelledby="setup-title">
        <h2 id="setup-title">Test setup</h2>
        <div className="control-grid">
          <label>Total vehicle load (N)<input type="number" min="0.1" step="0.1" value={totalLoadN}
            onChange={(event) => setTotalLoadN(event.target.value === '' ? 0 : Number(event.target.value))}
            onBlur={() => setTotalLoadN((value) => Number.isFinite(value) ? Math.max(0.1, value) : 0.1)} /></label>
          <label>Wheelbase (mm)<input type="number" min="10" max="220" step="5" value={wheelbaseMm}
            onChange={(event) => setWheelbaseMm(event.target.value === '' ? 0 : Number(event.target.value))}
            onBlur={() => setWheelbaseMm((value) => Number.isFinite(value) ? Math.min(220, Math.max(10, value)) : 10)} /></label>
          <label>Bridge design<select value={panelId} onChange={(event) => setPanelId(event.target.value as PanelId | 'original')}>
            {panelChoices.map((choice) => <option key={choice} value={choice}>{choice === 'original' ? 'Original bridge' : `Add brace in ${choice.replace('-', ' ')}`}</option>)}
          </select></label>
        </div>
        {pass.status === 'ok' && <p className="worst-summary">Worst sampled position: <strong>{pass.worst.centerXMm.toFixed(1)} mm</strong> · {pass.worst.criticalMember.memberId} · {pass.worst.criticalMember.stressNPerMm2.toFixed(3)} MPa</p>}
        <h3>Most stressed members now</h3>
        <ol className="stress-list">{topStresses.map((stress) => <li key={stress.memberId}>
          <span>{stress.memberId}</span><strong className={stress.mode}>{stress.stressNPerMm2.toFixed(3)} MPa</strong>
        </li>)}</ol>
        <p className="disclaimer">Quasi-static linear-elastic model. It does not include impact, vibration, suspension, buckling, yielding, or safety factors and is not a load-capacity certification.</p>
      </section>
    </main>
  );
}
