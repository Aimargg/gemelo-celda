# Validar en ROS los ficheros que exporta el gemelo (U4)

> Generado por IA (I9), como todo el repo. BORRADOR. Es la tarea **U4** del plan (`docs/planes/PLAN-gemelo-v9.md`, fase 2):
> cargar en la simulación del curso (`sim_<id>`) los ficheros que descarga el panel «Exportar a ROS» y comprobar que la
> mesa, las cajas, los platos, la bandeja y las cámaras salen donde el gemelo dice. **Nada de lo exportado se ha cargado
> todavía en ROS**: todo comando marcado **SIN VALIDAR** puede fallar o llamarse distinto en la imagen del curso, y cada uno
> dice cómo comprobarlo. Última revisión: 2026-11-16 (T2.6).

**Regla I4: el gemelo nunca envía nada a ROS.** El panel solo genera texto y descargas; eres tú quien copia los ficheros al
contenedor y los carga a mano con los comandos de esta guía.

## Cinco palabras antes de empezar

- **Frame** (marco): un sistema de ejes con nombre, como `world` (el mundo de la simulación), `base_link` (la base del robot)
  o `mesa`. Cada posición en ROS se da «en» un frame.
- **TF** (transformada): dónde está un frame respecto a otro (posición en metros y giro). Una TF **estática** no cambia con el
  tiempo: la mesa respecto a la base del robot, por ejemplo. Todas las TF juntas forman un árbol que cuelga de `world`.
- **Nodo**: un programa de ROS en marcha (la simulación, MoveIt, una cámara…). Se lanza con `ros2 run <paquete> <ejecutable>`.
- **Parámetro**: un valor con nombre que un nodo lee al arrancar (`celda.mesa.xyz`, `frame_id`…). Un fichero YAML de
  parámetros se le pasa con `--ros-args --params-file <fichero>`.
- **Servicio**: una pregunta que un nodo responde una vez (petición → respuesta), por ejemplo «carga esta escena». Se llama con
  `ros2 service call <servicio> <tipo> "<petición>"`.

## 0. Qué descargar y dónde ponerlo

1. En el gemelo, abre la escena que quieras comprobar y elige el **robot** de la simulación (Escena → «Robot calibrado»: `203`,
   `204`, `205` o `206`). Con `sim_<id>` hay un solo robot: en Datos, deja **Prefijo de los frames = Ninguno**. El prefijo
   `<id>_` es solo para los URDF dobles (`doble_ur3e_<a>_<b>`).
2. Pulsa **Calcular trayectorias** y espera a que termine. En Datos → «Exportar a ROS», la línea del estado debe decir
   **giro del plan**. Si dice «giro provisional», las cajas de los platos salen con un giro que el plan no usa (DT38).
3. Pulsa **Descargar todo (.tar)**. Baja `celda_ros_<huella>.tar`: los ficheros con sus carpetas. La **huella** (8 cifras
   hexadecimales) sale en el panel y en la cabecera de cada fichero; apúntala, porque casa los ficheros con la disposición.
   «Descargar» de un fichero suelto cambia «/» por «_» en el nombre (`tf/mesa.yaml` baja como `tf_mesa.yaml`): usa el `.tar`.
4. Copia el `.tar` dentro de la carpeta `ros_workspace` del repo del curso en tu ordenador. El contenedor la ve en
   `/home/laboratorio/ros_workspace` (usuario `laboratorio`). No lo pongas en `ros_workspace/src`: no es un paquete.

## 1. Arrancar la simulación y abrir terminales

1. En tu ordenador, desde el repo del curso: `./lab.sh sim <id>` (por ejemplo `./lab.sh sim 203`). Lanza
   `ros2 launch launcher_robots_lab_robotica sim_<id>.launch.py` dentro del contenedor.
2. Abre **otra terminal dentro del contenedor** (la que ofrezca el escritorio del contenedor o `lab.sh`). **SIN VALIDAR** cómo
   se abre en tu instalación; compruébalo con `whoami` (debe decir `laboratorio`) y con `ros2 node list` (debe listar los nodos
   de la simulación, entre ellos `/move_group`). Si `ros2` no existe en esa terminal, ejecuta `source /opt/ros/jazzy/setup.bash`
   (SIN VALIDAR que haga falta).
