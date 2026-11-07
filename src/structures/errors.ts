import type { AnalysisError, AnalysisErrorCode } from '../shared';

export function analysisError(
  code: AnalysisErrorCode,
  message: string,
  nodeIds: readonly string[] = [],
  memberIds: readonly string[] = [],
): AnalysisError {
  return { status: 'error', code, message, nodeIds, memberIds };
}
