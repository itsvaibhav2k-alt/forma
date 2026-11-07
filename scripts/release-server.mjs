import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2' };
export const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'";

/** Dependency-free launcher for the extracted candidate; loopback binding is mandatory. */
export function createReleaseHandler(directory) {
  const root = resolve(directory);
  return async (request, response) => {
    response.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    const fail = (status, message) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end(request.method === 'HEAD' ? undefined : message); };
    if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); fail(405, 'Read-only local server.'); return; }
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (path.includes('\\') || path.includes('\0')) { fail(400, 'Invalid path.'); return; }
      const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
      const realRoot = await realpath(root), realFile = await realpath(file);
      if (!realFile.startsWith(realRoot + sep) || !(await stat(realFile)).isFile()) { fail(404, 'Not found.'); return; }
      const data = await readFile(realFile);
      response.writeHead(200, { 'Content-Type': types[extname(realFile)] ?? 'application/octet-stream', 'Content-Length': data.length });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) { fail(error instanceof URIError ? 400 : 404, 'Not found or invalid path.'); }
  };
}

export const createReleaseServer = directory => createServer(createReleaseHandler(directory));

export async function startRelease(directory, port = 4173) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  await stat(resolve(directory, 'index.html'));
  const server = createReleaseServer(directory);
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
  startRelease(directory, Number(process.env.PORT ?? 4173)).then(server => {
    console.log(`Forma candidate: http://127.0.0.1:${server.address().port}/\nKeep this terminal open. Reload clears trials, quotes and captured sheets. Ctrl+C stops the server.`);
  }).catch(error => { console.error(`Cannot start Forma: ${error.code === 'EADDRINUSE' ? 'port already in use; stop the existing server or set PORT explicitly.' : error.message}`); process.exitCode = 1; });
}