3. Extrae el paquete:

   ```bash
   cd /home/laboratorio/ros_workspace
   tar -xf celda_ros_<huella>.tar
   cd celda_ros
   ls -R
   ```

   Deben salir `parametros_celda.yaml`, `tf_estaticas.sh`, `escena_colision.yaml`, `celda.scene`, `celda.scene.txt` y las
   carpetas `tf/`, `camera_info/` y `usb_cam/`. Todas las rutas de abajo son relativas a esta carpeta.

## 2. Orden de las pruebas

Haz las pruebas en este orden: cada una se apoya en la anterior. Copia la salida de cada comando (o haz una captura) para
la tabla del final.

### Prueba 1 — TF estáticas

Primero, el supuesto del que parte todo: el giro de `base_link` respecto a `world` (docs/estado/frames.md).

```bash
ros2 run tf2_ros tf2_echo world base_link
```

Esperado: traslación (0, 0, 0) y un giro en z de −135,0° con el 203, −36,6° con el 204 y 0° con el 205 y el 206 (en la línea
`in RPY (degree)`). Pulsa Ctrl+C cuando lo hayas copiado.

Ahora publica las TF de la celda. En una terminal del contenedor, dentro de `celda_ros`:

```bash
bash tf_estaticas.sh
```

Lanza un `static_transform_publisher` por TF y se queda esperando; déjala abierta (Ctrl+C las para todas). **SIN VALIDAR**
en ROS: si alguna línea falla, copia el error.

En otra terminal, compara cada TF con su fichero `tf/<frame>.yaml`:

```bash
ros2 run tf2_ros tf2_echo base_link mesa
```

`tf2_echo A B` dice dónde está `B` en `A`. La `Translation` debe ser la de `translation` en `tf/mesa.yaml` con **±1 mm**
(±0,001 m) y la `Rotation` (cuaternión x, y, z, w), la de `rotation`, con ±0,001. Repite con al menos `bandeja`,
`plato_1_inicio`, `marcador_4` y una cámara (`camara_<k>` y `camara_<k> camara_<k>_optical`). Las cámaras y la bandeja son
**nominales**: las sustituirán la calibración y la pose que publique Visión.

Dibuja el árbol de TF:

```bash
ros2 run tf2_tools view_frames
```

Escribe `frames_<fecha>.pdf` en la carpeta actual. Esperado: `world` → `base_link` → (eslabones del robot) y, colgando de
`base_link`, `mesa`, `zona_fruta`, `plato_1_inicio`, `plato_2_inicio`, `marcador_0` a `marcador_3` (zona de fruta, TD.4), `marcador_4`, `marcador_5`, `bandeja` (con
`zona_primero`, `zona_segundo` y `zona_centro` debajo; `zona_centro` es el destino con un plato, desde T2.7) y `camara_<k>` (con `camara_<k>_optical` debajo). Fíjate también en si los frames
del robot salen como `base_link` o como `<id>_base_link`: es el HUECO de frames (docs/estado/frames.md).

Comprueba además un YAML de TF con el componente que lo lee (las claves `'x'`, `'y'`, `'z'` y `'w'` van entre comillas y
falta confirmar que `rcl` las acepta). Para `tf_estaticas.sh` antes (Ctrl+C) y lanza:

```bash
ros2 component standalone tf2_ros tf2_ros::StaticTransformBroadcasterNode --ros-args --params-file tf/mesa.yaml -r __node:=tf_mesa
```

**SIN VALIDAR** (que `ros2 component standalone` y ese componente estén en la imagen: `ros2 component types | grep Static`).
En otra terminal: `ros2 param get /tf_mesa translation.x` (esperado: el `'x'` del YAML) y `ros2 run tf2_ros tf2_echo base_link mesa`
(esperado: lo mismo que con `tf_estaticas.sh`).

### Prueba 2 — Parámetros (`parametros_celda.yaml`)

Carga el fichero en un nodo que acepte cualquier parámetro y vuelca lo que ha leído:

```bash
ros2 run demo_nodes_cpp parameter_blackboard --ros-args --params-file parametros_celda.yaml
```

En otra terminal:

```bash
ros2 param dump /parameter_blackboard
ros2 param get /parameter_blackboard celda.mesa.xyz
```

Esperado: el nodo arranca sin «Failed to parse parameters», el volcado tiene los nombres de `celda` (robot, pinza, mesa,
platos, zona_fruta, marcadores, bandeja, persona, camaras) y `celda.mesa.xyz` es el `xyz` de `mesa` en el fichero.

