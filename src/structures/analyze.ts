import type { Analyze } from '../shared';
import { analyze as mainAnalyze } from '../engines/main/analyze';
import { fromEngineAnalysis, fromEngineError, toEngineDesign } from './main-adapter';
import { validateDesign, validateLoadCase } from './validation';
export { SOLVER_VERSION } from './main-adapter';

/** Keep the app's input guard and result shape; main owns all numerical solving. */
export const analyze: Analyze = (design, load) => {
  const invalid = validateDesign(design) ?? validateLoadCase(design, load);
  if (invalid) return invalid;
  const result = mainAnalyze(toEngineDesign(design), load);
  return result.status === 'invalid' ? fromEngineError(result) : fromEngineAnalysis(result, load);
};
