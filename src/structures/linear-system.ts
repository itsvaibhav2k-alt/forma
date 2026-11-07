import type { AnalysisError } from '../shared';
import { analysisError } from './errors';

// Dimensionless threshold after symmetric diagonal equilibration. Near mechanisms
// are rejected conservatively; this is not a condition-number estimate.
const PIVOT_TOLERANCE = 1e-12;

/** Solve a symmetric stiffness system using equilibration and partial-pivot elimination. */
export function solveStiffness(matrix: readonly Float64Array[], rhs: Float64Array): Float64Array | AnalysisError {
  const n = rhs.length;
  if (n === 0) return new Float64Array();
  const scale = Float64Array.from(matrix, (row, i) => Math.sqrt(row[i]!));
  if (scale.some(value => value === 0)) return analysisError('UNSTABLE', 'A free degree of freedom has no stiffness.');
  if (scale.some(value => !Number.isFinite(value))) return analysisError('NUMERICAL_FAILURE', 'Stiffness scaling is not finite.');
  const a = matrix.map((row, i) => Float64Array.from(row, (value, j) => value / scale[i]! / scale[j]!));
  const b = Float64Array.from(rhs, (value, i) => value / scale[i]!);
  if (a.some(row => row.some(value => !Number.isFinite(value))) || b.some(value => !Number.isFinite(value))) {
    return analysisError('NUMERICAL_FAILURE', 'The scaled system exceeds the supported numerical range.');
  }
  let magnitude = 0;
  for (const row of a) for (const value of row) magnitude = Math.max(magnitude, Math.abs(value));
  for (let column = 0; column < n; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(a[row]![column]!) > Math.abs(a[pivotRow]![column]!)) pivotRow = row;
    }
    const pivot = a[pivotRow]![column]!;
    if (!Number.isFinite(pivot)) return analysisError('NUMERICAL_FAILURE', 'Elimination produced a non-finite pivot.');
    if (Math.abs(pivot) <= PIVOT_TOLERANCE * magnitude) {
      return analysisError('UNSTABLE', 'The free stiffness matrix is singular or too close to a mechanism to solve reliably.');
    }
    [a[column], a[pivotRow]] = [a[pivotRow]!, a[column]!];
    [b[column], b[pivotRow]] = [b[pivotRow]!, b[column]!];
    for (let row = column + 1; row < n; row += 1) {
      const factor = a[row]![column]! / a[column]![column]!;
      a[row]![column] = 0;
      for (let j = column + 1; j < n; j += 1) a[row]![j] = a[row]![j]! - factor * a[column]![j]!;
      b[row] = b[row]! - factor * b[column]!;
    }
  }
  const solution = new Float64Array(n);
  for (let row = n - 1; row >= 0; row -= 1) {
    let value = b[row]!;
    for (let j = row + 1; j < n; j += 1) value -= a[row]![j]! * solution[j]!;
    solution[row] = value / a[row]![row]!;
  }
  for (let i = 0; i < n; i += 1) solution[i] = solution[i]! / scale[i]!;
  if (solution.some(value => !Number.isFinite(value))) return analysisError('NUMERICAL_FAILURE', 'Displacements are outside the supported numerical range.');
  return solution;
}
