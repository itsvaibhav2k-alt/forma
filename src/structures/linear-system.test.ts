import { expect, it } from 'vitest';
import { solveStiffness } from './linear-system';

it('swaps rows during elimination of a positive definite system and preserves the RHS permutation', () => {
  // The second-column pivot below the diagonal is 0.35, larger than 0.19.
  // With x=[1,-2,3], direct multiplication gives b=[0.7,1.3,1.9].
  const matrix = [[1, 0.9, 0.5], [0.9, 1, 0.8], [0.5, 0.8, 1]].map(row => Float64Array.from(row));
  const result = solveStiffness(matrix, Float64Array.from([0.7, 1.3, 1.9]));
  expect(result).toBeInstanceOf(Float64Array);
  if (!(result instanceof Float64Array)) throw new Error(result.message);
  [1, -2, 3].forEach((value, i) => expect(result[i]).toBeCloseTo(value, 12));
  expect(Array.from(matrix[1]!)).toEqual([0.9, 1, 0.8]);
});
