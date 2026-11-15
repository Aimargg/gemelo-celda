const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const NPM = path.join(__dirname, 'npmtmp/package');
(async () => {
  const http = require('http');
  const srv = http.createServer((req, res) => { const f = path.join(__dirname, 'site', decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } const ext = path.extname(f); res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' }[ext] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8766);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const arg = process.argv[2] || '[{"w":1440,"h":900,"name":"desk"}]'; const modes = arg.endsWith('.json') ? JSON.parse(fs.readFileSync(arg,'utf8')) : JSON.parse(arg);
  for (const m of modes) {
    const ctx = await browser.newContext({ viewport: { width: m.w, height: m.h }, deviceScaleFactor: m.dsf || 1, colorScheme: m.dark ? 'dark' : 'light' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') errs.push(msg.type() + ': ' + msg.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => { const rel = r.request().url().split('three@0.160.0/')[1]; r.fulfill({ path: path.join(NPM, rel), contentType: 'application/javascript' }); });
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    await page.route('https://fonts.gstatic.com/**', r => r.abort());
    await page.goto('http://localhost:8766/test.html?prueba');
    await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 }).catch(e => errs.push('timeout cargando'));
    await page.waitForTimeout(m.wait || 6000);
    if (m.script) { await page.evaluate(m.script); await page.waitForTimeout(m.after || 3000); }
    await page.screenshot({ path: `shot_${m.name}.png`, fullPage: !!m.full });
    if (m.eval) { const r = await page.evaluate(m.eval); console.log(m.name, 'EVAL', JSON.stringify(r)); }
    console.log(m.name, 'ERRORES:', errs.length ? errs.slice(0, 15).join('\n') : 'ninguno');
    await ctx.close();
  }
  await browser.close(); srv.close();
})();
