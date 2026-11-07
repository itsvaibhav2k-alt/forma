import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { auditAssets, fileInventory, sha256, verifyCandidate } from './release-audit.mjs';

// Always recheck/rebuild before packaging; invoking this through npm supplies its CLI path.
if (!process.env.npm_execpath) throw new Error('Run npm run release:prepare.');
// Portable presentation candidates remain explicitly offline/session-only.
// Do not bake the developer's local or hosted backend settings into the archive.
execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'check'], { stdio: 'inherit', env: { ...process.env, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' } });
const benchmark = JSON.parse(execFileSync(process.execPath, ['scripts/benchmark-structures.mjs'], { encoding: 'utf8' }));
const assetAudit = await auditAssets(resolve('dist'));
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git(['rev-parse', 'HEAD']);
const status = git(['status', '--porcelain', '--untracked-files=all']);
const sourceFiles = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean).sort();
const sourceInventory = {};
for (const file of sourceFiles) sourceInventory[file] = await readFile(file).then(sha256).catch(error => { if (error.code === 'ENOENT') return 'deleted'; throw error; });
const sourceDigest = sha256(JSON.stringify(sourceInventory));
const candidateId = `${commit.slice(0, 7)}-${sourceDigest.slice(0, 10)}`;
const parent = resolve('output/releases');
await mkdir(parent, { recursive: true });
// Each run gets its own folder: an earlier tested candidate is never overwritten.
const directory = resolve(parent, `forma-${candidateId}-${Date.now()}`);
await mkdir(directory);
await cp('dist', resolve(directory, 'dist'), { recursive: true });
await cp('scripts/release-server.mjs', resolve(directory, 'serve.mjs'));
await cp('scripts/release-audit.mjs', resolve(directory, 'release-audit.mjs'));
await writeFile(resolve(directory, 'verify.mjs'), "import { verifyCandidate } from './release-audit.mjs';\nimport { fileURLToPath } from 'node:url';\ntry { const m = await verifyCandidate(fileURLToPath(new URL('.', import.meta.url))); console.log('Checksums verified:', m.candidateId, '\\nStatus:', m.releaseStatus); } catch (e) { console.error(e.message); process.exitCode = 1; }\n");
await cp('docs/release-checklist.md', resolve(directory, 'RELEASE-CHECKLIST.md'));
await cp('docs/demo-script.md', resolve(directory, 'DEMO-SCRIPT.md'));
await cp('docs/pdf-checklist.md', resolve(directory, 'PDF-CHECKLIST.md'));
await cp('docs/physical-checklist.md', resolve(directory, 'PHYSICAL-CHECKLIST.md'));
await writeFile(resolve(directory, 'START-HERE.txt'), `FORMA RELEASE CANDIDATE ${candidateId}\n\nNot yet approved for release: presentation-laptop and human gates remain pending.\n\nBefore leaving internet access, install a supported Node.js runtime (tested here: ${benchmark.runtime}; repository pin: 20.20.2). Extract this archive fully, then open a terminal in this folder. No npm install, network service, or node_modules is required by this bundle.\n\n1. node verify.mjs\n2. node serve.mjs\n3. Open http://127.0.0.1:4173/ in your presentation browser. Keep the terminal open.\n4. Run RELEASE-CHECKLIST.md and DEMO-SCRIPT.md on the actual laptop.\n\nIf port 4173 is occupied, stop the earlier server or set the PORT environment variable explicitly before launching. The launcher never changes ports silently and only binds 127.0.0.1.\n\nReload clears trials, quotes and captured sheets. Save PDFs/JSON outside this extracted folder so its integrity check remains meaningful. No file import or durable history is included. Browser PDF settings: US Letter, portrait, 100%, headers/footers off; confirm one page.\n\nThis archive contains the tested production assets. Source commit ${commit}; uncommitted source changes at packaging: ${Boolean(status)}. Source fingerprint: ${sourceDigest}. Record this candidate ID and archive checksum when rehearsing. Do not edit dist after testing.\n`);
const manifest = {
  schemaVersion: 1, candidateId, generatedAtIso: new Date().toISOString(),
  releaseStatus: 'candidate — portable launcher startup, presentation-laptop, native PDF, outside-tester and rehearsal gates pending',
  source: { commit, branch: git(['branch', '--show-current']), dirty: Boolean(status), sha256: sourceDigest },
  automatedChecks: { command: 'npm run check', status: 'passed', scope: 'Application tests, in-memory release tests, typecheck and production build. Actual socket tests are separate: npm run test:release:network.' },
  benchmark, assetAudit, files: await fileInventory(directory),
};
await writeFile(resolve(directory, 'candidate.json'), JSON.stringify(manifest, null, 2));
await verifyCandidate(directory);
const archive = `${directory}.tar.gz`;
execFileSync('tar', ['-czf', archive, '-C', parent, directory.slice(parent.length + 1)]);
const checksum = sha256(await readFile(archive));
await writeFile(`${archive}.sha256`, `${checksum}  ${archive.slice(parent.length + 1)}\n`);
const summary = { directory, archive, archiveSha256: checksum, candidateId, sourceCommit: commit, sourceWasDirty: Boolean(status), benchmarkP95Ms: benchmark.p95Ms, assetBytes: assetAudit.totalBytes };
await writeFile(resolve(parent, 'latest.json.tmp'), JSON.stringify(summary, null, 2));
await rename(resolve(parent, 'latest.json.tmp'), resolve(parent, 'latest.json'));
console.log(JSON.stringify(summary, null, 2));
