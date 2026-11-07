import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function fileInventory(root) {
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (['.DS_Store', 'Thumbs.db', 'desktop.ini', '__MACOSX'].includes(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlinks are not allowed in a release: ${path}`);
      if (entry.isDirectory()) files.push(...await walk(path));
      else if (entry.isFile()) files.push(path);
    }
    return files;
  }
  const files = {};
  for (const path of (await walk(root)).sort()) {
    const bytes = await readFile(path);
    files[relative(root, path).split(sep).join('/')] = { bytes: bytes.length, sha256: sha256(bytes) };
  }
  return files;
}

/** Checks local HTML/CSS asset references. CSP additionally blocks remote runtime connections. */
export async function auditAssets(root) {
  const inventory = await fileInventory(root);
  if (!inventory['index.html']) throw new Error('Production index.html is missing.');
  let referencesChecked = 0;
  for (const name of Object.keys(inventory).filter(name => /\.(html|css)$/.test(name))) {
    const source = await readFile(resolve(root, name), 'utf8');
    const references = name.endsWith('.html')
      ? [...source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1])
      : [...source.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)|@import\s+["']([^"']+)["']/gi)].map(match => match[1] ?? match[2]);
    for (const reference of references) {
      if (reference.startsWith('#') || reference.startsWith('data:')) continue;
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) throw new Error(`Remote or non-file asset in ${name}: ${reference}`);
      const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
      const target = clean.startsWith('/') ? resolve(root, `.${clean}`) : resolve(root, dirname(name), clean);
      if (!target.startsWith(resolve(root) + sep) || !(await stat(target).catch(() => null))?.isFile()) throw new Error(`Missing local asset in ${name}: ${reference}`);
      referencesChecked++;
    }
  }
  return { files: inventory, totalBytes: Object.values(inventory).reduce((sum, file) => sum + file.bytes, 0), referencesChecked,
    scope: 'HTML/CSS references checked against local files; JavaScript behavior is covered by integration checks and same-origin CSP. This is not a physical network-disconnect test.' };
}

export async function verifyCandidate(root) {
  const manifest = JSON.parse(await readFile(resolve(root, 'candidate.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !manifest.files || typeof manifest.files !== 'object') throw new Error('Unsupported candidate manifest.');
  const actual = await fileInventory(root);
  delete actual['candidate.json'];
  // Compare by keys rather than insertion order across platform-specific path sorting.
  const keys = Object.keys(actual), expected = Object.keys(manifest.files);
  if (keys.length !== expected.length || keys.some(key => actual[key].sha256 !== manifest.files[key]?.sha256 || actual[key].bytes !== manifest.files[key]?.bytes)) throw new Error('Candidate checksum mismatch: a file changed, is missing, or was added. Re-extract the tested archive.');
  await auditAssets(resolve(root, 'dist'));
  return manifest;
}
