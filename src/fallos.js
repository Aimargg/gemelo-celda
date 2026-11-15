// ======================= Fallos: explicación y búsqueda de una disposición que funcione =======================
// Diagnóstico de un punto al que no se llega: ¿fuera de alcance o en choque? Devuelve la información para explicarlo.
// Mira todas las soluciones de la cinemática inversa, no solo la más cercana: si alguna choca con el entorno, el motivo real es ese obstáculo
function diagnosticarPunto(p, yaw, opts = {}) {
  const base = { causa: 'alcance', choque: null, q: null, punto: p.clone(), horiz: !!opts.horiz };
  const sols = []; const yaws = opts.horiz ? [yaw] : opts.sym === false ? [yaw] : [yaw, yaw + PI];
  for (const y of yaws) for (const fl of opts.horiz && !opts.flip ? [1, -1] : [opts.flip]) { const q = ikTCP(p, y, robot.q, { ...opts, flip: fl, sinColision: true }); if (q && !sols.some(s => Math.max(...s.map((v, i) => Math.abs(v - q[i]))) < 0.05)) sols.push(q); }
  if (!sols.length) { // ¿existe postura si se deja bajar la muñeca por debajo del tablero? entonces lo que estorba es la mesa
    const qm = ikTCP(p, yaw, robot.q, { ...opts, minZ: -1, sinColision: true });
    return qm ? { ...base, causa: 'choque', q: qm, detalleChoque: 'el brazo con la mesa (la muñeca o la pinza tendrían que pasar por debajo del tablero)' } : { ...base, causa: causaSinIK(p, yaw, opts) };
  }
  const ctx = ctxDe(opts); const cs = sols.map(q => ({ q, c: choqueEn(q, ctx) }));
  const elegido = cs.find(x => x.c && x.c.tipo !== 'auto') || cs.find(x => x.c) || cs[0];
  if (!elegido.c) return { ...base, causa: 'sin_trayectoria', q: elegido.q }; // hay postura libre, pero no se llega a ella desde la actual
  return { ...base, causa: causaDe(elegido.c), choque: elegido.c, q: elegido.q };
}
function causaDe(c) { return c ? (c.tipo === 'auto' ? 'autocolision' : 'choque') : null; }
const OBJ_FASE = { fruta: ['zona'], soltar: ['plato'], plato: ['plato', 'caja'], transporte: ['persona'], bandeja: ['persona'], salida: ['persona'], reposo: ['persona'], transito: ['persona'] };
// Lo que no puede existir en la celda real: platos fuera de la mesa, encima de la base, solapados o sobre la fruta; zona fuera de la mesa; persona dentro de la mesa
const R_BASE = 0.064; // radio de la base del UR3e (Ø 128 mm)
function distRect(x, y, z) { const c = Math.cos(-(z.yaw || 0)), s = Math.sin(-(z.yaw || 0)); const lx = (x - z.x) * c - (y - z.y) * s, ly = (x - z.x) * s + (y - z.y) * c; return Math.hypot(Math.max(Math.abs(lx) - z.w / 2, 0), Math.max(Math.abs(ly) - z.d / 2, 0)); }
function problemasFisicos(l) {
  const out = []; const b = BASES[l.robot]; const act = platosActivos().map(a => a[0]); const n = pk => pk === 'plato1' ? '1º' : '2º';
  for (const pk of act) { const p = l[pk];
    if (Math.abs(p.x) > MESA.w / 2 - PLATO_R + 0.01 || Math.abs(p.y) > MESA.d / 2 - PLATO_R + 0.01) out.push({ txt: `El plato ${n(pk)} se sale de la mesa.`, objs: [pk] });
    if (Math.hypot(p.x - b.x, p.y - b.y) < R_BASE + PLATO_R + 0.01) out.push({ txt: `El plato ${n(pk)} está encima de la base del robot.`, objs: [pk] });
    if (distRect(p.x, p.y, l.zona) < PLATO_R) out.push({ txt: `El plato ${n(pk)} pisa la zona de fruta: quedaría encima de las piezas.`, objs: [pk, 'zona'] }); }
  if (act.length === 2 && Math.hypot(l.plato1.x - l.plato2.x, l.plato1.y - l.plato2.y) < 2 * PLATO_R + 0.005) out.push({ txt: 'Los dos platos se solapan.', objs: ['plato1', 'plato2'] });
  const z = l.zona, ex = Math.abs(Math.cos(z.yaw || 0)) * z.w / 2 + Math.abs(Math.sin(z.yaw || 0)) * z.d / 2, ey = Math.abs(Math.sin(z.yaw || 0)) * z.w / 2 + Math.abs(Math.cos(z.yaw || 0)) * z.d / 2;
  if (Math.abs(z.x) + ex > MESA.w / 2 + 0.005 || Math.abs(z.y) + ey > MESA.d / 2 + 0.005) out.push({ txt: 'La zona de fruta se sale de la mesa.', objs: ['zona'] });
  if (distRect(b.x, b.y, z) < R_BASE) out.push({ txt: 'La zona de fruta está encima de la base del robot.', objs: ['zona'] });
  const pe = l.persona; if (Math.abs(pe.x) < MESA.w / 2 + 0.15 && Math.abs(pe.y) < MESA.d / 2 + 0.15) out.push({ txt: 'La persona está dentro de la mesa.', objs: ['persona'] });
  return out;
}
function objetosDe(info) {
  if (info.causa === 'previo' && info.items) return [...new Set(info.items.flatMap(i => objetosDe(i.info || {})))];
  if (info.fase === 'disposicion') return info.objs || [];
  if (info.fase === 'fruta') return ['zona', ...platosActivos().map(a => a[0]).filter(pk => distRect(L[pk].x, L[pk].y, L.zona) < 0.2)]; // los platos pegados a la zona estorban al coger la fruta
  const o = new Set(); if (info.choque && /bandeja|persona|manos/.test(info.choque.b || '')) o.add('persona'); for (const k of (OBJ_FASE[info.fase] || ['plato', 'persona'])) o.add(k === 'plato' ? (info.pk || 'plato1') : k); return [...o]; }

