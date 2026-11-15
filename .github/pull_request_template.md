## Qué cambia y por qué

<!-- Fase y tareas del plan (docs/planes/PLAN-gemelo-v9.md) con su hash. Una línea por tarea. -->

## Comprobación

- [ ] `bash tools/check.sh` en verde (pega la última línea y los tiempos de `npm test` y `npm run test:rapido`)
- [ ] `index.html` reconstruido con `npm run build`, sin ediciones a mano; `dist/` no está en el diff
- [ ] Si cambian `tests/fixtures/`, el diff está explicado (qué caso cambia y por qué) y lo pedía una tarea

## Invariantes (marca cada una o explica por qué no aplica)

- [ ] **I1** Toda escena v8 se abre con las mismas posiciones y el mismo veredicto (test `escenas-v8`)
- [ ] **I2** Sin cambios en los campos de escena ni en `web_src/firestore.rules` sin P3; ningún test habla con el Firestore real
- [ ] **I3** La clave del grupo no está en ningún fichero (`tools/check.sh`, paso 1)
- [ ] **I4** El gemelo no envía nada a ROS: sin `advertise`, `publish`, `callService`, `sendGoal` ni `Param.set` fuera del adaptador
- [ ] **I5** El artefacto es un solo HTML; scripts externos solo de `cdn.jsdelivr.net` con versión exacta; la web solo añade `config.js` y `firebase.js`
- [ ] **I6** Misma disposición, robot y perfil dan el mismo plan y veredicto en cualquier orden de cálculo
- [ ] **I7** Exportaciones en metros y radianes, en el frame declarado, con redondeo fijo y origen de cada valor
- [ ] **I8** La matriz de ensayo en perfil «gemelo» no empeora frente a `tests/fixtures/matriz-base.json`
- [ ] **I9** Nada de este repo se copia al repo de Robótica; la coautoría de IA está declarada

## Puertas

- [ ] Ninguna dependencia nueva, o aprobada con P6 y registrada en el plan
- [ ] Sin cambios de three, Firebase ni roslib de versión (P6) ni de reglas o campos de Firestore (P3)

## Hallazgos, deuda y desviaciones

<!-- Fallos del gemelo encontrados y no arreglados, deuda nueva (DTx) y desviaciones del brief. «Ninguno» si no hay. -->