**SIN VALIDAR** que `demo_nodes_cpp` esté en la imagen: compruébalo con `ros2 pkg executables demo_nodes_cpp`. Si no está:
- con permisos y red en el contenedor, `sudo apt install ros-jazzy-demo-nodes-cpp` (SIN VALIDAR que haya sudo);
- si no, al menos el formato: arranca cualquier nodo con el fichero, por ejemplo
  `ros2 run tf2_ros static_transform_publisher --frame-id prueba_a --child-frame-id prueba_b --ros-args --params-file parametros_celda.yaml`.
  Si el YAML está mal, el nodo no arranca y dice por qué; si arranca, el formato vale (no enseña los valores: ese nodo no
  los declara). Para con Ctrl+C.

### Prueba 3 — Escena de colisión (`celda.scene`)

`celda.scene` está en el `world` de `sim_<id>` (lo explica `celda.scene.txt`). Cárgala en move_group con el servicio
`load_geometry_from_file` (MoveIt 2.11 o posterior), con la ruta **de dentro del contenedor**:

```bash
ros2 service call /load_geometry_from_file moveit_msgs/srv/LoadGeometryFromFile "{file_path_and_name: /home/laboratorio/ros_workspace/celda_ros/celda.scene}"
```

**SIN VALIDAR** el nombre del servicio: compruébalo con `ros2 service list | grep geometry`. Si no aparece, en RViz:
panel MotionPlanning → pestaña Scene Objects → Import, elige el mismo fichero y pulsa Publish (SIN VALIDAR).

**Ojo: el servicio responde «éxito» (`success: true`) aunque el fichero esté mal.** Lo que cuenta es lo que se ve. Lista los
objetos que tiene move_group:

```bash
ros2 service call /get_planning_scene moveit_msgs/srv/GetPlanningScene "{components: {components: 8}}"
```

El 8 es `WORLD_OBJECT_NAMES` (SIN VALIDAR el valor: `ros2 interface show moveit_msgs/msg/PlanningSceneComponents`). Esperado:
los ids de `celda.scene.txt` («Origen de cada objeto»); con la disposición de partida y dos platos sobre caja, `mesa`,
`caja_plato_1`, `caja_plato_2`, `plato_1`, `plato_2`, `bandeja`, `camara_cenital`, `camara_entrega` y `camara_persona`.

En RViz, con el robot de la simulación a la vista, comprueba y haz una captura:
- la base del robot está sobre la mesa (la cara de arriba de la mesa queda 1 mm por debajo de `base_link`);
- las cajas están bajo los platos, con el giro que dibuja el gemelo;
- la bandeja y las tres cámaras (esferas y cilindros: la cámara y su brazo) están donde en el gemelo.
Una captura del gemelo con la misma vista ayuda a comparar.

`escena_colision.yaml` **no se carga en U4**: necesita un nodo del grupo que lo lea y llame a `apply_planning_scene` (lo dice
su cabecera). Sus números son los mismos que los de `celda.scene`, pasados a `world`: lo comprueba el test
`tests/e2e/ros.test.mjs` (T2.3-C4).

### Prueba 4 — `camera_info` de cada cámara

Abre cada fichero con el analizador de ROS, `camera_calibration_parsers`, convirtiéndolo a otro formato:

```bash
ros2 run camera_calibration_parsers convert camera_info/camara_cenital.yaml /tmp/camara_cenital.ini
```

**SIN VALIDAR** que el ejecutable exista con ese nombre en ROS 2: `ros2 pkg executables camera_calibration_parsers`.
Esperado: sin errores y un `.ini` con el mismo tamaño de imagen y la misma matriz de cámara (fx, cx, fy, cy) que el YAML.
Repite con `camara_entrega` y `camara_persona`. La K es **nominal** (lente ideal): la sustituirá la calibración intrínseca.

### Prueba 5 — `usb_cam` (solo en el PC del laboratorio, con las cámaras conectadas)

En tu ordenador sin cámaras, sáltala. En el PC del laboratorio, dentro del contenedor:

1. Copia los `camera_info` donde `usb_cam` los busca: `${ROS_HOME}/camera_info/`, por defecto `~/.ros/camera_info/` (SIN
   VALIDAR que `camera_info_url` expanda `${ROS_HOME}`):

   ```bash
   mkdir -p ~/.ros/camera_info && cp camera_info/*.yaml ~/.ros/camera_info/
   ```

