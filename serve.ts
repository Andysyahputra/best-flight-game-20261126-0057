// serve.ts — tiny static server for the game during development/screenshots.
// Serves game/ at http://localhost:8080. Node 22, standard library only.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let p = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (p.endsWith('/')) p = join(p, 'index.html');
    const data = await readFile(p);
    res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
server.listen(8080, () => console.log('IRON GASSER at http://localhost:8080'));
