Regenera `firebase.js` (raíz del repo) con la misma versión de Firebase:
  cd tools/firebase-bundle && npm ci && npx esbuild entrada.js --bundle --format=esm --minify --outfile=../../firebase.js
Solo hace falta si cambia la versión de Firebase (puerta humana: P6 del plan).
