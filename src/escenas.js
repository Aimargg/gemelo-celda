// ======================= Escenas del grupo =======================
// Dos almacenes con la misma interfaz:
//  · 'claude': la página es un artefacto de claude.ai. Cada persona guarda sus escenas en propuestas/<su id> (lista «items»).
//  · 'firestore': la página está alojada fuera (GitHub Pages). Una escena por documento en grupos/<clave del grupo>/escenas;
//    la clave va en el enlace (#g=…) y las reglas de Firestore solo dejan leer y escribir con ella. Sin cuentas: cada uno pone su nombre.
// «Tu mesa» es la copia de trabajo de cada uno (en este navegador). Abrir una escena no la toca; si se modifica una escena
// abierta, lo editado pasa a «Tu mesa» y la escena original queda intacta.
const MAX_ESC = 30, CLAVE_PREV = CLAVE + '-mesa-anterior', CLAVE_NOMBRE = 'gemelo-nombre', CLAVE_GRUPO = 'gemelo-grupo';
const ALM = { modo: null, escribir: null, yo: null, dueno: false, nombres: {}, aviso: '', quien: () => 'de alguien del grupo', editable: () => false, borrable: () => false };
let FB = null, COL_ESC = null; // módulo de Firebase y colección de escenas (solo en modo firestore)
const jsonL = () => JSON.stringify(L);
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function leerLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function ponerLS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } }
const ajustesDemo = () => ({ modo: D.modo, amp: D.amp, vel: D.vel, pedido: L.pedido });
const vistaActual = () => ({ p: cam.position.toArray().map(v => +v.toFixed(3)), t: orbit.target.toArray().map(v => +v.toFixed(3)) });
const idxActual = () => ESC.cur ? ESC.lista.findIndex(e => e.id === ESC.cur.id) : -1;
const fechaCorta = s => s ? new Date(s).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
function pillEstado(e) {
  if (!e || !e.estado) return '<span class="pill">sin comprobar</span>';
  return e.estado.ok ? '<span class="pill ok">comprobación previa sin problemas</span>' : `<span class="pill bad">${e.estado.n} ${e.estado.n === 1 ? 'problema' : 'problemas'}</span>`;
}
function aplicarAjustes(a) {
  if (!a) return;
  if (a.modo) { const b = $(`#segModoB [data-v="${a.modo}"]`); if (b) b.click(); }
  if (a.vel != null) { const el = $('#dVel'); el.value = Math.round(a.vel * 100); el.dispatchEvent(new Event('input')); }
  if (a.amp != null) { const el = $('#dAmp'); el.value = Math.round(a.amp * 1000) / 10; el.dispatchEvent(new Event('input')); }
}
function guardarMesaYa() { escribirMesa(); } // solo lectura: no se guarda (T1.1)
// La copia anterior nunca recibe una disposición de una versión más nueva (la de Tu mesa solo la habría escrito otra versión)
function respaldarMesa() { const m = leerLS(CLAVE); if (m && !migrarLayout(m).soloLectura) ponerLS(CLAVE_PREV, m); }

