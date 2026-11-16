#!/bin/bash
# Construye la versión de artefacto (un solo HTML, con el gancho de pruebas window.__g) en dist/gemelo-celda.html.
# Uso: bash tools/build.sh   (desde cualquier carpeta)
set -e
R=$(cd "$(dirname "$0")/.." && pwd); S=$R/src; mkdir -p "$R/dist"
{
cat "$S/part1.html"
cat <<'IM'
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);
IM
sed -n '/^const KIN/,/^})();/p' "$S/kin.js"
# Cada marcador // @@NOMBRE@@ de app.js se sustituye por src/<nombre>.js (y @@CALIBRACION@@ por src/datos/calibracion.js,
# T1.4). De layout.js, rng.js, perfil.js (T1.6), sensor.js (T1.7), origen.js (T2.1) y calibracion.js se omite la exportación para node:test
# («if (typeof module …»), como de kin.js (D4: sin módulos ni bundler).
awk -v F="$S/colision.js" -v G="$S/fallos.js" -v E="$S/escenas.js" -v LY="$S/layout.js" -v RG="$S/rng.js" -v CA="$S/datos/calibracion.js" -v PF="$S/perfil.js" -v SE="$S/sensor.js" -v OR="$S/origen.js" '
function incluir(f,  l) { while ((getline l < f) > 0) if (l !~ /^if \(typeof module/) print l; close(f) }
/@@COLISION@@/{incluir(F); next} /@@FALLOS@@/{incluir(G); next} /@@ESCENAS@@/{incluir(E); next} /@@LAYOUT@@/{incluir(LY); next} /@@RNG@@/{incluir(RG); next} /@@CALIBRACION@@/{incluir(CA); next} /@@PERFIL@@/{incluir(PF); next} /@@SENSOR@@/{incluir(SE); next} /@@ORIGEN@@/{incluir(OR); next}1' "$S/app.js"
echo '</script>'
} > "$R/dist/gemelo-celda.html"
echo "dist/gemelo-celda.html: $(wc -c < "$R/dist/gemelo-celda.html") bytes"
