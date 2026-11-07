import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyCandidate } from './release-audit.mjs';

try {
  const directory = process.argv[2] ?? JSON.parse(await readFile('output/releases/latest.json', 'utf8')).directory;
  const manifest = await verifyCandidate(resolve(directory));
  console.log(JSON.stringify({ integrity: 'passed', candidateId: manifest.candidateId, sourceCommit: manifest.source.commit, sourceWasDirty: manifest.source.dirty, releaseStatus: manifest.releaseStatus }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
