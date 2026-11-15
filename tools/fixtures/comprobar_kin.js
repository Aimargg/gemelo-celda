// Compara tests/fixtures/cinematica/nominal.json (FK del xacro del curso) con la FK nominal del gemelo (src/kin.js).
// Uso: node tools/fixtures/comprobar_kin.js   -> sale con 1 si el error máximo en alguna matriz llega a 1e-6.
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '../..');
const KIN = require(path.join(RAIZ, 'src/kin.js'));
const ref = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/fixtures/cinematica/nominal.json'), 'utf8'));
const TOL = 1e-6;

const maxDif = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
let errFk = 0, errDh = 0;
ref.configuraciones.forEach((q, k) => {
  const T = ref.tool0_en_base_link[k];
  errFk = Math.max(errFk, maxDif(KIN.fk(q), T));                        // cadena URDF del gemelo
  errDh = Math.max(errDh, maxDif(KIN.mul(KIN.PRE, KIN.fkDH(q)), T));    // DH con PRE = Rz(pi)
});
const n = ref.configuraciones.length;
console.log(`KIN.fk frente a nominal.json (${n} configuraciones): error máximo ${errFk.toExponential(2)}`);
console.log(`KIN.PRE · KIN.fkDH frente a nominal.json: error máximo ${errDh.toExponential(2)}`);
const ok = errFk < TOL && errDh < TOL;
console.log(ok ? `OK (< ${TOL})` : `FALLA: se esperaba < ${TOL}`);
process.exit(ok ? 0 : 1);
