// Pasada de deuda de F2 (T2.7; D8, I7), en una sola página y en este orden:
//   · DT35: durante la demo, con la bandeja balanceándose, posiciones.yaml y los ficheros de ROS dan las zonas y la bandeja de
//     antes de empezarla (su pose de plan); y una disposición de solo lectura (v10) con un robotId o un prefijo con salto de
//     línea, «#» y comillas da un posiciones.yaml que yaml@2.9.1 lee igual en YAML 1.1 y 1.2, con el escape de los ficheros
//     de ROS (los mismos valores que parametros_celda.yaml).
//   · DT41 (primero, con la página recién cargada): al terminar un cálculo con los planes al día, #btnCalc no se queda
//     desactivado, y un clic justo después de cambiar de robot lanza el cálculo sin esperar al repintado periódico.
//   · DT31: con la demo de DT35 en pausa, cambiar la capa «Robot del otro puesto» la reinicia con su motivo en el aviso.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, esperarPlanes } from '../navegador.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Lo que la exportación dice de la bandeja y sus zonas: líneas de posiciones.yaml, sus ficheros tf/ y el bloque de la bandeja
// de parametros_celda.yaml
const ZONAS = ['bandeja_recepcion', 'zona_primero', 'zona_segundo'];
function deLaBandeja(r) {
  const lineas = Object.fromEntries(r.yaml.split('\n').filter(l => ZONAS.some(k => l.startsWith(`  ${k}: `))).map(l => [l.trim().split(':')[0], l]));
  const tf = Object.fromEntries(r.ficheros.filter(f => /^tf\/(bandeja|zona_primero|zona_segundo)\.yaml$/.test(f.nombre)).map(f => [f.nombre, f.texto]));
  const p = r.ficheros.find(f => f.nombre === 'parametros_celda.yaml').texto, i = p.indexOf('\n      bandeja:\n');
  return { lineas, tf, parametros: p.slice(i, p.indexOf('\n      persona:\n')) };
}
const leer = () => { const g = window.__g, b = g.bandeja.position; return { yaml: g.generarYaml(), ficheros: g.ficherosRos(), bandeja: { x: b.x, y: b.y, z: b.z, yaw: g.bandeja.rotation.z }, D: { activo: g.D.activo, playing: g.D.playing } }; };
// El escape de los ficheros de ROS (cad de src/exportar.js), escrito aquí: los caracteres de control y los separadores de
// línea pasan a espacio (una comilla simple de YAML no puede llevar un salto de línea: lo pliega) y el resto se conserva
const comoROS = s => String(s).replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ');
const RARO = "207\n# robot: 'x' \"y\" #", PREFIJO_RARO = "p\n# 'a' \"b\" #_";

