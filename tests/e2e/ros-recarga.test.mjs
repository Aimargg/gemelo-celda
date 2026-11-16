// Común-C1 tras recargar (T2.2–T2.5; D8, I7): la misma Tu mesa, guardada y vuelta a abrir, da los mismos bytes en todos los
// ficheros de ROS. Salió de ros.test.mjs al aceptar T2.3 + T2.5 y está en el nivel de puerta: la escena de colisión lleva el
// giro de las cajas del plan del gemelo (DT38), así que las dos páginas calculan antes de exportar (unos 46 s), y el nivel de
// tarea ya no tenía ese margen. En la tarea, Común-C1 se comprueba en una misma página (ros) y contra las referencias
// (ros-referencias).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { arrancarServidor } from '../servidor.mjs';
import { abrir, comprobar, esperarPlanes } from '../navegador.mjs';
import { CASOS_YAML, aplicarCaso } from '../medir.mjs';

let srv;
before(async () => { srv = await arrancarServidor(); });
after(async () => { await srv?.cerrar(); });

// Recargar = volver a abrir el gemelo con la misma Tu mesa guardada (localStorage). Se hace en un navegador nuevo con ese
// almacenamiento y no con page.reload(): con SwiftShader, la página vieja vacía antes los fotogramas acumulados y la recarga
// tarda 22–26 s más (medido; DT33). Lo que se comprueba es lo mismo: lo exportado sale de la disposición guardada y de nada
// que quede en memoria.
test('Común-C1: tras recargar la página (la misma Tu mesa), la misma disposición da los mismos bytes en todos los ficheros', { timeout: 300000 }, async () => {
  let antes;
  const s = await abrir(srv.url);
  try {
    await aplicarCaso(s.page, CASOS_YAML.find(c => c.id === '203-prefijo'));
    // el giro de las cajas de la escena es el del plan del gemelo (DT38): las dos páginas, con las trayectorias al día
    await s.page.evaluate(() => window.__g.calcularPlanes('gemelo')); await esperarPlanes(s.page);
    antes = await s.page.evaluate(() => ({ L: JSON.stringify(window.__g.L()), f: window.__g.ficherosRos() }));
    // Tu mesa se guarda a los 400 ms del último cambio: se espera a que esté escrita
    await s.page.waitForFunction(l => localStorage.getItem('gemelo-ur3e-v4') === l, antes.L, { timeout: 30000, polling: 50 });
    comprobar(s.reg);
  } finally { await s.cerrar(); }
  // el mismo almacenamiento antes de que arranque la página (una sola carga en ese contexto)
  const s2 = await abrir(srv.url, { initScripts: [`localStorage.setItem('gemelo-ur3e-v4', ${JSON.stringify(antes.L)});`] });
  try {
    // abrir() ha esperado al primer cálculo: la escena lleva el giro de las cajas del plan, como en la primera página
    const despues = await s2.page.evaluate(() => ({ L: JSON.stringify(window.__g.L()), f: window.__g.ficherosRos() }));
    assert.equal(despues.L, antes.L, 'la misma disposición tras recargar');
    assert.deepEqual(despues.f, antes.f);
    comprobar(s2.reg);
  } finally { await s2.cerrar(); }
});
