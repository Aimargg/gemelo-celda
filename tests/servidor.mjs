// Servidor HTTP local para las pruebas e2e. Sirve la raíz del repo en 127.0.0.1 con un puerto libre.
// Rutas especiales (los dos destinos de D2):
//   /artefacto.html         dist/gemelo-celda.html envuelto en un esqueleto con doctype, como lo muestra claude.ai
//   /artefacto-claude.html  lo mismo, con tests/mocks/mock_claude.html delante (almacén de claude.ai simulado)
//   /index.html             la versión web tal cual (config.js y firebase.js se sustituyen en el navegador, no aquí)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };
const ESQUELETO = '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n';

function artefacto(conClaude) {
  const f = path.join(RAIZ, 'dist/gemelo-celda.html');
  if (!fs.existsSync(f)) throw new Error('Falta dist/gemelo-celda.html: ejecuta npm run build');
  const mock = conClaude ? fs.readFileSync(path.join(RAIZ, 'tests/mocks/mock_claude.html'), 'utf8') + '\n' : '';
  return ESQUELETO + mock + fs.readFileSync(f, 'utf8') + '\n</html>\n';
}

export function arrancarServidor() {
  const srv = http.createServer((req, res) => {
    try {
      const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (ruta === '/artefacto.html' || ruta === '/artefacto-claude.html') {
        res.writeHead(200, { 'Content-Type': TIPOS['.html'] }); return res.end(artefacto(ruta === '/artefacto-claude.html'));
      }
      const f = path.join(RAIZ, path.normalize(ruta));
      if (!f.startsWith(RAIZ + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${srv.address().port}`;
    ok({ url, cerrar: () => new Promise(r => srv.close(r)) });
  }));
}
