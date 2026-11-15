# Nombres de los frames del robot en ROS (prefijo) — SIN VALIDAR en ROS

> Generado por IA (I9). Fuente: la expansión del xacro del curso que hace `tools/fixtures/fk_desde_xacro.py` (T1.3), campo `frames` de `tests/fixtures/cinematica/<id>.json`. Repo del curso `ignacioDeusto/ros2_mucsi_26_27`, commit `4e4e1a7`. Última revisión: 2026-11-15 (T1.5).

## Qué dice el xacro

| Cómo se lanza | URDF | Frames del brazo | `world` → `base_link` |
|---|---|---|---|
| Un robot: `sim_<id>` (y `robot_<id>`) | `ur3e_rg2_<id>.urdf.xacro`, con `tf_prefix:=""` | **sin prefijo**: `world`, `base_link`, `base`, `tool0`, `flange`, `shoulder_link`… y la RG2 (`onrobot_rg2_base_link`, dedos) | origen común; giro `mount_yaw − π` |
| Dos robots en una escena | `doble_ur3e_203_204.urdf.xacro`, `doble_ur3e_205_206.urdf.xacro` | **con prefijo `<id>_`**: `203_base_link`, `203_tool0`, `204_shoulder_pan_joint`… `world` es común y no lleva prefijo | cada robot en su `x, y` de la escena doble |

Giro de `base_link` respecto a `world` (el gemelo lo aplica al exportar, T1.5):

| Robot | `mount_yaw` (rad) | `world` → `base_link` | URDF doble | Posición en el doble |
|---|---|---|---|---|
| nominal | π | 0° (el curso no tiene xacro nominal) | — | — |
| 203 | 0,785398163 | −135,0° | `doble_ur3e_203_204` | (0, 0) |
| 204 | 2,502802148 | −36,6° | `doble_ur3e_203_204` | (0,0051, −0,9) m |
| 205 | π | 0° | `doble_ur3e_205_206` | (0, 0) |
| 206 | π | 0° | `doble_ur3e_205_206` | (0, −1,102) m |

En el gemelo, el campo **Prefijo de los frames** (pestaña Datos) vale `''` para `sim_<id>` y `<id>_` si se usa el URDF doble. Solo cambia los nombres que escribe `posiciones.yaml`: las coordenadas son las mismas, en el `base_link` de ese robot.

## Qué queda sin validar

- Que el contenedor del curso dé los mismos nombres: el xacro se ha expandido fuera de ROS, con `ur_description` 3.6.1 y `ur_robot_driver` 3.11.0 (rama jazzy). El contenedor los instala por apt y la versión puede ser otra.
- Que los launch del curso pasen `tf_prefix:=""` como se ha supuesto (lo que hace `ur_rsp.launch.py` cuando lo llama `sim_<id>.launch.py`).
- Que `world` tenga los ejes de la mesa. Es un SUPUESTO del gemelo hasta medirlo en el laboratorio.

## Cómo se comprueba

En el contenedor del curso, con la simulación del robot en marcha:

```bash
ros2 launch launcher_robots_lab_robotica sim_<id>.launch.py
ros2 run tf2_tools view_frames                 # escribe frames_<fecha>.pdf con el árbol de TF: ¿base_link o <id>_base_link?
ros2 run tf2_ros tf2_echo world base_link      # el giro en z debe ser el de la tabla de arriba
```

Si los nombres o el giro no coinciden, apúntalo en el plan (`docs/planes/PLAN-gemelo-v9.md`, U4) antes de cargar en ROS los ficheros exportados.
