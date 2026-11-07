import type { Analysis, AnalysisError, AnalysisErrorCode, Design, LoadCase, PanelId } from '../shared';
import type { AnalysisSuccess, Design as EngineDesign, InvalidResult, PanelId as EnginePanelId } from '../engines/main/types';
import { analysisError } from './errors';

/** Result provenance changes when the engine changes, even with the same preset. */
export const SOLVER_VERSION = 'astra-truss-main-9a9c2d8';
export const ENGINE_PANEL: Readonly<Record<PanelId, EnginePanelId>> = { P1: 'panel-1', P2: 'panel-2', P3: 'panel-3', P4: 'panel-4' };
export const APP_PANEL: Readonly<Record<EnginePanelId, PanelId>> = { 'panel-1': 'P1', 'panel-2': 'P2', 'panel-3': 'P3', 'panel-4': 'P4' };

/** Units, IDs, geometry and physical inputs pass through without rescaling. */
export function toEngineDesign(design: Design): EngineDesign {
  return {
    id: design.id, presetVersion: design.presetVersion, members: design.members, stocks: design.stocks,
    nodes: design.nodes.map(node => ({ id: node.id, x: node.xMm, y: node.yMm })),
    supports: design.nodes.filter(node => node.restrained.x || node.restrained.y).map(node => ({ nodeId: node.id, fixedX: node.restrained.x, fixedY: node.restrained.y })),
    braceOptions: [],
  };
}

export function fromEngineAnalysis(result: AnalysisSuccess, load: LoadCase): Analysis {
  return { status: 'ok', solverVersion: SOLVER_VERSION,
    displacementMmByNode: result.displacementsMm, reactionNByNode: result.reactionsN,
    axialForceNByMember: result.memberForcesN, loadedJointDisplacementMm: Math.abs(result.displacementsMm[load.nodeId]!.y) };
}

export function fromEngineError(result: InvalidResult): AnalysisError {
  const first = result.issues[0];
  const code: AnalysisErrorCode = first?.code === 'singular-system' ? 'UNSTABLE'
    : first?.code === 'numerical-failure' ? 'NUMERICAL_FAILURE'
      : first?.code === 'invalid-stock' ? 'INVALID_STOCK' : 'INVALID_INPUT';
  const ids = (collection: string) => result.issues.flatMap(issue => {
    const parts = issue.path.split('.'), index = parts.indexOf(collection);
    return index >= 0 && parts[index + 1] ? [parts[index + 1]!] : [];
  });
  return analysisError(code, result.issues.map(issue => issue.message).join(' '), ids('nodes'), ids('members'));
}
