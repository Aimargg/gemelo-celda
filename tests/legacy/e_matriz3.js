(async()=>{ const g=window.__g; const out=[]; const t=performance.now(); let semilla=1; const rnd=()=>{semilla=(semilla*16807)%2147483647; return semilla/2147483647;};
 for (const caja of [true,false]) for (const modo of ['M0','M1']) for (const amp of [0,0.02,0.04,0.06]) for (const vel of [0.1,0.25,0.5,1.0]) {
   const r = await g.ensayo({modo, amp, vel, caja, fase: rnd()*100, sinRender:true, limite: 400});
   out.push([caja?'caja':'mesa', modo, amp*100, vel*100, r.fin, r.paso, r.t_mov, r.errores_mm.join('/'), r.choques, r.roces, r.pausas, 'auto'+r.autocol, 'plan'+r.planes, 'sust'+r.sust, r.fallo.slice(0,140)].join(' | '));
 }
 out.push('ms '+Math.round(performance.now()-t)); return out.join('\n'); })()
