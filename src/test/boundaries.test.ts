import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}

it('keeps development fixtures out of runtime modules and the shared barrel', () => {
  const violations: string[] = [];
  for (const file of sourceFiles(root)) {
    if (file.includes('/fixtures/') || file.includes('/test/') || file.includes('.test.')) continue;
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]/g)];
    for (const match of imports) {
      if (match[1]?.includes('fixtures')) violations.push(`${file}: ${match[1]}`);
    }
  }
  expect(violations).toEqual([]);
});

it('keeps calculation boundaries independent of the UI and of each other', () => {
  const structures = sourceFiles(join(root, 'structures'));
  const costs = [...sourceFiles(join(root, 'community/costs/engine')), join(root, 'community/costs/index.ts')];
  for (const file of [...structures, ...costs]) {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/from\s+['"]react/);
    expect(source).not.toMatch(/from\s+['"][^'"]*(?:studio|app\/)/);
    if (structures.includes(file)) expect(source).not.toMatch(/from\s+['"][^'"]*community/);
    else expect(source).not.toMatch(/from\s+['"][^'"]*structures/);
  }
});

it('keeps financial forms and draft state independent of structural and experiment modules', () => {
  for (const file of sourceFiles(join(root, 'community/costs'))) {
    expect(readFileSync(file, 'utf8')).not.toMatch(/from\s+['"][^'"]*(?:structures|studio|app\/)/);
  }
});

it('keeps report capture pure and report presentation independent of live application state', () => {
  const builder = readFileSync(join(root, 'community/report/buildDecisionSheet.ts'), 'utf8');
  expect(builder).not.toMatch(/from\s+['"][^'"]*(?:react|app\/|structures\/)/);
  expect(builder).not.toMatch(/\b(?:window|document|rankBraces|analyze)\b/);
  const view = readFileSync(join(root, 'community/report/DecisionSheet.tsx'), 'utf8');
  expect(view).not.toMatch(/from\s+['"][^'"]*app\//);
  expect(view).not.toMatch(/\b(?:useExperiment|useQuotes|useState|compareQuotes|rankBraces)\b/);
});