// --- almacén de claude.ai (artefacto) ---
const almClaude = {
  quien: e => e.autor === ALM.yo ? 'tuya' : `de ${(ALM.nombres[e.autor] && ALM.nombres[e.autor].name) || 'alguien del grupo'}`,
  editable: e => e.autor === ALM.yo,
  borrable: e => e.autor === ALM.yo || ALM.dueno,
  async guardar(item, previa) {
    const yo = ALM.yo || await USER.id().catch(() => null); if (!yo) throw { code: 'sin_sesion' };
    const ref = DB.collection('propuestas').doc(yo); const s = await ref.get();
    const items = s.exists ? [...((s.data() || {}).items || [])] : [];
    const k = previa ? items.findIndex(x => x.id === previa.id) : -1;
    const it = { ...item, id: k >= 0 ? items[k].id : Date.now().toString(36), creado: k >= 0 ? items[k].creado : item.creado };
    if (k >= 0) items[k] = it; else { if (items.length >= MAX_ESC) throw { code: 'lleno' }; items.unshift(it); }
    await ref.set({ items }); return { ...it, autor: yo };
  },
  async borrar(e) { const ref = DB.collection('propuestas').doc(e.autor); const s = await ref.get(); await ref.set({ items: ((s.exists && s.data().items) || []).filter(x => x.id !== e.id) }); },
};
function iniciarClaude() {
  Object.assign(ALM, almClaude); ALM.modo = 'claude';
  ALM.aviso = 'Puedes ver y abrir las escenas del grupo, pero no guardar. Para guardar, el dueño de la página tiene que invitarte por correo como <b>Editor</b> (y la página no puede estar compartida a la vez por enlace público). Mientras tanto, copia el código de tu escena y pásaselo a quien pueda guardarla.';
  (async () => {
    if (USER) { ALM.yo = await USER.id().catch(() => null); ALM.dueno = await USER.isOwner().catch(() => false); const w = await USER.can('data.write').catch(() => null); ALM.escribir = w === false ? false : null; pintarNav(); }
  })();
  const tmr = setTimeout(() => { ESC.cargando = false; pintarNav(); }, 10000);
  DB.collection('propuestas').onSnapshot(async snap => {
    clearTimeout(tmr); const lista = [];
    for (const d of snap.docs) { const v = d.data() || {}; for (const it of (v.items || [])) if (it && it.layout) lista.push({ ...it, autor: d.id }); }
    const autores = [...new Set(lista.map(e => e.autor))].filter(a => !ALM.nombres[a]);
    if (USER && autores.length) { try { Object.assign(ALM.nombres, await USER.profiles(autores)); } catch (e) { } }
    recibirLista(lista, []);
  }, () => { ESC.cargando = false; pintarNav(); toast('No se pueden leer las escenas del grupo ahora mismo'); });
}