// Texto llano del motivo, de lo que haría el robot real y de qué cambiar
function explicar(info) {
  const b = BASES[L.robot]; const P = info.punto; const bp = P ? enBase(P) : null; const r = bp ? Math.hypot(bp.x, bp.y) : 0; const n = info.pk === 'plato2' ? '2º' : '1º';
  const o = { porque: '', real: '', cambiar: [] };
  switch (info.causa) {
    case 'alcance': {
      let extra = ''; if (bp && !info.horiz) { const pa = radioA(clamp(bp.z, 0, 0.4)); if (pa && pa.rmax !== null) extra = ` Con la pinza vertical, a esa altura llega de ${mm(pa.rmin)} a ${mm(pa.rmax)} mm.`; else extra = ' Con la pinza vertical no llega a ningún punto a esa altura.'; }
      if (bp && !info.horiz) { const pa = radioA(clamp(bp.z, 0, 0.4)); if (pa && pa.rmax !== null) o.dir = r < pa.rmin ? 'cerca' : r > pa.rmax ? 'lejos' : null; }
      o.porque = `El punto está a ${mm(r)} mm del eje de la base y a ${mm(bp ? bp.z : 0)} mm sobre la mesa. Con la pinza ${info.horiz ? 'horizontal (20 cm por delante de la muñeca)' : 'vertical'} el UR3e no llega ahí${o.dir === 'cerca' ? ': está demasiado pegado a la base' : o.dir === 'lejos' ? ': está demasiado lejos' : ''}.${extra}`;
      o.real = 'No hay solución de cinemática inversa: MoveIt no puede planificar el paso y el coordinador pasa a error.'; break;
    }
    case 'ik_calibrada': // T1.4-5: hay ramas de la IK analítica nominal, pero ninguna converge con la calibración
      o.porque = `IK calibrada no converge. La cinemática inversa analítica del UR3e nominal tiene solución para ese punto (a ${mm(r)} mm del eje de la base y ${mm(bp ? bp.z : 0)} mm sobre la mesa), pero ninguna de sus ramas converge con la calibración del robot ${ROB.id}: el gemelo no sabe si el robot calibrado llega.`;
      o.real = `MoveIt resuelve la cinemática inversa con su propio método sobre el URDF calibrado y puede encontrar una postura o no: compruébalo en sim_${ROB.id} antes de dar el punto por imposible.`; break;
    case 'autocolision':
      o.porque = `Para llegar, el brazo tendría que plegarse sobre sí mismo: chocaría ${textoChoque(info.choque)}. Pasa cuando el objetivo queda muy cerca de la base, muy bajo o la muñeca tiene que doblarse hacia atrás.`;
      o.real = 'MoveIt rechaza la postura por autocolisión; si se forzara, el robot se golpearía a sí mismo.'; break;
    case 'choque':
      o.porque = `En ese movimiento chocaría ${info.detalleChoque || textoChoque(info.choque)}.`;
      if (info.choque && /bandeja|persona|manos/.test(info.choque.b) && D.amp > 0.02) o.cambiar.push(`La bandeja se balancea ${fmt(D.amp * 100, 1)} cm, más que el movimiento natural (2 cm o menos) y llega a meterse en el camino del brazo: baja el balanceo.`);
      o.real = info.detalleChoque ? 'MoveIt no encuentra una postura que no atraviese la mesa: el paso no se puede planificar.' : info.choque && /persona|manos/.test(info.choque.b) ? 'Es un contacto con una persona: el robot real tiene que evitarlo siempre, aunque sea a poca velocidad.' : 'Con ese objeto en la escena de colisión, MoveIt no lo planifica; sin él, el robot real chocaría.'; break;
    case 'singularidad':
      o.porque = 'La pinza tendría que seguir una recta que pasa cerca de una singularidad: alguna articulación giraría de golpe (más de 8° en 4 mm de recorrido).';
      o.real = 'El UR3e se pararía por exceso de velocidad articular o cambiaría de postura de golpe.'; break;
    case 'sin_trayectoria':
      o.porque = 'Desde la postura actual no hay ningún camino sin choques hasta la siguiente: los obstáculos lo cierran en todas las direcciones probadas.';
      o.real = 'MoveIt devolvería «no se encuentra plan» tras agotar el tiempo de planificación.'; break;
    case 'bandeja_movida':
      o.porque = `La bandeja estuvo más de 10 s a más de 25 mm de donde se recibió (la última desviación fue de ${mm(info.dev || 0)} mm). El balanceo actual es de ${fmt(D.amp * 100, 1)} cm.`;
      o.real = 'Según DEC-04, Robótica aborta, publica /service_state abortado y retira el brazo.';
      o.cambiar.push('Baja el balanceo a 2 cm o menos (es lo que se considera movimiento natural).', 'O usa M1 (seguir la bandeja), que coloca aunque se mueva.'); o.fijo = true; break;
    case 'alcance_bandeja': case 'tiempo':
      o.porque = 'La bandeja se movió hasta una zona donde el robot no puede seguirla sin cambiar de postura, o más deprisa de lo que el brazo puede seguir.';
      o.real = 'El coordinador aborta la colocación y retira el brazo.';
      o.cambiar.push('Baja el balanceo de la bandeja o la velocidad de seguimiento.'); o.fijo = true; break;
    case 'fruta': o.porque = info.detalle || 'No hay forma de coger esa pieza con la pinza vertical sin tocar las de al lado.'; o.real = 'El nodo de agarre de Visión 2 no devolvería un agarre válido.'; break;
    case 'previo': o.porque = 'Antes de mover nada, el coordinador ensaya en seco cada paso (coger, soltar, levantar, llevar nivelado y dejar) y alguno no es posible:'; o.real = 'El coordinador rechazaría el pedido antes de mover el brazo: la demo no llega a empezar.'; break;
    default: o.porque = info.detalle || ''; o.real = '';
  }
  if (!o.fijo) {
    const ob = objetosDe(info);
    if (ob.includes('zona')) o.cambiar.push(o.dir === 'cerca' ? 'Aleja la zona de fruta de la base del robot.' : o.dir === 'lejos' ? 'Acerca la zona de fruta a la base del robot.' : 'Acerca la zona de fruta a la base del robot o sepárala de los platos.');
    for (const pk of ob.filter(x => x.startsWith('plato'))) { const np = pk === 'plato1' ? '1º' : '2º'; o.cambiar.push(o.dir === 'cerca' ? `Aleja el plato ${np} de la base del robot.` : o.dir === 'lejos' ? `Acerca el plato ${np} a la base del robot.` : `Mueve el plato ${np}: suele bastar con acercarlo o alejarlo unos centímetros de la base, o girarlo alrededor de ella.`); }
    if (ob.includes('caja')) o.cambiar.push(`Cambia la altura de la caja (ahora ${Math.round(L.caja.h * 100)} cm).`);
    if (ob.includes('persona')) o.cambiar.push('Mueve a la persona o cambia la altura de la bandeja: la bandeja tiene que quedar a unos 40–50 cm de la base y con las dos zonas a la misma distancia.');
  }
  return o;
}
function lineaInfo(info) {
  const a = info.accion ? `Al ${info.accion}` : ''; const P = info.punto ? enBase(info.punto) : null;
  return `${a}${P ? `${a ? ', ' : ''}en el punto (${mm(P.x)}, ${mm(P.y)}, ${mm(P.z)}) mm de base_link` : ''}${info.pct !== undefined ? `; la recta llega al ${info.pct} %` : ''}.`;
}
function mostrarFalloInfo(e, titulo, tipo) {
  if (D.buscando) return; // durante la búsqueda, las demos de prueba no tocan la tarjeta
  const info = e.info || {}; D.ultFallo = { info, titulo, tipo, msg: e.message, paso: D.paso };
  const x = explicar(info); const f = $('#dFallo'); f.hidden = false; f.className = 'card fallo' + (tipo === 'abort' ? ' abort' : '');
  const items = info.causa === 'previo' && info.items ? `<ul class="falloLista">${info.items.map(i => `<li>${i.txt}</li>`).join('')}</ul>` : '';
  const buscar = !['bandeja_movida', 'alcance_bandeja', 'tiempo'].includes(info.causa);
  f.innerHTML = `<div class="falloCab"><b>${titulo}</b><span>${info.causa === 'previo' ? '' : lineaInfo(info)}</span></div>
    <dl class="falloKv"><dt>Por qué</dt><dd>${x.porque}${items}</dd>${x.real ? `<dt>En el robot real</dt><dd>${x.real}</dd>` : ''}${x.cambiar.length ? `<dt>Qué cambiar</dt><dd><ul class="falloLista">${x.cambiar.map(c => `<li>${c}</li>`).join('')}</ul></dd>` : ''}</dl>
    <div class="btns">${info.q || (info.causa === 'previo' && D.posturaImposible) ? '<button class="btn" id="fVer">Ver dónde falla</button>' : ''}${buscar ? '<button class="btn pri" id="fBuscar">Buscar una disposición que funcione</button>' : ''}</div>
    <div id="dRecom"></div>`;
  const v = $('#fVer'); if (v) v.onclick = () => verFallo(info);
  const bb = $('#fBuscar'); if (bb) bb.onclick = () => buscarAlternativa(info);
}
function verFallo(info) {
  if (info.causa === 'previo' && D.posturaImposible) { verPosturaImposible(); return; }
  if (!info.q) return; D.activo = false; robot.setQ(info.q); sincronizarSliders(); actualizarHUD();
  const c = info.choque;
  if (c) { marcaChoque.position.copy(baseAMundo(c.p[0], c.p[1], c.p[2])); marcaChoque.visible = true; D.marcaHasta = simT + 1e9; }
  else if (info.punto) { objetivo.position.copy(info.punto); objetivo.visible = true; objetivo.userData.anillo.material.color.set(css('--bad')); }
  const t = info.punto || tcpMundo(); animarCam(new THREE.Vector3(t.x - 0.5, t.y - 0.6, t.z + 0.4), t.clone());
}