test('T2.7 (DT41, DT35, DT31): #btnCalc tras un cálculo, zonas de plan durante la demo, la capa del otro robot con la demo en pausa y posiciones.yaml de una v10 con textos raros', { timeout: 600000 }, async t => {
  const s = await abrir(srv.url); const p = s.page;
  try {
    await t.test('C8 (DT41): al terminar un cálculo con los planes al día #btnCalc queda activo, y un clic justo después de cambiar de robot no se pierde', async () => {
      // un cálculo que termina con los planes al día (la barra se oculta): se mira en la misma tarea, sin dejar pasar fotogramas
      const fin = await p.evaluate(async () => { const g = window.__g; await g.calcularPlanes(); return { activo: g.CALC.activo, alDia: g.planesAlDiaDe('gemelo'), barra: document.getElementById('calcBar').hidden, desactivado: document.getElementById('btnCalc').disabled }; });
      assert.deepEqual(fin, { activo: false, alDia: true, barra: true, desactivado: false }, 'tras el cálculo, con la barra oculta');
      // cambiar de robot (205: el mismo giro de base_link que el nominal, sin pregunta) y pulsar «Calcular» en la misma tarea,
      // antes de que el repintado periódico (cada 18 fotogramas) vuelva a enseñar la barra
      const r = await p.evaluate(() => {
        const g = window.__g; document.querySelector('#segRobotId [data-v="205"]').click();
        const o = { robot: g.ROB.id, pregunta: !document.getElementById('robotPregunta').hidden, alDia: g.planesAlDiaDe('gemelo'), barra: document.getElementById('calcBar').hidden, desactivado: document.getElementById('btnCalc').disabled };
        document.getElementById('btnCalc').click(); return { ...o, calcula: g.CALC.activo };
      });
      assert.deepEqual(r, { robot: '205', pregunta: false, alDia: false, barra: true, desactivado: false, calcula: true }, 'el botón está activo y el clic lanza el cálculo');
      await esperarPlanes(p);
      // vuelta al nominal, con sus planes, para lo que sigue
      await p.evaluate(async () => { document.querySelector('#segRobotId [data-v="nominal"]').click(); await window.__g.calcularPlanes(); });
      assert.deepEqual(await p.evaluate(() => [window.__g.ROB.id, window.__g.planesAlDiaDe('gemelo'), document.getElementById('btnCalc').disabled]), ['nominal', true, false]);
    });
    await p.click('.tabs [data-tab="datos"]');
    await t.test('C2 (DT35): durante la demo, con la bandeja desplazada, la bandeja y sus zonas exportadas son las de antes de empezarla', async st => {
      const antes = await p.evaluate(leer);
      const durante = await p.evaluate(async leer => {
        const g = window.__g, log = () => [...document.querySelectorAll('#dLog li')].map(li => li.textContent);
        // la demo hasta que la bandeja está arriba y balanceándose (tras /v1/tray_pose), parada como en pausa
        await g.ensayo({ vel: 0.25, fase: 0.37, sinRender: true, limite: 400, modo: 'M0', amp: 0.02, hasta: () => log().some(x => x.includes('/v1/tray_pose')) });
        const V = g.robot.root.position.constructor; g.bandeja.updateMatrixWorld(true);
        const zonas = Object.fromEntries(['zona_primero', 'zona_segundo'].map(k => { const w = g.zonasB[k].getWorldPosition(new V()), b = g.mundoABase(w); return [k, [b.x, b.y, b.z]]; }));
        return { ...new Function(`return (${leer})()`)(), zonasAhora: zonas };
      }, leer.toString());
      assert.deepEqual(durante.D, { activo: true, playing: false }, 'la demo está a medias y parada');
      const d = Math.hypot(durante.bandeja.x - antes.bandeja.x, durante.bandeja.y - antes.bandeja.y, durante.bandeja.z - antes.bandeja.z);
      assert.ok(d > 0.003, `la bandeja dibujada se ha movido ${(d * 1000).toFixed(1)} mm`);
      const A = deLaBandeja(antes), B = deLaBandeja(durante);
      assert.deepEqual(Object.keys(A.lineas), ZONAS); assert.equal(Object.keys(A.tf).length, 3);
      assert.deepEqual(B, A, 'posiciones.yaml (bandeja_recepcion y zonas), tf/bandeja y tf/zona_* y el bloque bandeja de parametros_celda.yaml, iguales');
      // y la red puede fallar: las zonas dibujadas ahora no están donde dice el fichero (en base_link, más de 1 mm)
      for (const [k, w] of Object.entries(durante.zonasAhora)) {
        const m = B.lineas[k].match(/\{x: (-?[\d.]+), 'y': (-?[\d.]+), z: (-?[\d.]+)\}/).slice(1).map(Number), e = Math.hypot(...m.map((v, i) => v - w[i]));
        assert.ok(e > 0.001, `${k}: la zona dibujada está a ${(e * 1000).toFixed(1)} mm de la exportada`);
        st.diagnostic(`${k}: la dibujada, a ${(e * 1000).toFixed(1)} mm de la exportada (la bandeja, a ${(d * 1000).toFixed(1)} mm de su pose de plan)`);
      }
    });
    await t.test('C5 (DT31): con la demo en pausa, cambiar la capa «Robot del otro puesto» la reinicia y el aviso dice el motivo real', async () => {
      const antes = await p.evaluate(() => ({ n: window.__toastsPrueba.length, D: { activo: window.__g.D.activo, playing: window.__g.D.playing }, otro: window.__g.otroVisible() }));
      assert.deepEqual(antes.D, { activo: true, playing: false }, 'la demo de C2 sigue en pausa');
      const cambiar = () => p.evaluate(() => { const c = document.getElementById('lyOtro'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); });
      await cambiar();
      await p.waitForFunction(n => window.__toastsPrueba.slice(n).includes('Demo reiniciada: ha cambiado el robot del otro puesto'), antes.n, { timeout: 30000, polling: 50 });
      const r = await p.evaluate(n => ({ avisos: window.__toastsPrueba.slice(n), activo: window.__g.D.activo, otro: window.__g.otroVisible() }), antes.n);
      assert.ok(!r.avisos.includes('Demo reiniciada para mover objetos'), `el aviso antiguo no sale: ${JSON.stringify(r.avisos)}`);
      assert.deepEqual([r.activo, r.otro], [false, !antes.otro], 'la demo se ha reiniciado y la capa ha cambiado');
      // sin demo a medias, volver a cambiarla no reinicia nada ni avisa
      const n1 = await p.evaluate(() => window.__toastsPrueba.length); await cambiar();
      assert.equal(await p.evaluate(() => window.__g.otroVisible()), antes.otro);
      assert.ok(!(await p.evaluate(n => window.__toastsPrueba.slice(n), n1)).some(x => x.startsWith('Demo reiniciada')), 'sin demo, sin aviso de reinicio');
    });
    await t.test('C2 (DT35): una v10 de solo lectura con salto de línea, «#» y comillas en robotId y prefijoFrames: posiciones.yaml se lee igual en YAML 1.1 y 1.2', async st => {
      const l = await p.evaluate(() => JSON.parse(JSON.stringify(window.__g.L())));
      for (const [robotId, prefijoFrames, conocido] of [[RARO, RARO, false], ['203', PREFIJO_RARO, true]]) {
        const codigo = 'GEMELO1.' + Buffer.from(JSON.stringify({ v: 1, nombre: 'Futura', nota: '', layout: { ...l, version: 10, robotId, prefijoFrames } }), 'utf8').toString('base64');
        await p.evaluate(c => setTimeout(() => window.__g.abrirCodigo(c), 0), codigo); // como desde la interfaz: un error sería un pageerror
        await p.waitForFunction(([id, pf]) => { const L = window.__g.L(); return L.version === 10 && L.robotId === id && L.prefijoFrames === pf; }, [robotId, prefijoFrames], { timeout: 60000, polling: 50 });
        const r = await p.evaluate(() => ({ yaml: window.__g.generarYaml(), par: window.__g.ficherosRos().find(f => f.nombre === 'parametros_celda.yaml').texto, rob: window.__g.ROB.id }));
        assert.equal(r.rob, conocido ? '203' : 'nominal');
        // en los dos modos: sin errores, las mismas claves de primer nivel (nada se sale de su línea) y los textos de la
        // disposición con el escape de los ficheros de ROS, iguales que en parametros_celda.yaml. (Que el resto del fichero se
        // lea igual en 1.1, con fecha y las claves «y» entre comillas, lo prueban datos y exportar: TD.3, DT42)
        const par = YAML.parse(r.par)['/**'].ros__parameters.celda.robot, esperado = [comoROS(robotId), `${comoROS(prefijoFrames)}base_link`, comoROS(prefijoFrames)];
        let v;
        for (const version of ['1.1', '1.2']) {
          const d = YAML.parseDocument(r.yaml, { version }); assert.deepEqual(d.errors, [], `YAML ${version}`); assert.deepEqual(d.warnings, [], `YAML ${version}`); v = d.toJS();
          assert.deepEqual(Object.keys(v), ['fecha', 'robot', 'robot_id', 'frame', 'prefijo_frames', 'world_a_base_link', ...(conocido ? ['pose_en_world_doble'] : []), 'pinza', 'mesa', 'pedido', 'platos', 'objetos', 'camaras'], `YAML ${version}: las mismas claves`);
          assert.deepEqual([v.robot_id, v.frame, v.prefijo_frames], esperado, `YAML ${version}: el valor con el escape de los ficheros de ROS`);
          assert.deepEqual([v.robot_id, v.frame, v.prefijo_frames], [par.id, par.frame, par.prefijo_frames], `YAML ${version}: los mismos valores que parametros_celda.yaml`);
          if (conocido) assert.equal(v.pose_en_world_doble.frame, v.frame, `YAML ${version}: el frame de pose_en_world_doble`);
        }
        // la cabecera: cada línea antes de «fecha:» es un comentario, y la del robot y la del frame dicen el texto tal cual (sin saltos)
        const cab = r.yaml.slice(0, r.yaml.indexOf('\nfecha: ')).split('\n');
        assert.ok(cab.every(x => x.startsWith('# ')), cab.join('\n'));
        assert.ok(cab.some(x => x.startsWith(conocido ? '# Robot: 203 (calibration_203.yaml' : `# Robot: «${comoROS(robotId)}» (desconocido`)), 'línea # Robot:');
        assert.ok(cab.some(x => x.startsWith(`# Frame: ${comoROS(prefijoFrames)}base_link (prefijo «${comoROS(prefijoFrames)}»`)), 'línea # Frame:');
        // la disposición sigue entera en layout-json: el import la recupera tal cual, con sus saltos de línea
        const lj = JSON.parse(r.yaml.match(/^# layout-json: (\{.*\})$/m)[1]);
        assert.deepEqual([lj.robotId, lj.prefijoFrames], [robotId, prefijoFrames]);
        st.diagnostic(`${conocido ? '203' : 'robot desconocido'}: robot_id ${JSON.stringify(v.robot_id)}, frame ${JSON.stringify(v.frame)}`);
      }
    });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
});
