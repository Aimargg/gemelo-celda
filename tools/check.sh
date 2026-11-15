#!/bin/bash
# Comprobación única antes de entregar: clave del grupo fuera de git (I3), build de los dos destinos y npm test.
# Uso: bash tools/check.sh   (desde cualquier carpeta). Sale con código distinto de 0 ante cualquier fallo.
set -euo pipefail
R=$(cd "$(dirname "$0")/.." && pwd); cd "$R"

# 1) Clave del grupo (I3). Se miran los ficheros rastreados y los nuevos sin ignorar (los que entrarían en el próximo commit);
#    dist/ y clave_grupo.txt están ignorados. Dos búsquedas:
#    a) si existe clave_grupo.txt, su contenido exacto;
#    b) siempre, los sitios donde aparece la clave (enlace #g=…, reglas grupo == '…', LEEME «Clave del grupo: `…`»)
#       con un valor que no sea un marcador o una clave de prueba.
echo "== 1/3 Clave del grupo en los ficheros de git (I3)"
fallo=0
buscar() { local rc=0 out; out=$(git grep --untracked -I "$@") || rc=$?; [ "$rc" -le 1 ] || { echo "ERROR: git grep ha fallado ($rc)" >&2; exit 2; }; printf '%s' "$out"; }
if [ -f clave_grupo.txt ]; then
  KEY=$(tr -d '[:space:]' < clave_grupo.txt)
  hits=''; if [ -n "$KEY" ]; then hits=$(buscar -l -F -e "$KEY" -- . ':!clave_grupo.txt'); fi
  if [ -n "$hits" ]; then echo "ERROR: la clave de clave_grupo.txt aparece en:"; printf '%s\n' "$hits" | sed 's/^/  /'; fallo=1; fi
fi
PERMITIDAS='^(@@CLAVE@@|clave-buena|clave-mala)$'
hits=$(buscar -n -o -E "#g=[A-Za-z0-9_-]{6,80}|grupo == '[^']*'|Clave del grupo: \`[^\`]*\`" -- . ':!tools/check.sh')
while IFS= read -r linea; do
  [ -z "$linea" ] && continue
  valor=$(printf '%s' "$linea" | sed -E "s/^[^:]*:[0-9]+:(#g=|grupo == '|Clave del grupo: \`)//; s/['\`]$//")
  if ! printf '%s' "$valor" | grep -Eq "$PERMITIDAS"; then echo "ERROR: posible clave del grupo: $linea"; fallo=1; fi
done <<< "$hits"
[ "$fallo" = 0 ] || { echo "check: FALLA (I3)"; exit 1; }
echo "sin claves reales"

# 2) Build de los dos destinos
echo "== 2/3 Build"
bash tools/build_web.sh

# 3) Suite completa
echo "== 3/3 npm test"
npm test
echo "check: OK"
