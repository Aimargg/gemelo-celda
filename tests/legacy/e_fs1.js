(async()=>{ const g=window.__g; const E=g.ESC, A=g.ALM; const out=[]; const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const q=s=>document.querySelector(s);
 const nav=()=>`[${q('#escNom').textContent} | ${q('#escMeta').textContent}]`; const st=()=>[...globalThis.__fsStore.values()];
 while(g.CALC.activo||E.cargando) await sleep(50);
 out.push('1 modo '+A.modo+' '+nav());
 q('#escCur').click(); await sleep(50); out.push('  fila nombre visible '+!q('#escAutorFila').hidden+' · guardar visible '+!q('#escGuardarSec').hidden);
 q('#escNombre').value='Referencia'; q('#escNueva').click(); await sleep(200); out.push('2 sin nombre de autor → docs '+st().length);
 q('#escAutor').value='Aimar'; q('#escAutor').dispatchEvent(new Event('change')); q('#escNota').value='Punto de partida'; q('#escNueva').click(); await sleep(50); while(g.CALC.activo) await sleep(50); await sleep(400);
 out.push('3 guardada '+nav()+' docs '+st().length+' layout '+typeof st()[0].layout+' rechazo '+(globalThis.__fsRechazo||'ninguno'));
 // otra persona en otro navegador
 A.yo='Bea'; localStorage.setItem('gemelo-nombre','Bea'); g.abrirEscena(0,{forzar:true,silencio:true}); await sleep(200); out.push('4 vista por Bea '+nav());
 const L=g.L(); L.zona.x+=0.02; g.recalcular(); await sleep(400);
 q('#escCur').click(); await sleep(50); out.push('5 Bea modifica: '+nav()+' · cambios '+(q('#escCambios').hidden?'oculto':q('#escCambios').textContent));
 q('#escCambios').click(); await sleep(50); while(g.CALC.activo) await sleep(50); await sleep(400);
 out.push('6 cambios de Bea: '+nav()+' doc autor '+st()[0].autor+' editadoPor '+st()[0].editadoPor+' docs '+st().length);
 q('#escCur').click(); await sleep(50); let b=q('#escLista [data-borrar]'); out.push('7 botón '+(b&&b.textContent)); b.click(); await sleep(30); b=q('#escLista [data-borrar]'); b.click(); await sleep(300);
 out.push('  tras borrar: lista '+E.lista.length+' papelera '+E.papelera.length+' '+nav()+' papelera visible '+!q('#escPapelera').hidden);
 q('#escPapLista [data-restaurar]').click(); await sleep(300); out.push('8 restaurada: lista '+E.lista.length+' papelera '+E.papelera.length);
 b=q('#escLista [data-borrar]'); b.click(); await sleep(30); q('#escLista [data-borrar]').click(); await sleep(300);
 let d=q('#escPapLista [data-def]'); d.click(); await sleep(30); d=q('#escPapLista [data-def]'); out.push('9 '+d.textContent); d.click(); await sleep(300); out.push('  borrado definitivo: docs '+st().length+' papelera '+E.papelera.length);
 out.push('10 descargar sin claude: '+(typeof g.D));
 return out.join('\n'); })()
