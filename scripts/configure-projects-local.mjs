import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

// Only browser-safe settings are written. Never persist CLI admin credentials.
let local;
try { local = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
catch { throw new Error('Start Forma local Supabase first: supabase start'); }
if (local.API_URL !== 'http://127.0.0.1:55321') throw new Error('Expected Forma local Supabase on port 55321.');
const key = local.PUBLISHABLE_KEY ?? local.ANON_KEY;
if (!key) throw new Error('Local Supabase did not return a browser-safe key.');
const current = await readFile('.env.local', 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
const preserved = current.split('\n').filter(line => !/^VITE_SUPABASE_(URL|PUBLISHABLE_KEY)=/.test(line)).join('\n').trim();
await writeFile('.env.local', `${preserved ? `${preserved}\n` : ''}VITE_SUPABASE_URL=${local.API_URL}\nVITE_SUPABASE_PUBLISHABLE_KEY=${key}\n`, { mode: 0o600 });
console.log('Configured .env.local for Forma on port 55321. Rebuild or restart Vite to load it.');
