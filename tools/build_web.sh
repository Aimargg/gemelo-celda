#!/bin/bash
# Construye la página de GitHub Pages (index.html en la raíz) a partir de la versión de artefacto.
# Quita el gancho de pruebas, añade config.js y el esqueleto HTML. No toca config.js, firebase.js ni los recursos.
# Si existe clave_grupo.txt (fuera de git), genera también dist/firestore.rules y dist/LEEME.md con la clave.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
bash "$R/tools/build.sh"
# Con node (ya lo exige el repo) y no con python3: en Windows, python3 suele ser el atajo de la Microsoft Store
node - "$R" <<'JS'
const fs = require('fs'), r = process.argv[2];
let s = fs.readFileSync(r + '/dist/gemelo-celda.html', 'utf8').split(/(?<=\n)/).filter(l => !l.includes('window.__g = ')).join('');
const i = s.indexOf('<script type="importmap">'); if (i < 0) throw new Error('falta el import map');
s = s.slice(0, i) + '<script src="config.js"></script>\n' + s.slice(i);
s = '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + s.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '') + '\n</html>\n';
fs.writeFileSync(r + '/index.html', s);
JS
echo "index.html: $(wc -c < "$R/index.html") bytes"
if [ -f "$R/clave_grupo.txt" ]; then KEY=$(cat "$R/clave_grupo.txt"); sed "s/@@CLAVE@@/$KEY/g" "$R/web_src/firestore.rules" > "$R/dist/firestore.rules"; sed "s/@@CLAVE@@/$KEY/g" "$R/web_src/LEEME.md" > "$R/dist/LEEME.md"; echo "dist/firestore.rules y dist/LEEME.md generados (no se suben a git)"; fi
