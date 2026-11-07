import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import origin from '../engines/main/origin.json';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
it.each(origin.files)('uses main commit ' + origin.commit + ': $sourcePath unchanged except its type import', file => {
  const relative = file.sourcePath.startsWith('src/community') ? '../../shared' : '../shared';
  const restored = readFileSync(resolve(root, file.localPath), 'utf8').replace("from './types'", `from '${relative}'`);
  expect(createHash('sha256').update(restored).digest('hex')).toBe(file.sha256);
});
