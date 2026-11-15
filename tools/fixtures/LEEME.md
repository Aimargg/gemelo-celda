# Ficheros de referencia de cinemática (T1.3)

`fk_desde_xacro.py` expande con `xacro` los .xacro del repo del curso, igual que sus launch, y calcula sin ROS la FK de `tool0` en `base_link`. Genera:

- `tests/fixtures/cinematica/{nominal,203,204,205,206}.json`: la verdad de referencia para los tests de T1.4;
- `src/datos/calibracion.js`: los parámetros de cada robot como datos JS, con su atribución. No entra en el build hasta T1.4.

No se editan a mano: se regeneran.

## Regenerar

Requisitos: Python 3, git y red (o clones locales). Probado con Python 3.13.17, xacro 2.1.1 (PyPI), numpy 2.5.4 y PyYAML 6.0.3; las versiones usadas quedan en `versiones` de cada JSON.

```bash
python3 -m venv /tmp/venv-fixtures
/tmp/venv-fixtures/bin/pip install xacro==2.1.1 numpy pyyaml
/tmp/venv-fixtures/bin/python -I tools/fixtures/fk_desde_xacro.py              # escribe los 6 ficheros
/tmp/venv-fixtures/bin/python -I tools/fixtures/fk_desde_xacro.py --comprobar  # no escribe; código 2 si difieren
node tools/fixtures/comprobar_kin.js   # nominal.json frente a KIN.fk de src/kin.js (< 1e-6)
```

Sin argumentos, descarga las fuentes fijadas en `~/.cache/gemelo-celda/fixtures` (cambia la carpeta con `--cache`). Si ya tienes clones, pásalos con `--curso DIR`, `--ur-description DIR` y `--ur-driver DIR`. Cada clon tiene que estar en su commit y sin cambios; si no, el script se para. Con `--permitir-otros-commits` lo acepta y anota el commit real en `versiones`.

Si falta red, un fichero o un módulo, el script termina con código 2, dice qué falta y no escribe nada. Primero calcula todo en memoria y después sustituye los ficheros (`os.replace`).

## Fuentes fijadas

| Fuente | Commit | Para qué |
|---|---|---|
| `ignacioDeusto/ros2_mucsi_26_27` | `4e4e1a7` | `calibration_<id>.yaml`, `ur3e_rg2_<id>.urdf.xacro`, `doble_ur3e_*.urdf.xacro`, RG2 |
| `UniversalRobots/Universal_Robots_ROS2_Description` (jazzy, 3.6.1) | `3852128` | `ur_macro.xacro`, `default_kinematics.yaml` (nominal) |
| `UniversalRobots/Universal_Robots_ROS2_Driver` (jazzy, 3.11.0) | `4754149` | `ur.ros2_control.xacro`, que incluye el xacro del curso |

Para cambiar una fuente: edita su constante en el script, regenera y revisa el diff de los JSON en el pull request.

## Qué hace

- **Un solo robot:** expande `ur3e_rg2_<id>.urdf.xacro` con los argumentos de `ur_robot_driver/launch/ur_rsp.launch.py` cuando lo llama `sim_<id>.launch.py`: `name:=ur3e`, `ur_type:=ur3e`, `tf_prefix:=""`, `kinematics_params:=calibration_<id>.yaml` y los YAML de ur3e de ur_description. Los frames salen sin prefijo.
- **Doble:** expande `doble_ur3e_203_204` o `doble_ur3e_205_206` (`use_mock_hardware:=true`), con prefijo `<id>_`. Comprueba que `tool0` en `base_link` coincide con el del robot solo.
- **Nominal:** el curso no tiene xacro nominal. Se usa un envoltorio temporal con `mount_yaw = pi` (así `world` ≡ `base_link`) que incluye `ur3e_rg2_comun.urdf.xacro` con `default_kinematics.yaml`. Se comprueba que da lo mismo que `ur_description/urdf/ur.urdf.xacro`.
- **Sustitutos:** `ament_index_python` es un módulo mínimo que traduce `$(find pkg)` a carpetas. `ur_client_library` solo aparece como ruta de texto (`script_filename` de ros2_control): no se descarga y no afecta a la cinemática.
- **FK:** recorre el URDF expandido: `<origin>` (Trans · Rz(yaw) · Ry(pitch) · Rx(roll)) y después el giro en su `axis`.

## Formato de cada JSON

`mount_yaw` · `world_base_link` (individual y doble: `xyz`, `rpy` y `T`) · `configuraciones` (20 q fijas, las mismas en todos) · `tool0_en_base_link` (una `T` 4x4 por filas en 16 valores por configuración, como `src/kin.js`) · `T_tool0_onrobot_rg2_base_link` · `frames` (links y articulaciones del URDF de un solo robot y del doble) · `frente_al_nominal` (desplazamiento de `tool0` y diferencia de cada origen de articulación) · `comprobaciones` · `sospechoso`, y, si lo es, `motivo` y `validacion_ros`. `nominal.json` añade `relacion_con_gemelo`.

Los valores se redondean a 1e-12 y no hay marcas de tiempo: dos ejecuciones con las mismas versiones dan los mismos bytes.

`sospechoso` es `true` cuando `tool0` se aleja más de 50 mm del nominal. Solo le pasa al 204 (≈427 mm): en su YAML, los orígenes de `elbow_joint` y `wrist_1_joint` están girados 180° respecto al nominal. Su FK equivale a la nominal con `elbow_joint` + π y `wrist_1_joint` − π (residuo de 1,4 mm, campo `hipotesis`). Se reproduce tal cual, sin corregirlo. La prueba en ROS está en `204.json` → `validacion_ros`.

## Pendiente de validar

- El contenedor del curso instala ur_description y ur_robot_driver por apt, y su versión exacta puede ser otra. La cinemática solo depende de `ur_macro.xacro` y de los YAML. Se comprueba con `tf2_echo base_link tool0` en `sim_<id>` frente a `tool0_en_base_link[1]`.
