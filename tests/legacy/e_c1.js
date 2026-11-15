(async()=>{ const g=window.__g; const D=g.D; const out=[]; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const espera=async()=>{ const t=performance.now(); while(g.CALC.activo) await sleep(50); return performance.now()-t; };
 out.push('inicio: calc '+g.CALC.activo+' espera '+(await espera()|0)+' ms, al dia '+g.planesAlDia()+' barra oculta '+document.getElementById('calcBar').hidden);
 // mover un plato: debe ser instantáneo y dejar pendiente
 const L=g.L(); let t=performance.now(); L.plato1.x+=0.03; g.aplicarLayout && 0; g.recalcular(); const tm=performance.now()-t;
 await sleep(400); out.push(`mover+soltar: ${tm.toFixed(1)} ms, al dia ${g.planesAlDia()}, barra visible ${!document.getElementById('calcBar').hidden}, texto "${document.getElementById('calcTxt').textContent}"`);
 // calcular con el botón midiendo el mayor bloqueo
 let maxGap=0, last=performance.now(); const hb=setInterval(()=>{ const n=performance.now(); maxGap=Math.max(maxGap,n-last); last=n; },10);
 t=performance.now(); document.getElementById('btnCalc').click(); await sleep(20); const textos=new Set(); while(g.CALC.activo){ textos.add(document.getElementById('calcTxt').textContent); await sleep(30);} clearInterval(hb);
 out.push(`calcular: ${(performance.now()-t)|0} ms, mayor bloqueo ${maxGap|0} ms, al dia ${g.planesAlDia()}, barra oculta ${document.getElementById('calcBar').hidden}, textos: ${[...textos].slice(0,4).join(' | ')}`);
 // reproducir con cambios pendientes: calcula y arranca
 L.plato1.x-=0.03; g.recalcular(); document.querySelector('[data-tab="demo"]').click(); await sleep(100);
 out.push('check pendiente: '+document.getElementById('dCheck').innerText.slice(0,120));
 document.getElementById('dPlay').click(); await sleep(50); out.push('play: calc '+g.CALC.activo); await espera(); await sleep(200); out.push('tras calcular: demo activa '+D.activo+' playing '+D.playing);
 document.getElementById('dReset').click(); await sleep(100);
 return out.join('\n'); })()