// --- almacén Firestore (página propia) ---
const almFirestore = {
  quien: e => (e.autor && e.autor === ALM.yo ? 'tuya' : `de ${e.autor || 'alguien del grupo'}`) + (e.editadoPor && e.editadoPor !== e.autor ? ` · cambios de ${e.editadoPor === ALM.yo ? 'ti' : e.editadoPor}` : ''),
  editable: () => true, borrable: () => true, // espacio compartido: cualquiera con el enlace edita; borrar manda a la papelera
  async guardar(item, previa) {
    const ref = previa ? FB.doc(COL_ESC, previa.id) : FB.doc(COL_ESC);
    const datos = { nombre: item.nombre, nota: item.nota, autor: previa ? (previa.autor || ALM.yo) : ALM.yo, editadoPor: ALM.yo, creado: previa ? previa.creado || item.creado : item.creado, editado: item.editado,
      layout: JSON.stringify(item.layout), ajustes: item.ajustes, vista: item.vista, estado: item.estado, borrado: false }; // la disposición va como texto JSON
    await FB.setDoc(ref, datos); return { ...datos, layout: item.layout, id: ref.id };
  },
  async borrar(e) { await FB.updateDoc(FB.doc(COL_ESC, e.id), { borrado: true, borradoPor: ALM.yo, editado: new Date().toISOString() }); },
  async restaurar(e) { await FB.updateDoc(FB.doc(COL_ESC, e.id), { borrado: false, editadoPor: ALM.yo, editado: new Date().toISOString() }); },
  async borrarDef(e) { await FB.deleteDoc(FB.doc(COL_ESC, e.id)); },
};
function claveGrupo() { // la clave del grupo llega en el enlace (#g=…) y se recuerda en este navegador
  const m = /[#&]g=([A-Za-z0-9_-]{6,80})/.exec(location.hash || ''); if (m) { ponerLS(CLAVE_GRUPO, m[1]); return m[1]; }
  return leerLS(CLAVE_GRUPO);
}
async function iniciarFirestore() {
  const cfg = window.FIREBASE_CONFIG, g = claveGrupo(); ALM.modo = null;
  const fin = aviso => { ALM.aviso = aviso; ESC.cargando = false; pintarNav(); };
  if (!cfg || !cfg.apiKey || !cfg.projectId || /PEGA|TU_/i.test(cfg.apiKey)) return fin('Falta conectar la página con Firebase: rellena <code>config.js</code> con la configuración de tu proyecto (ver LEEME). Mientras tanto puedes pasar escenas con un código.');
  if (!g) return fin('Al enlace le falta la clave del grupo (la parte <code>#g=…</code> del final). Pide el enlace completo a quien lo compartió.');
  try { FB = await import('./firebase.js'); } catch (e) { return fin('No se ha podido cargar <code>firebase.js</code>: comprueba que está junto a la página.'); }
  try { COL_ESC = FB.collection(FB.getFirestore(FB.initializeApp(cfg)), 'grupos', g, 'escenas'); } catch (e) { return fin('La configuración de <code>config.js</code> no es válida.'); }
  Object.assign(ALM, almFirestore); ALM.modo = 'firestore'; ALM.yo = leerLS(CLAVE_NOMBRE) || ''; ALM.escribir = null;
  ALM.aviso = 'La clave del grupo del enlace no es válida o las reglas de Firestore no están publicadas: no se pueden leer ni guardar escenas.';
  const tmr = setTimeout(() => { ESC.cargando = false; pintarNav(); }, 10000);
  FB.onSnapshot(COL_ESC, snap => {
    clearTimeout(tmr); const vivas = [], papelera = [], ilegibles = [];
    snap.docs.forEach(d => { const v = d.data() || {}; const r = migrarLayout(v.layout); if (r.error) { ilegibles.push(d.id); return; } (v.borrado ? papelera : vivas).push({ ...v, layout: r.layout, id: d.id }); });
    // una escena cuya disposición no se puede leer no se lista (como en la v8), pero ahora se avisa, una vez por cambio (T1.1)
    const k = ilegibles.sort().join(); if (k && k !== ESC.ilegibles) toast(`${ilegibles.length === 1 ? 'Una escena del grupo no se puede abrir' : `${ilegibles.length} escenas del grupo no se pueden abrir`}: su disposición no es válida`); ESC.ilegibles = k;
    ALM.escribir = null; recibirLista(vivas, papelera);
  }, err => { clearTimeout(tmr); ESC.cargando = false; if (err && err.code === 'permission-denied') ALM.escribir = false; pintarNav(); toast(err && err.code === 'permission-denied' ? 'La clave del grupo no es válida' : 'No se pueden leer las escenas del grupo ahora mismo'); });
}

// --- lista recibida (de cualquier almacén) ---
function recibirLista(vivas, papelera) {
  const orden = (a, b) => (b.editado || b.creado || '').localeCompare(a.editado || a.creado || '');
  ESC.lista = vivas.sort(orden); ESC.papelera = papelera.sort(orden); ESC.cargando = false;
  if (ESC.cur && idxActual() < 0) pasarAMesa('La escena abierta se ha borrado; lo que ves queda en Tu mesa');
  pintarNav();
}

// --- navegar ---
function abrirEscena(i, opts = {}) {
  if (D.playing || CALC.activo || D.buscando) { toast('Espera a que termine la demo o el cálculo'); return; }
  const actual = idxActual(); if (i === actual && !opts.forzar) return;
  if (i === -1) { // volver a la copia de trabajo
    ESC.cur = null; ESC.base = null; L = mesaLocal(); aplicarLayout(); pintarNav(); toast('Tu mesa'); return;
  }
  const e = ESC.lista[i]; if (!e || !e.layout) return;
  const r = migrarLayout(e.layout); if (r.error) { toast(`No se puede abrir «${e.nombre}»: ${r.error}`); return; } // no cambia nada
  if (!ESC.cur) guardarMesaYa(); // al salir de tu mesa queda guardada tal cual
  ESC.cur = { id: e.id }; ESC.basada = null;
  L = r.layout; aplicarLayout(); ESC.base = jsonL();
  aplicarAjustes(e.ajustes); if (e.vista && e.vista.p) animarCam(new THREE.Vector3(...e.vista.p), new THREE.Vector3(...e.vista.t));
  pintarNav(); if (!opts.silencio) toast(`${e.nombre} · ${ALM.quien(e)}${r.soloLectura ? ' · solo lectura (versión más nueva del gemelo)' : ''}`);
}
function pasarAMesa(motivo) { // la escena abierta se ha modificado: lo editado pasa a ser tu mesa y la escena no cambia
  const e = ESC.lista[idxActual()] || (ESC.cur && ESC.ultima); respaldarMesa();
  ESC.basada = e ? { id: e.id, autor: e.autor, nombre: e.nombre, nota: e.nota } : ESC.basada; ESC.cur = null; ESC.base = null; guardarLocal(); pintarNav();
  if (e) toast(motivo || `Editas una copia de «${e.nombre}» en Tu mesa; la escena original no cambia`);
}
function vigilarEscena() { if (ESC.cur && !D.activo && !D.buscando && !EDITANDO && jsonL() !== ESC.base) pasarAMesa(); }

// --- pintar la barra y el panel ---
function pintarNav() {
  const i = idxActual(), n = ESC.lista.length, e = ESC.lista[i]; if (e) ESC.ultima = e;
  $('#escNom').textContent = e ? e.nombre : ESC.basada ? `Tu mesa · copia de «${ESC.basada.nombre}»` : 'Tu mesa (sin guardar)';
  $('#escMeta').textContent = e ? `${ALM.quien(e)} · ${i + 2} de ${n + 1}` : `${n ? `1 de ${n + 1} · ${n} ${n === 1 ? 'escena guardada' : 'escenas guardadas'}` : ESC.cargando ? 'cargando escenas…' : 'ninguna escena guardada'}`;
  $('#escDot').className = 'dot ' + (e && e.estado ? (e.estado.ok ? 'ok' : 'bad') : 'none');
  $('#escPrev').disabled = i <= -1; $('#escNext').disabled = i >= n - 1;
  if (!$('#escPop').hidden) pintarPop();
}
function propiaEditable() { // la escena que «Guardar cambios» sobrescribiría
  if (!ALM.modo) return null;
  const e = ESC.lista[idxActual()] || (ESC.basada && ESC.lista.find(x => x.id === ESC.basada.id));
  return e && ALM.editable(e) ? e : null;
}
function pintarPop() {
  const i = idxActual(), prop = propiaEditable(), fs = ALM.modo === 'firestore';
  const ro = soloLectura(), puede = !!ALM.modo && ALM.escribir !== false && !ro;
  $('#escGuardarSec').hidden = !puede; $('#escSoloLectura').hidden = puede;
  $('#escSoloLectura').innerHTML = ro ? `Esta disposición es de una versión más nueva del gemelo (v${L.version}; esta página es la v${LAYOUT.VERSION}). Se abre en <b>solo lectura</b>: no se guarda en Tu mesa ni en el grupo hasta que abras una escena compatible. Puedes copiar su código para pasarla.`
    : ALM.aviso || 'Las escenas del grupo solo se ven al abrir la página en claude.ai con la sesión iniciada. Aquí puedes pasar escenas con un código (abajo).';
  $('#escAutorFila').hidden = !fs; if (fs && document.activeElement !== $('#escAutor')) $('#escAutor').value = ALM.yo || '';
  $('#escCambios').hidden = !prop; if (prop) $('#escCambios').textContent = `Guardar cambios en «${prop.nombre}»`;
  const fila = (k, e) => {
    const borrar = e && ALM.modo && ALM.escribir !== false && ALM.borrable(e);
    return `<li ${k === i ? 'aria-current="true"' : ''}><div class="escInfo"><b>${e ? esc(e.nombre) : 'Tu mesa'}</b>
      <small>${e ? `${esc(ALM.quien(e))} · ${fechaCorta(e.editado || e.creado)}` : 'tu copia de trabajo, guardada solo en este navegador'}</small>
      ${e ? `<div>${pillEstado(e)} <span class="hint">${esc(e.ajustes ? `${e.ajustes.pedido || e.layout.pedido || 2} platos · ${e.ajustes.modo || 'M0'} · balanceo ${fmt((e.ajustes.amp ?? 0.02) * 100, 1)} cm` : '')}</span></div>` : ''}
      ${e && e.nota ? `<p>${esc(e.nota)}</p>` : ''}${e && e.estado && !e.estado.ok ? `<p class="hint">${esc(e.estado.txt)}</p>` : ''}</div>
      <div class="btns">${k === i ? '<span class="hint">abierta</span>' : `<button class="btn" data-abrir="${k}">Abrir</button>`}${borrar ? `<button class="btn" data-borrar="${k}">${ESC.borrarId === e.id ? '¿Seguro?' : fs ? 'A la papelera' : 'Borrar'}</button>` : ''}</div></li>`;
  };
  $('#escLista').innerHTML = fila(-1, null) + ESC.lista.map((e, k) => fila(k, e)).join('')
    + (ESC.lista.length ? '' : `<li><div class="escInfo"><small>${ESC.cargando && ALM.modo ? 'Cargando escenas…' : 'Todavía no hay escenas guardadas.'}</small></div></li>`);
  $('#escCuenta').textContent = ESC.lista.length ? `(${ESC.lista.length})` : '';
  const pap = ESC.papelera || []; $('#escPapelera').hidden = !fs || !pap.length; $('#escPapCuenta').textContent = pap.length;
  $('#escPapLista').innerHTML = pap.map((e, k) => `<li><div class="escInfo"><b>${esc(e.nombre)}</b><small>${esc(ALM.quien(e))}${e.borradoPor ? ` · la borró ${esc(e.borradoPor === ALM.yo ? 'tú' : e.borradoPor)}` : ''} · ${fechaCorta(e.editado)}</small></div>
    <div class="btns"><button class="btn" data-restaurar="${k}">Restaurar</button><button class="btn" data-def="${k}">${ESC.borrarId === 'def:' + e.id ? '¿Seguro? Se pierde' : 'Borrar para siempre'}</button></div></li>`).join('');
  $('#escRecuperar').hidden = !leerLS(CLAVE_PREV);
}
function abrirPop() {
  vigilarEscena(); // si la escena abierta se ha tocado, lo que se guarda es la copia
  const pop = $('#escPop'), r = $('#escNav').getBoundingClientRect();
  const e = ESC.lista[idxActual()], prop = propiaEditable();
  $('#escNombre').value = e ? e.nombre : prop ? prop.nombre : ESC.basada ? `${ESC.basada.nombre} (variante)` : ''; // la copia de una escena ajena se guarda como variante
  $('#escNota').value = e ? e.nota || '' : ESC.basada ? ESC.basada.nota || '' : '';
  pop.style.top = `${Math.round(r.bottom + 8)}px`; pop.hidden = false; $('#escCur').setAttribute('aria-expanded', 'true'); pintarPop();
}
function cerrarPop() { $('#escPop').hidden = true; $('#escCur').setAttribute('aria-expanded', 'false'); ESC.borrarId = null; }

// --- guardar y borrar ---
async function guardarEscena(modo) {
  const nombre = $('#escNombre').value.trim(), nota = $('#escNota').value.trim();
  if (!ALM.modo) return; if (D.playing) { toast('Pausa la demo para guardar'); return; }
  if (soloLectura()) { toast(`Esta disposición es de una versión más nueva del gemelo (v${L.version}): se ve en solo lectura y no se puede guardar`); return; }
  const largo = LAYOUT.noGuardable(jsonL()); if (largo) { toast(`No se guarda: ${largo}`); return; } // las reglas de Firestore la rechazarían (I2)
  if (ALM.modo === 'firestore') { const a = $('#escAutor').value.trim().slice(0, 40); if (!a) { toast('Escribe tu nombre para que el grupo sepa de quién es'); $('#escAutor').focus(); return; } ALM.yo = a; ponerLS(CLAVE_NOMBRE, a); }
  if (!nombre) { toast('Ponle un nombre a la escena'); $('#escNombre').focus(); return; }
  const prop = modo === 'cambios' ? propiaEditable() : null;
  $$('#escGuardarSec button').forEach(b => b.disabled = true);
  try {
    if (!planesAlDia()) await calcularPlanes(); // se guarda con su comprobación previa, para que el grupo vea si es viable
    const graves = comprobarPlan().filter(c => c.grave);
    // durante el cálculo, Importar o Recuperar pueden haber cambiado L: se vuelve a comprobar lo que se va a guardar
    if (soloLectura()) { toast(`Esta disposición es de una versión más nueva del gemelo (v${L.version}): se ve en solo lectura y no se puede guardar`); return; }
    const txt = jsonL(), largo2 = LAYOUT.noGuardable(txt); if (largo2) { toast(`No se guarda: ${largo2}`); return; } // lo que se guarda es este texto
    const ahora = new Date().toISOString();
    const item = { nombre: nombre.slice(0, 60), nota: nota.slice(0, 500), creado: ahora, editado: ahora, layout: JSON.parse(txt), ajustes: ajustesDemo(), vista: vistaActual(),
      estado: { ok: !graves.length, n: graves.length, txt: graves.length ? graves[0].txt.slice(0, 300) : 'La comprobación previa no encuentra problemas.' } };
    const g = await ALM.guardar(item, prop);
    ESC.cur = { id: g.id }; ESC.basada = null; ESC.base = jsonL(); // ahora estás en la escena guardada
    ESC.lista = [g, ...ESC.lista.filter(e => e.id !== g.id)]; pintarNav();
    toast(prop ? 'Cambios guardados' : 'Escena guardada: el grupo ya puede verla'); cerrarPop();
  } catch (e) {
    const c = e && e.code;
    if (c === 'invalid_argument' || c === 'permission-denied') { ALM.escribir = false; pintarPop(); toast('No tienes permiso para guardar escenas'); }
    else if (c === 'lleno') toast(`Ya tienes ${MAX_ESC} escenas guardadas: borra alguna antes de guardar otra`);
    else if (c === 'sin_sesion') toast('Inicia sesión en claude.ai para guardar');
    else if (c === 'quota_exceeded' || c === 'resource-exhausted') toast('El almacén de escenas está lleno o saturado: borrad alguna o probad más tarde');
    else toast('No se ha podido guardar; inténtalo otra vez');
  } finally { $$('#escGuardarSec button').forEach(b => b.disabled = false); }
}
let tConfirmar = 0;
function confirmar(id) { // dos pulsaciones para lo que no se deshace fácilmente
  clearTimeout(tConfirmar); // cada pulsación anula el plazo de 4 s de la anterior (H2: si no, un plazo viejo deshacía una confirmación nueva)
  if (ESC.borrarId === id) { ESC.borrarId = null; return true; }
  ESC.borrarId = id; pintarPop(); tConfirmar = setTimeout(() => { if (ESC.borrarId === id) { ESC.borrarId = null; if (!$('#escPop').hidden) pintarPop(); } }, 4000); return false;
}
async function borrarEscena(k) {
  const e = ESC.lista[k]; if (!e || !confirmar(e.id)) return;
  try {
    await ALM.borrar(e);
    if (ESC.cur && ESC.cur.id === e.id) pasarAMesa('La escena abierta se ha borrado; lo que ves queda en Tu mesa');
    ESC.lista = ESC.lista.filter(x => x.id !== e.id); pintarNav(); toast(ALM.modo === 'firestore' ? 'Escena movida a la papelera' : 'Escena borrada');
  } catch (er) { toast('No se ha podido borrar'); }
}

// --- código de escena (para pasarla sin guardarla en el grupo) ---
function codigoEscena() {
  const e = ESC.lista[idxActual()];
  const o = { v: 1, nombre: $('#escNombre').value.trim() || (e ? e.nombre : 'Escena'), nota: $('#escNota').value.trim(), layout: L, ajustes: ajustesDemo(), vista: vistaActual() };
  return 'GEMELO1.' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function abrirCodigo(t) {
  const m = /GEMELO1\.([A-Za-z0-9+/=]+)/.exec(String(t).replace(/\s+/g, '')); if (!m) { toast('Eso no parece un código de escena'); return; }
  let o; try { o = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) { toast('El código está incompleto'); return; }
  if (!o || typeof o !== 'object' || !o.layout) { toast('El código no trae una disposición'); return; } // también si el JSON es null o no es un objeto
  const r = migrarLayout(o.layout); if (r.error) { toast(`El código no trae una disposición válida: ${r.error}`); return; } // no cambia nada
  if (D.playing || CALC.activo) { toast('Espera a que termine la demo o el cálculo'); return; }
  vaciarGuardado(); respaldarMesa(); ESC.cur = null; ESC.base = null; ESC.basada = { id: null, autor: null, nombre: o.nombre || 'Escena', nota: o.nota || '' };
  L = r.layout; aplicarLayout(); aplicarAjustes(o.ajustes); if (o.vista && o.vista.p) animarCam(new THREE.Vector3(...o.vista.p), new THREE.Vector3(...o.vista.t));
  pintarNav(); cerrarPop();
  toast(r.soloLectura ? `Abierta en Tu mesa en solo lectura: ${o.nombre || 'la escena'} es de una versión más nueva del gemelo (v${L.version})`
    : `Abierta en Tu mesa: ${o.nombre || 'escena'}${ALM.modo && ALM.escribir !== false ? '. Guárdala para que la vea el grupo' : ''}`);
}

function iniciarEscenas() {
  pintarNav();
  if (window.FIREBASE_CONFIG) iniciarFirestore();
  else if (DB) iniciarClaude();
  else { ESC.cargando = false; pintarNav(); }
}

// --- eventos ---
$('#escPrev').addEventListener('click', () => abrirEscena(idxActual() - 1));
$('#escNext').addEventListener('click', () => abrirEscena(idxActual() + 1));
$('#escCur').addEventListener('click', () => $('#escPop').hidden ? abrirPop() : cerrarPop());
$('#escGuardarBtn').addEventListener('click', () => abrirPop());
$('#escCerrar').addEventListener('click', cerrarPop);
$('#escNueva').addEventListener('click', () => guardarEscena('nueva'));
$('#escCambios').addEventListener('click', () => guardarEscena('cambios'));
$('#escAutor').addEventListener('change', e => { ALM.yo = e.target.value.trim().slice(0, 40); ponerLS(CLAVE_NOMBRE, ALM.yo || null); pintarNav(); });
$('#escLista').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.abrir) { abrirEscena(+b.dataset.abrir); cerrarPop(); }
  if (b.dataset.borrar) borrarEscena(+b.dataset.borrar);
});
$('#escPapLista').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return; const pap = ESC.papelera || [];
  try {
    if (b.dataset.restaurar) { await ALM.restaurar(pap[+b.dataset.restaurar]); toast('Escena restaurada'); }
    if (b.dataset.def) { const x = pap[+b.dataset.def]; if (x && confirmar('def:' + x.id)) { await ALM.borrarDef(x); toast('Escena borrada para siempre'); } }
  } catch (er) { toast('No se ha podido completar'); }
});
$('#escCopiar').addEventListener('click', async () => { const c = codigoEscena(); try { await navigator.clipboard.writeText(c); toast('Código copiado: pégalo en un mensaje'); } catch (e) { $('#escCodigo').value = c; $('#escCodigo').select(); toast('Selecciona el código y cópialo'); } });
$('#escAbrirCod').addEventListener('click', () => abrirCodigo($('#escCodigo').value));
$('#escRecuperar').addEventListener('click', () => {
  const prev = leerLS(CLAVE_PREV); if (!prev) return;
  const r = migrarLayout(prev); if (r.error) { toast(`No se puede recuperar tu mesa anterior: ${r.error}`); return; } // no cambia nada
  vaciarGuardado();
  if (!r.soloLectura) { ponerLS(CLAVE_PREV, null); ponerLS(CLAVE, prev); } // una disposición más nueva se abre sin escribirla en Tu mesa
  ESC.cur = null; ESC.basada = null; ESC.base = null; L = r.layout; aplicarLayout(); pintarNav(); cerrarPop(); toast('Recuperada tu mesa anterior');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#escPop').hidden) cerrarPop(); });
document.addEventListener('pointerdown', e => { const p = $('#escPop'); if (!p.hidden && !p.contains(e.target) && !e.target.closest('#escNav')) cerrarPop(); });
