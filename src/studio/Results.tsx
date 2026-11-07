import { PANEL_IDS, type PanelId, type RankedBraces } from '../shared';
import { formatChange, formatForce, formatMm, panelRank, verdictLead } from './format';

export function Results({ results, panelId, isRetest }: { results: RankedBraces; panelId: PanelId; isRetest: boolean }) {
  const chosen = results.candidates[panelId];
  const ordered = [...PANEL_IDS].sort((a, b) => panelRank(results, a) - panelRank(results, b));
  const winners = results.bestIds.join(' + ');
  return <section className="results-card dock trial-readout" aria-labelledby="results-heading">
    <h2 id="results-heading" className="sr-only">{isRetest ? 'Same-brace retest' : 'Your prediction, tested'}</h2>
    <header className="reading-head"><h3>{isRetest ? 'Retest' : 'Committed result'} · {panelId} at {results.load.nodeId}</h3></header>
    <dl className="gain-reading"><dt>Less displacement</dt><dd>{formatChange(chosen.change)}</dd></dl>
    <dl className="measured-pair"><div><dt>Original</dt><dd>{results.baseline.analysis.loadedJointDisplacementMm.toFixed(4)}<small> mm</small></dd></div><div><dt>With brace</dt><dd>{chosen.analysis.loadedJointDisplacementMm.toFixed(4)}<small> mm</small></dd></div></dl>
    <p className="sr-only">{verdictLead(results, panelId, results.load.nodeId)} Original displacement {formatMm(results.baseline.analysis.loadedJointDisplacementMm)} mm; with brace {formatMm(chosen.analysis.loadedJointDisplacementMm)} mm. {results.bestIds.length > 1 ? 'Tied best' : 'Best'}: {winners}</p>
    <details className="ranking-details"><summary aria-label="All placements, member forces and reactions">Compare all four placements<span className="sr-only">All placements, member forces and reactions</span></summary>
    <div className="ranking-heading"><h3>All four placements</h3><p>{results.bestIds.length > 1 ? 'Tied best' : 'Best placement'}: <strong>{winners}</strong></p></div>
    <table className="ranking-table"><caption className="sr-only">Brace ranking at {results.load.nodeId}. Lower vertical displacement is better.</caption>
      <thead><tr><th scope="col">Rank / panel</th><th scope="col">Displacement <span>(mm)</span></th><th scope="col">Reduction</th></tr></thead>
      <tbody>{ordered.map(id => <tr key={id} className={id === panelId ? 'chosen-row' : ''}>
        <th scope="row"><span className="rank-number">{panelRank(results, id)}</span> {id}<span className="row-badges">{id === panelId && <span>Your choice</span>}{results.bestIds.includes(id) && <span>{results.bestIds.length > 1 ? 'Tied best' : 'Best'}</span>}</span></th>
        <td>{formatMm(results.candidates[id].analysis.loadedJointDisplacementMm)}</td><td>{formatChange(results.candidates[id].change)}</td>
      </tr>)}</tbody>
    </table>
    <p className="result-note">Displacement is how far the loaded joint moves down under the 10 N load; lower is better. Reduction compares each brace with the unbraced bridge. Each option adds one equal-length brace to the original bridge. Rank uses unrounded results; displayed values are rounded.</p>
    <details className="force-details"><summary>Member forces and support reactions</summary>
      <p>Positive (+) means tension; negative (−) means compression. Reactions use positive x right and positive y up.</p>
      <div className="table-scroll"><table><caption>Axial member forces for load {results.load.nodeId}</caption><thead><tr><th scope="col">Member</th><th scope="col">Original</th><th scope="col">With {panelId}</th></tr></thead>
        <tbody>{chosen.design.members.map(member => <tr key={member.id}><th scope="row">{member.startNodeId}–{member.endNodeId}{member.id === `brace-${panelId}` ? ' (added)' : ''}</th>
          <td>{!results.baseline.design.members.some(original => original.id === member.id) ? 'Not present' : formatForce(results.baseline.analysis.axialForceNByMember[member.id])}</td><td>{formatForce(chosen.analysis.axialForceNByMember[member.id])}</td></tr>)}</tbody>
      </table></div>
      <div className="table-scroll"><table><caption>Support reactions in N</caption><thead><tr><th scope="col">Support</th><th scope="col">Original (x, y)</th><th scope="col">With {panelId} (x, y)</th></tr></thead>
        <tbody>{Object.entries(results.baseline.analysis.reactionNByNode).map(([id, reaction]) => {
          const modified = chosen.analysis.reactionNByNode[id];
          const value = (n: number | undefined) => n === undefined || !Number.isFinite(n) ? 'Unknown' : (Math.abs(n) < 1e-9 ? 0 : n).toFixed(3);
          const pair = (x: number | undefined, y: number | undefined) => `${value(x)}, ${value(y)}`;
          return <tr key={id}><th scope="row">{id}</th><td>{pair(reaction.x, reaction.y)}</td><td>{pair(modified?.x, modified?.y)}</td></tr>;
        })}</tbody>
      </table></div>
    </details>
    </details>
  </section>;
}
