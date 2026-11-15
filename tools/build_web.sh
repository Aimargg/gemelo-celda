#!/bin/bash
# Construye la página de GitHub Pages (index.html en la raíz) a partir de la versión de artefacto.
# Quita el gancho de pruebas, añade config.js y el esqueleto HTML. No toca config.js, firebase.js ni los recursos.
# Si existe clave_grupo.txt (fuera de git), genera también dist/firestore.rules y dist/LEEME.md con la clave.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
bash "$R/tools/build.sh"
python3 - "$R" <<'PY'
import sys; r = sys.argv[1]
s = ''.join(l for l in open(r + '/dist/gemelo-celda.html', encoding='utf-8') if 'window.__g = ' not in l)
i = s.index('<script type="importmap">')
s = s[:i] + '<script src="config.js"></script>\n' + s[i:]
s = '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + s.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '', 1) + '\n</html>\n'
open(r + '/index.html', 'w', encoding='utf-8').write(s)
PY
echo "index.html: $(wc -c < "$R/index.html") bytes"
if [ -f "$R/clave_grupo.txt" ]; then KEY=$(cat "$R/clave_grupo.txt"); sed "s/@@CLAVE@@/$KEY/g" "$R/web_src/firestore.rules" > "$R/dist/firestore.rules"; sed "s/@@CLAVE@@/$KEY/g" "$R/web_src/LEEME.md" > "$R/dist/LEEME.md"; echo "dist/firestore.rules y dist/LEEME.md generados (no se suben a git)"; fi
