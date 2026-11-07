import { PANEL_IDS, type PanelId, type RankedBraces } from '../shared';
import { formatChange, formatForce, formatMm, panelRank, verdictLead } from './format';

export function Results({ results, panelId, isRetest }: { results: RankedBraces; panelId: PanelId; isRetest: boolean }) {
  const chosen = results.candidates[panelId];
  const ordered = [...PANEL_IDS].sort((a, b) => panelRank(results, a) - panelRank(results, b));
  const winners = results.bestIds.join(' + ');
  return <section className="results-card workspace-card" aria-labelledby="results-heading">
    <div className="card-heading"><h2 id="results-heading">{isRetest ? 'Same-brace retest' : 'Your prediction, tested'}</h2><span className="tag">Load {results.load.nodeId} · Brace {panelId}</span></div>
    <div className="verdict"><p className="verdict-lead">{verdictLead(results, panelId, results.load.nodeId)}</p>{!results.bestIds.includes(panelId) && <p className="verdict-note">Best here: {results.bestIds.join(' and ')} at {formatChange(results.candidates[results.bestIds[0]!].change)}.</p>}<p className="verdict-note">Linear-elastic simulation, not a safety rating.</p></div>
    <div className="result-metrics">
      <div><span>Original displacement</span><strong>{formatMm(results.baseline.analysis.loadedJointDisplacementMm)} <small>mm</small></strong></div>
      <div><span>With your {panelId} brace</span><strong>{formatMm(chosen.analysis.loadedJointDisplacementMm)} <small>mm</small></strong></div>
      <div className="gain-metric"><span>{chosen.change.kind === 'relative' ? 'Deflection reduction' : 'Absolute reduction'}</span><strong>{formatChange(chosen.change)}</strong></div>
    </div>
    <div className="ranking-heading"><h3>All four placements</h3><p>{results.bestIds.length > 1 ? 'Tied best' : 'Best placement'}: <strong>{winners}</strong></p></div>
    <table className="ranking-table"><caption className="sr-only">Brace ranking at {results.load.nodeId}. Lower vertical displacement is better.</caption>
      <thead><tr><th scope="col">Rank / panel</th><th scope="col">Displacement <span>(mm)</span></th><th scope="col">Reduction</th></tr></thead>
      <tbody>{ordered.map(id => <tr key={id} className={id === panelId ? 'chosen-row' : ''}>
        <th scope="row"><span className="rank-number">{panelRank(results, id)}</span> {id}<span className="row-badges">{id === panelId && <span>Your choice</span>}{results.bestIds.includes(id) && <span>{results.bestIds.length > 1 ? 'Tied best' : 'Best'}</span>}</span></th>
        <td>{formatMm(results.candidates[id].analysis.loadedJointDisplacementMm)}</td><td>{formatChange(results.candidates[id].change)}</td>
      </tr>)}</tbody>
    </table>
    <p className="result-note">Each option adds one equal-length brace to the original bridge. Rank uses unrounded results; displayed values are rounded.</p>
    <details className="force-details"><summary>Member forces and support reactions</summary>
      <p>Positive (+) means tension; negative (−) means compression. Reactions use positive x right and positive y up.</p>
      <div className="table-scroll"><table><caption>Axial member forces for load {results.load.nodeId}</caption><thead><tr><th scope="col">Member</th><th scope="col">Original</th><th scope="col">With {panelId}</th></tr></thead>
        <tbody>{chosen.design.members.map(member => <tr key={member.id}><th scope="row">{member.startNodeId}–{member.endNodeId}{member.id === `brace-${panelId}` ? ' (added)' : ''}</th>
          <td>{results.baseline.analysis.axialForceNByMember[member.id] === undefined ? 'Not present' : formatForce(results.baseline.analysis.axialForceNByMember[member.id]!)}</td><td>{formatForce(chosen.analysis.axialForceNByMember[member.id]!)}</td></tr>)}</tbody>
      </table></div>
      <div className="table-scroll"><table><caption>Support reactions in N</caption><thead><tr><th scope="col">Support</th><th scope="col">Original (x, y)</th><th scope="col">With {panelId} (x, y)</th></tr></thead>
        <tbody>{Object.entries(results.baseline.analysis.reactionNByNode).map(([id, reaction]) => {
          const modified = chosen.analysis.reactionNByNode[id]!;
          const pair = (x: number, y: number) => `${(Math.abs(x) < 1e-9 ? 0 : x).toFixed(3)}, ${(Math.abs(y) < 1e-9 ? 0 : y).toFixed(3)}`;
          return <tr key={id}><th scope="row">{id}</th><td>{pair(reaction.x, reaction.y)}</td><td>{pair(modified.x, modified.y)}</td></tr>;
        })}</tbody>
      </table></div>
    </details>
  </section>;
}