2. Mira qué dispositivo es cada cámara (`video_device` es un SUPUESTO): `v4l2-ctl --list-devices`, y si no coincide, cambia
   `video_device` en `usb_cam/camara_<k>.yaml` (mejor una ruta `/dev/v4l/by-id/…`).
3. Lanza una cámara:

   ```bash
   ros2 run usb_cam usb_cam_node_exe --ros-args -r __ns:=/camara_cenital --params-file usb_cam/camara_cenital.yaml
   ```

   **SIN VALIDAR**. En otra terminal, busca el nombre del nodo con `ros2 node list` (se espera `/camara_cenital/usb_cam`) y:

   ```bash
   ros2 param get /camara_cenital/usb_cam frame_id
   ros2 topic echo /camara_cenital/camera_info --once
   ```

   Esperado: `frame_id` = `camara_cenital_optical` (el de su TF óptica, no `default_cam`) y, en `camera_info`, ese
   `frame_id` en la cabecera y la `k` del YAML (si sale todo a cero, `usb_cam` no encontró el fichero).

## 3. Qué devolver

Devuelve al plan (U4), con la huella de los ficheros que has probado:
- la salida de cada comando (texto copiado) y las capturas de RViz y del árbol de `view_frames`;
- cada «SIN VALIDAR» que hayas podido resolver (sí funciona / no funciona y qué dice);
- esta tabla rellena.

Los valores esperados salen de los ficheros descargados. Como referencia, con la disposición de partida y el **203 sin
prefijo** (huella `38b05d41`), `tf/mesa.yaml` da traslación (0,497; −0,117; 0,000) m y rotación (0; 0; 0,923842314;
0,382773273), y `tf/bandeja.yaml`, (−0,351; 0,279; 0,240) m y (0; 0; −0,382499496; 0,923955700).

| # | Prueba | Comando | Esperado (dónde se lee) | Medido | ¿Cumple? |
|---|---|---|---|---|---|
| 1a | Giro de `base_link` | `tf2_echo world base_link` | RPY en grados: z = −135,0 (203), −36,6 (204), 0 (205, 206) | | |
| 1b | TF de la mesa | `tf2_echo base_link mesa` | `translation` y `rotation` de `tf/mesa.yaml`, ±1 mm y ±0,001 | | |
| 1c | TF de la bandeja | `tf2_echo base_link bandeja` | `tf/bandeja.yaml`, ±1 mm y ±0,001 | | |
| 1d | TF de un plato | `tf2_echo base_link plato_1_inicio` | `tf/plato_1_inicio.yaml`, ±1 mm | | |
| 1e | TF de un marcador | `tf2_echo base_link marcador_4` | `tf/marcador_4.yaml`, ±1 mm | | |
| 1f | TF de una cámara | `tf2_echo base_link camara_<k>` | `tf/camara_<k>.yaml`, ±1 mm y ±0,001 | | |
| 1g | Marco óptico | `tf2_echo camara_<k> camara_<k>_optical` | `tf/camara_<k>_optical.yaml` | | |
| 1h | Árbol de TF | `view_frames` | una sola raíz `world`; frames de la celda bajo `base_link` (lista de la prueba 1) | | |
| 1i | Nombres del robot | `view_frames` | `base_link` o `<id>_base_link` (HUECO de frames) | | |
| 1j | YAML de TF con el componente | `component standalone … tf/mesa.yaml` y `param get /tf_mesa translation.x` | arranca; el `'x'` del YAML | | |
| 2 | Parámetros | `parameter_blackboard` + `param dump` | arranca sin error; `celda.mesa.xyz` = el del fichero | | |
| 3a | Carga de la escena | `load_geometry_from_file` o RViz Import | responde (ojo: «éxito» no basta) | | |
| 3b | Objetos de la escena | `get_planning_scene` (8) | los ids de `celda.scene.txt` | | |
| 3c | Escena en RViz | captura | base sobre la mesa, cajas bajo los platos, bandeja y cámaras como en el gemelo | | |
| 4 | `camera_info` | `camera_calibration_parsers convert` (×3) | sin errores; misma K | | |
| 5a | `frame_id` de `usb_cam` | `ros2 param get /camara_<k>/usb_cam frame_id` | `camara_<k>_optical` | | |
| 5b | `camera_info` publicado | `ros2 topic echo /camara_<k>/camera_info --once` | `frame_id` y `k` del YAML | | |

Si algo no cuadra, no cambies los ficheros a mano para que cuadre: apunta el valor medido y el error. El gemelo se corrige
en el repo y se vuelve a exportar.
