(async()=>{ const g=window.__g; const E=g.ESC, A=g.ALM; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const q=s=>document.querySelector(s);
 await sleep(800); while(E.cargando) await sleep(50); q('#escCur').click(); await sleep(50);
 return `modo ${A.modo} escribir ${A.escribir} · guardar ${q('#escGuardarSec').hidden?'oculto':'visible'} · aviso: ${q('#escSoloLectura').textContent.slice(0,140)} · nav ${q('#escMeta').textContent}`; })()
