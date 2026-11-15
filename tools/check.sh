#!/bin/bash
# Comprobación única antes de entregar: clave del grupo fuera de git (I3), build de los dos destinos y npm test.
# Uso: bash tools/check.sh   (desde cualquier carpeta). Sale con código distinto de 0 ante cualquier fallo.
set -euo pipefail
R=$(cd "$(dirname "$0")/.." && pwd); cd "$R"
export LC_ALL=C.UTF-8 # «›» y los acentos como un solo carácter en grep y sed

# 1) Clave del grupo (I3), en dos sitios: el árbol de trabajo (ficheros rastreados y nuevos sin ignorar, lo que entraría
#    en el próximo commit) y el índice (lo ya preparado con git add, aunque se haya borrado del árbol).
#    a) Exacta: si existe clave_grupo.txt (solo en el equipo del usuario), su contenido.
#    b) Heurística, siempre: enlaces con g=, reglas que comparan grupo con una cadena, rutas o argumentos con «grupos»
#       seguidos de un valor de 6 a 80 caracteres, y la línea «Clave del grupo» del LEEME. Falla si el valor no es un
#       marcador o una clave de prueba de PERMITIDAS. Este fichero no se excluye de la búsqueda.
echo "== 1/3 Clave del grupo en el árbol y en el índice de git (I3)"
PERMITIDAS='^(@@CLAVE@@|clave-buena|clave-mala)$'
PAT_ENLACE='[#&]g=[A-Za-z0-9_-]{6,80}'
PAT_REGLA="grupo[[:space:]]*==[[:space:]]*[\"'][^\"']*[\"']"
PAT_RUTA="grupos[[:space:]]*[/›\`'\"][/ ›\`'\",]*[A-Za-z0-9_-]{6,80}"
PAT_LEEME='Clave del grupo:[[:space:]]*`[^`]*`'
fallo=0
buscar() { # $1 = --untracked | --cached; el resto, argumentos de git grep. Sale con 2 si git grep falla de verdad.
  local donde=$1 rc=0 out; shift
  out=$(git grep "$donde" -I "$@") || rc=$?
  [ "$rc" -le 1 ] || { echo "ERROR: git grep $donde ha fallado ($rc)" >&2; exit 2; }
  printf '%s' "$out"
}
for donde in --untracked --cached; do
  sitio=$([ "$donde" = --cached ] && echo 'índice' || echo 'árbol')
  if [ -f clave_grupo.txt ]; then
    KEY=$(tr -d '[:space:]' < clave_grupo.txt); hits=''
    if [ -n "$KEY" ]; then hits=$(buscar "$donde" -l -F -e "$KEY"); fi
    if [ -n "$hits" ]; then echo "ERROR ($sitio): la clave de clave_grupo.txt aparece en:"; printf '%s\n' "$hits" | sed 's/^/  /'; fallo=1; fi
  fi
  hits=$(buscar "$donde" -n -o -E -e "$PAT_ENLACE" -e "$PAT_REGLA" -e "$PAT_RUTA" -e "$PAT_LEEME")
  while IFS= read -r linea; do
    [ -z "$linea" ] && continue
    coincidencia=${linea#*:*:}   # quita «fichero:línea:»
    valor=$(printf '%s' "$coincidencia" | sed -E "s/[\`'\"]$//; s/.*[=/ \`'\",:›]//")
    if ! printf '%s' "$valor" | grep -Eq "$PERMITIDAS"; then echo "ERROR ($sitio): posible clave del grupo «$valor» en $linea"; fallo=1; fi
  done <<< "$hits"
done
[ "$fallo" = 0 ] || { echo "check: FALLA (I3)"; exit 1; }
echo "sin claves reales"

# 2) Build de los dos destinos
echo "== 2/3 Build"
bash tools/build_web.sh

# 3) Suite completa
echo "== 3/3 npm test"
npm test
echo "check: OK"
