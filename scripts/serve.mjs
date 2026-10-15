#!/usr/bin/env node
// Local static server for dist/ with the same security headers as production.
// Usage: npm run serve  (PORT=8080 by default). For local testing only.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../dist', import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

const headerFile = await readFile(join(ROOT, '_headers'), 'utf8').catch(() => '');
const globalHeaders = Object.fromEntries(headerFile.split('\n/assets/*')[0].split('\n')
  .filter((l) => /^\s+\S+:/.test(l)).map((l) => l.trim().split(/:\s(.+)/).slice(0, 2)));
delete globalHeaders['Strict-Transport-Security']; // not meaningful on http://localhost

createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const url = new URL(req.url, 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = join(ROOT, path);
    if (!file.startsWith(ROOT + sep) && file !== ROOT) { res.writeHead(403).end(); return; } // path traversal guard
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file).catch(() => null);
    if (!body) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'], ...globalHeaders });
      res.end(await readFile(join(ROOT, '404.html')).catch(() => 'Not found'));
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...globalHeaders });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(500).end();
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Serving dist/ at http://localhost:${PORT}`));
