const K = require('./kin.js');
function rnd(){ return Array.from({length:6},()=> (Math.random()*2-1)*Math.PI); }
// 1) relación URDF vs DH: X = inv(PRE*DH) * URDF debe ser constante
let first=null, maxdev=0;
for(let k=0;k<50;k++){ const q=rnd(); const X=K.mul(K.inv(K.mul(K.PRE,K.fkDH(q))),K.fk(q)); if(!first) first=X; maxdev=Math.max(maxdev,...X.map((v,i)=>Math.abs(v-first[i]))); }
console.log('POST (debería ser identidad):', first.map(v=>+v.toFixed(4)).join(','), 'desv', maxdev.toExponential(2));
// 2) IK round trip
let fails=0, worst=0, nsol=0;
for(let k=0;k<2000;k++){ const q=rnd(); const T=K.fk(q); const S=K.ik(T); nsol+=S.length;
  let best=1e9; for(const s of S){ const T2=K.fk(s); const e=Math.max(...T2.map((v,i)=>Math.abs(v-T[i]))); best=Math.min(best,e); }
  if(best>1e-6) fails++; else worst=Math.max(worst,best); }
console.log('IK fallos',fails,'/2000  peor error',worst.toExponential(2),' media soluciones',(nsol/2000).toFixed(2));
// 3) todas las soluciones son válidas?
let bad=0; for(let k=0;k<500;k++){ const q=rnd(); const T=K.fk(q); for(const s of K.ik(T)){ const T2=K.fk(s); const e=Math.max(...T2.map((v,i)=>Math.abs(v-T[i]))); if(e>1e-6) bad++; } }
console.log('soluciones inválidas',bad);
// 4) pose cero: tool0
const T0=K.fk([0,0,0,0,0,0]); console.log('tool0 en q=0:', [T0[3],T0[7],T0[11]].map(v=>v.toFixed(4)));
console.log('manip q=0', K.manip([0,-1.57,1.57,-1.57,-1.57,0]).toExponential(2));