// ---------- Búsqueda de una disposición cercana que funcione ----------
function candidatos(info) {
  const ob = objetosDe(info);
  if (!ob.length) ob.push('plato1', 'persona');
  const b = BASES[L.robot], out = [];
  const cm = v => Math.round(Math.abs(v) * 100);
  const desplaz = (dx, dy) => [dx ? `${cm(dx)} cm hacia la ${dx > 0 ? 'derecha' : 'izquierda'}` : '', dy ? `${cm(dy)} cm hacia ${dy > 0 ? 'el fondo (lado de los robots)' : 'delante'}` : ''].filter(Boolean).join(' y ');
  for (const pk of ['plato1', 'plato2']) if (ob.includes(pk) && platosActivos().some(a => a[0] === pk)) {
    const n = pk === 'plato1' ? '1º' : '2º'; const r0 = Math.hypot(L[pk].x - b.x, L[pk].y - b.y), f0 = Math.atan2(L[pk].y - b.y, L[pk].x - b.x);
    // si el fallo es de alcance al soltar, primero los radios donde la pinza vertical llega a esa altura
    const its = info.causa === 'previo' ? (info.items || []).map(i => i.info || {}) : [info]; const so = its.find(i => i.fase === 'soltar' && i.pk === pk && i.h !== undefined);
    const pa = so ? radioA(clamp(so.h, 0, 0.4)) : null; const ventana = pa && pa.rmax !== null ? [pa.rmin + 0.03, pa.rmax - 0.03] : null;
    const fuera = r => ventana ? Math.max(0, ventana[0] - r, r - ventana[1]) / 0.03 * 3 : 0;
    if (ventana && fuera(r0) > 0) { // el cambio mínimo: llevarlo radialmente hasta el borde de lo alcanzable, con algún giro por si choca
      const rT = clamp(r0, ventana[0], ventana[1]);
      for (const df of [0, -8, 8, -16, 16]) { const x = b.x + rT * Math.cos(f0 + df * D2R), y = b.y + rT * Math.sin(f0 + df * D2R);
        out.push({ coste: Math.abs(rT - r0) / 0.03 * 0.5 + Math.abs(df) / 8, texto: `Plato ${n}: ${desplaz(x - L[pk].x, y - L[pk].y)} (${rT < r0 ? 'más cerca' : 'más lejos'} de la base: a ${Math.round(rT * 100)} cm)`, f: l => { l[pk].x = x; l[pk].y = y; } }); }
    }
    for (const dr of [0, -0.03, 0.03, -0.06, 0.06, -0.10, 0.10]) for (const df of [0, -8, 8, -16, 16, -30, 30]) {
      if (!dr && !df) continue; if (r0 + dr < 0.2) continue; const x = b.x + (r0 + dr) * Math.cos(f0 + df * D2R), y = b.y + (r0 + dr) * Math.sin(f0 + df * D2R);
      out.push({ coste: Math.abs(dr) / 0.03 + Math.abs(df) / 8 + fuera(r0 + dr), texto: `Plato ${n}: ${desplaz(x - L[pk].x, y - L[pk].y)} (queda a ${Math.round((r0 + dr) * 100)} cm de la base)`, f: l => { l[pk].x = x; l[pk].y = y; } });
    }
  }
  const DEF = layoutDefecto();
  for (const k of ['plato1', 'plato2', 'zona', 'persona']) if (ob.includes(k) && (k === 'zona' || k === 'persona' || platosActivos().some(a => a[0] === k))) {
    const dx = DEF[k].x - L[k].x, dy = DEF[k].y - L[k].y; if (Math.hypot(dx, dy) < 0.02) continue;
    const nom = k === 'zona' ? 'Zona de fruta' : k === 'persona' ? 'Persona' : `Plato ${k === 'plato1' ? '1º' : '2º'}`;
    out.push({ ref: true, coste: 2 + Math.hypot(dx, dy) / 0.05, texto: `${nom}: volver a su posición de referencia (${desplaz(dx, dy)})`, f: l => { l[k].x = DEF[k].x; l[k].y = DEF[k].y; if (k === 'persona') { l.persona.yaw = DEF.persona.yaw; l.bandeja = { ...DEF.bandeja }; } } });
  }
  if (ob.includes('caja') && !L.caja.on) for (const h of [0.10, 0.08, 0.12]) out.push({ coste: 0.5 + Math.abs(h - 0.10) / 0.02, texto: `Poner los platos sobre la caja de ${Math.round(h * 100)} cm (la muñeca deja de rozar la mesa al cogerlos en horizontal)`, f: l => { l.caja.on = true; l.caja.h = h; } });
  else if (ob.includes('caja')) for (const h of [0.06, 0.08, 0.12]) if (Math.abs(h - L.caja.h) > 0.005) out.push({ coste: Math.abs(h - L.caja.h) / 0.02 + 0.5, texto: `Caja de ${Math.round(h * 100)} cm (ahora ${Math.round(L.caja.h * 100)} cm)`, f: l => { l.caja.h = h; } });
  if (ob.includes('zona')) { // hacia la base, por si es de alcance
    const zc = { x: L.zona.x, y: L.zona.y }; const dz = Math.hypot(b.x - zc.x, b.y - zc.y);
    for (const d of [0.05, 0.10, 0.15, 0.20, 0.25, 0.30]) if (d < dz - 0.15) { const ux = (b.x - zc.x) / dz, uy = (b.y - zc.y) / dz; out.push({ coste: d / 0.05 * 0.8, texto: `Zona de fruta: ${desplaz(ux * d, uy * d)} (${Math.round(d * 100)} cm más cerca de la base)`, f: l => { l.zona.x += ux * d; l.zona.y += uy * d; } }); }
  }
  if (ob.includes('zona')) for (const dx of [0, -0.03, 0.03, -0.06, 0.06]) for (const dy of [0, -0.03, 0.03, -0.06]) { if (!dx && !dy) continue; out.push({ coste: (Math.abs(dx) + Math.abs(dy)) / 0.03, texto: `Zona de fruta: ${desplaz(dx, dy)}`, f: l => { l.zona.x += dx; l.zona.y += dy; } }); }
  if (ob.includes('persona')) for (const dx of [0, -0.05, 0.05, -0.10]) for (const dy of [0, -0.05, 0.05, -0.10, 0.10]) for (const dh of [0, 0.04, -0.04]) {
    if (!dx && !dy && !dh) continue; const coste = Math.abs(dx) / 0.05 + Math.abs(dy) / 0.05 + Math.abs(dh) / 0.04; if (coste > 3) continue;
    out.push({ coste, texto: [dx || dy ? `Persona: ${desplaz(dx, dy)} (sigue de frente)` : '', dh ? `Bandeja ${cm(dh)} cm más ${dh > 0 ? 'alta' : 'baja'} (a ${Math.round((L.bandeja.alt + dh) * 100)} cm del suelo)` : ''].filter(Boolean).join(' · '), f: l => { l.persona.x += dx; l.persona.y += dy; l.bandeja.alt += dh; } });
  }
  return out.filter(c => valida(c)).sort((a, c) => a.coste - c.coste);
}
// Disposición físicamente razonable: platos dentro de la mesa, sin pisarse, lejos de la zona de fruta y de la base; persona fuera de la mesa
function valida(c) {
  const l = JSON.parse(JSON.stringify(L)); c.f(l); const b = BASES[l.robot]; const act = platosActivos().map(a => a[0]);
  if (problemasFisicos(l).length) return false;
  for (const pk of act) { const p = l[pk]; if (Math.hypot(p.x - b.x, p.y - b.y) < 0.2) return false;
    if (distRect(p.x, p.y, l.zona) < PLATO_R + 0.01) return false; } // con 1 cm de aire respecto a la zona de fruta
  if (act.length === 2 && Math.hypot(l.plato1.x - l.plato2.x, l.plato1.y - l.plato2.y) < 0.18) return false;
  const pe = l.persona; if (Math.abs(pe.x) < MESA.w / 2 + 0.2 && Math.abs(pe.y) < MESA.d / 2 + 0.2) return false; if (l.bandeja.alt < 0.9 || l.bandeja.alt > 1.15) return false;
  c.layout = l; return true;
}
function aplicarLayoutRapido() { aplicarPedido(); actualizarZona(); actualizarPlatos(); pintarCaja(); actualizarAruco(); aplicarBandeja(simT); VERSION_ESCENA++; }
async function buscarAlternativa(info) {
  if (D.buscando || !robot) return; D.buscando = true; const box = $('#dRecom'); const bt = $('#fBuscar'); if (bt) bt.disabled = true;
  const L0 = JSON.parse(JSON.stringify(L)); const cache0 = { ...CACHE_PLAN }; const cfg = { modo: D.modo, amp: D.amp, vel: D.vel, pedido: L.pedido, fase: D.fase }; const ult = D.ultFallo;
  const todos = candidatos(info); const cands = todos.slice(0, 24).concat(todos.slice(24).filter(c => c.ref)); let cancel = false; const t0 = performance.now(); const pasan = []; D.tBusca = { seco: 0, demo: 0, n: 0 };
  const prog = (t) => { box.innerHTML = `<div class="recom busca"><span class="spin"></span><div><b>Buscando…</b> ${t}</div><button class="btn" id="fCancel">Cancelar</button></div>`; const c = $('#fCancel'); if (c) c.onclick = () => { cancel = true; }; };
  try {
    for (let i = 0; i < cands.length && !cancel && pasan.length < 3; i++) {
      prog(`ensayo en seco ${i + 1} de ${cands.length}: ${cands[i].texto}`); await new Promise(r => setTimeout(r, 30));
      L = JSON.parse(JSON.stringify(cands[i].layout)); aplicarLayoutRapido(); const ts = performance.now(); const chk = comprobarPlan({ parar: true }); D.tBusca.seco += performance.now() - ts; D.tBusca.n++; if (!chk.some(c => c.grave)) pasan.push(cands[i]);
      if (performance.now() - t0 > 90000) break;
    }
    let mejor = null;
    for (let i = 0; i < pasan.length && !cancel; i++) { // la buena es la que completa la demo simulada con los mismos ajustes
      prog(`demo completa simulada con «${pasan[i].texto}» (${cfg.modo}, balanceo ${fmt(cfg.amp * 100, 1)} cm, ${Math.round(cfg.vel * 100)} %)`); await new Promise(r => setTimeout(r, 30));
      L = JSON.parse(JSON.stringify(pasan[i].layout)); aplicarLayoutRapido(); D.mantenerFallo = true;
      const td = performance.now(); const r = await ensayo({ ...cfg, sinRender: true }); D.tBusca.demo += performance.now() - td; if (r.fin === 'ok') { mejor = { ...pasan[i], t: r.t_mov, err: r.errores_mm }; break; }
    }
    L = L0; for (const k in CACHE_PLAN) delete CACHE_PLAN[k]; Object.assign(CACHE_PLAN, cache0); aplicarLayoutRapido(); D.mantenerFallo = true; D.activo = false; reiniciarDemo();
    if (ult) { pintarPasos(ult.paso, true); estado(ult.tipo === 'abort' ? 'ABORTADO' : ult.tipo === 'previo' ? 'NO INICIADO' : 'PARADO'); }
    if (cancel) box.innerHTML = '<div class="recom">Búsqueda cancelada.</div>';
    else if (mejor) {
      box.innerHTML = `<div class="recom ok"><div><b>Disposición recomendada.</b> ${mejor.texto}. Con este cambio la demo completa funciona en la simulación (${cfg.modo}, balanceo ${fmt(cfg.amp * 100, 1)} cm, ${Math.round(cfg.vel * 100)} %): ${fmt(mejor.t, 0)} s de movimiento, error de colocación ${mejor.err.join(' · ')} mm. <span class="hint">[SIN VALIDAR] en el robot real.</span></div><div class="btns"><button class="btn" id="fAplicar">Aplicar</button><button class="btn pri" id="fProbar">Aplicar y reproducir</button></div></div>`;
      $('#fAplicar').onclick = () => { L = JSON.parse(JSON.stringify(mejor.layout)); aplicarLayout(); toast('Disposición aplicada'); };
      $('#fProbar').onclick = () => { L = JSON.parse(JSON.stringify(mejor.layout)); aplicarLayout(); $('#dPlay').click(); };
    } else box.innerHTML = `<div class="recom"><b>No he encontrado una disposición cercana que funcione</b> (${cands.length} probadas, ${pasan.length} pasaron el ensayo en seco pero no la demo completa). Prueba cambios mayores: ${explicar(info).cambiar.join(' ').toLowerCase() || 'mueve los platos y a la persona'}.</div>`;
  } catch (er) { console.error(er); L = L0; aplicarLayoutRapido(); box.innerHTML = '<div class="recom">La búsqueda ha fallado por un error interno.</div>'; }
  D.buscando = false; D.mantenerFallo = false; if (bt) bt.disabled = false;
}
