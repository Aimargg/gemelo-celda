#!/usr/bin/env python3
"""Ficheros de referencia de la cinemática de los UR3e del curso, sin ROS (tarea T1.3 del plan v9).

Expande con `xacro` (PyPI) los .xacro del repo del curso, igual que lo hacen sus launch, y calcula
la FK de `tool0` en `base_link` recorriendo el URDF resultante. Escribe:

  tests/fixtures/cinematica/{nominal,203,204,205,206}.json   verdad de referencia para los tests (T1.4)
  src/datos/calibracion.js                                    parámetros de cada robot como datos JS

Uso (ver tools/fixtures/LEEME.md):
  python3 tools/fixtures/fk_desde_xacro.py                    descarga las fuentes fijadas a una caché
  python3 tools/fixtures/fk_desde_xacro.py --curso DIR --ur-description DIR --ur-driver DIR
  python3 tools/fixtures/fk_desde_xacro.py --comprobar        no escribe; falla si los ficheros no coinciden

Si falta red, un fichero o un módulo, termina con código 2 y un mensaje que dice qué falta, sin escribir nada.
"""
import argparse
import importlib.metadata
import json
import math
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import types
import xml.etree.ElementTree as ET
from pathlib import Path

# --- Fuentes fijadas: cambiar un commit cambia los ficheros de referencia ---------------------------
CURSO = {
    "repo": "ignacioDeusto/ros2_mucsi_26_27",
    "url": "https://github.com/ignacioDeusto/ros2_mucsi_26_27",
    "commit": "4e4e1a74fe5ab81c3e1279120b33e9b235be198f",
}
UR_DESCRIPTION = {
    "repo": "UniversalRobots/Universal_Robots_ROS2_Description",
    "url": "https://github.com/UniversalRobots/Universal_Robots_ROS2_Description",
    "rama": "jazzy",
    "commit": "3852128295499b52f38f82171f5ff3f21ecdfa22",
}
UR_DRIVER = {
    "repo": "UniversalRobots/Universal_Robots_ROS2_Driver",
    "url": "https://github.com/UniversalRobots/Universal_Robots_ROS2_Driver",
    "rama": "jazzy",
    "commit": "4754149af313e29ad4625f4d2d420c6cfbbf87ba",
}
PKG_CURSO = "ros_workspace/src/launcher_robots_lab_robotica"
IDS = ["203", "204", "205", "206"]
DOBLE = {"203": "doble_ur3e_203_204", "204": "doble_ur3e_203_204",
         "205": "doble_ur3e_205_206", "206": "doble_ur3e_205_206"}
# Clave del YAML de calibración -> articulación cuyo <origin> fija (ur_description/urdf/ur_macro.xacro)
CLAVES = [("shoulder", "shoulder_pan_joint"), ("upper_arm", "shoulder_lift_joint"),
          ("forearm", "elbow_joint"), ("wrist_1", "wrist_1_joint"),
          ("wrist_2", "wrist_2_joint"), ("wrist_3", "wrist_3_joint")]
ARTICULACIONES = [a for _, a in CLAVES]  # mismo orden que q en src/kin.js
UMBRAL_SOSPECHOSO_M = 0.05
# Hipótesis que se mide (no se aplica) en los robots sospechosos: q del nominal que reproduce su FK
OFFSET_HIPOTESIS = [0.0, 0.0, math.pi, -math.pi, 0.0, 0.0]

# 20 configuraciones articulares fijas (rad, orden de ARTICULACIONES), las mismas para todos los robots.
# 0: «zeros» del SRDF del curso · 1: initial_positions.yaml de ur_description (pose de arranque de
# sim_<id>) · 2: «home» del SRDF del curso · 3: brazo en L · 4-19: generadas una vez con
# numpy.random.default_rng(20261115) y redondeadas a 1e-4; la 18 y la 19 salen de [-pi, pi].
CONFIGURACIONES = [
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, -1.57, 0.0, -1.57, 0.0, 0.0],
    [0.0, -1.5707, 0.0, -1.5707, 0.0, 0.0],
    [0.0, -1.5708, 1.5708, -1.5708, -1.5708, 0.0],
    [0.0119, -1.1217, 0.5459, -1.2571, 1.2407, -0.6946],
    [-0.5249, 0.3314, 2.9409, -1.1455, 0.6517, 1.7480],
    [1.5703, 0.6938, -1.6132, 0.0891, 1.5286, 1.1801],
    [2.5752, 3.1039, -0.5458, -1.7968, -0.5000, -2.7069],
    [0.3965, 1.1046, -2.4360, -0.7690, -3.0903, 1.1286],
    [2.2971, -0.8019, -2.3215, 2.4014, -0.6884, 1.2828],
    [-1.1225, -0.7394, -0.2480, -0.0888, -0.3368, 0.8117],
    [-1.2803, 1.7249, -2.8692, 0.9141, -1.7848, -1.9195],
    [-1.9736, 2.6264, -1.9969, 0.0059, 1.6465, 2.3958],
    [-0.1327, -0.9181, -1.9367, -1.4711, 1.7030, 0.8220],
    [-0.4786, 2.6948, -1.1373, -1.6418, -1.9939, 2.0856],
    [2.9285, -1.9973, -2.0974, -0.2366, -0.7739, 0.9517],
    [-2.5036, -2.2335, 3.0634, -2.9354, 0.5856, 1.0380],
    [-1.7653, 2.2656, -2.2520, 0.2187, 1.1162, 2.6498],
    [3.3677, -0.1743, -1.8720, -1.1978, 1.5367, -5.2044],
    [-1.4417, 1.7885, 0.2155, -4.4000, 0.0, -2.4240],
]

RAIZ_REPO = Path(__file__).resolve().parents[2]
SALIDAS_JSON = "tests/fixtures/cinematica"
SALIDA_JS = "src/datos/calibracion.js"


class Fallo(Exception):
    """Error esperado: se informa con un mensaje claro y el script termina sin escribir nada."""


# --- Dependencias de Python ---------------------------------------------------------------------------
def importar_dependencias():
    faltan = []
    mods = {}
    for nombre in ("numpy", "yaml", "xacro"):
        try:
            mods[nombre] = __import__(nombre)
        except ImportError:
            faltan.append(nombre)
    if faltan:
        raise Fallo("faltan módulos de Python: " + ", ".join(faltan) +
                    ". Instálalos con: pip install xacro==2.1.1 numpy pyyaml "
                    "(en un venv, o con --break-system-packages)")
    return mods["numpy"], mods["yaml"], mods["xacro"]


# --- Repos fuente: carpeta dada o clon fijado en la caché ------------------------------------------
def git(args, cwd):
    try:
        return subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True)
    except FileNotFoundError:
        raise Fallo("no se encuentra el ejecutable git")


def clonar(fuente, destino, opcion):
    tmp = destino.with_name(destino.name + ".descargando")
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    for paso in (["init", "-q"], ["fetch", "-q", "--depth", "1", fuente["url"], fuente["commit"]],
                 ["checkout", "-q", "--detach", "FETCH_HEAD"]):
        r = git(paso, tmp)
        if r.returncode != 0:
            shutil.rmtree(tmp, ignore_errors=True)
            detalle = (r.stderr.strip().splitlines() or ["sin detalle"])[-1]
            raise Fallo(f"no se pudo descargar {fuente['url']} @ {fuente['commit'][:7]} ({detalle}). "
                        f"¿Hay red? Alternativa: clónalo a mano en ese commit y pásalo con {opcion} DIR")
    tmp.rename(destino)


def preparar_repo(nombre, fuente, carpeta, cache, ficheros, permitir_otros):
    """Devuelve (carpeta, commit). Comprueba que existen `ficheros` y que el commit es el fijado."""
    de_cache = carpeta is None
    if de_cache:
        carpeta = cache / nombre
        if not carpeta.exists():
            print(f"descargando {fuente['repo']} @ {fuente['commit'][:7]} en {carpeta}", file=sys.stderr)
            cache.mkdir(parents=True, exist_ok=True)
            clonar(fuente, carpeta, "--" + nombre.replace("_", "-"))
    carpeta = Path(carpeta).resolve()
    if not carpeta.is_dir():
        raise Fallo(f"no existe la carpeta de {nombre}: {carpeta}")
    faltan = [f for f in ficheros if not (carpeta / f).is_file()]
    if faltan:
        raise Fallo(f"faltan ficheros en {nombre} ({carpeta}):\n  " + "\n  ".join(faltan))
    res = git(["rev-parse", "HEAD"], carpeta)
    if res.returncode != 0:
        raise Fallo(f"{carpeta} no es un clon git: no se puede comprobar el commit de {nombre}")
    commit = res.stdout.strip()
    sucio = git(["status", "--porcelain", "--untracked-files=no"], carpeta).stdout.strip()
    if (commit != fuente["commit"] or sucio) and not permitir_otros:
        motivo = f"está en {commit[:7]}" if commit != fuente["commit"] else "tiene cambios locales"
        raise Fallo(f"{nombre} {motivo}; se espera {fuente['commit'][:7]} sin cambios "
                    "(o usa --permitir-otros-commits y revisa el diff de los JSON)" +
                    (f"; para descargarlo de nuevo, borra {carpeta}" if de_cache else ""))
    return carpeta, commit + ("+cambios" if sucio else "")


def version_paquete(xml_path):
    return ET.parse(xml_path).getroot().findtext("version")


# --- Sustituto mínimo de ament_index_python para $(find pkg) -------------------------------------
def instalar_sustituto_ament(paquetes):
    class PackageNotFoundError(KeyError):
        pass

    def get_package_share_directory(nombre, print_warning=True):
        if nombre not in paquetes:
            raise PackageNotFoundError(f"xacro pide $(find {nombre}), que no está en el mapa de paquetes "
                                       f"({', '.join(sorted(paquetes))})")
        return str(paquetes[nombre])

    raiz = types.ModuleType("ament_index_python")
    sub = types.ModuleType("ament_index_python.packages")
    sub.get_package_share_directory = get_package_share_directory
    sub.PackageNotFoundError = PackageNotFoundError
    raiz.packages = sub
    sys.modules["ament_index_python"] = raiz
    sys.modules["ament_index_python.packages"] = sub


def expandir(xacro, fichero, argumentos):
    try:
        doc = xacro.process_file(str(fichero), mappings=dict(argumentos))
        return ET.fromstring(doc.toxml())
    except Exception as e:  # xacro lanza tipos variados; se informa con el fichero
        raise Fallo(f"xacro no pudo expandir {fichero}: {e}")


# --- URDF y FK -------------------------------------------------------------------------------------
class Urdf:
    def __init__(self, np, raiz):
        self.np = np
        self.links = sorted(l.get("name") for l in raiz.findall("link"))
        self.por_hijo = {}
        self.moviles = []
        for j in raiz.findall("joint"):
            o = j.find("origin")
            xyz = [float(v) for v in (o.get("xyz", "0 0 0") if o is not None else "0 0 0").split()]
            rpy = [float(v) for v in (o.get("rpy", "0 0 0") if o is not None else "0 0 0").split()]
            ax = j.find("axis")
            eje = [float(v) for v in (ax.get("xyz") if ax is not None else "1 0 0").split()]
            info = {"nombre": j.get("name"), "tipo": j.get("type"), "padre": j.find("parent").get("link"),
                    "xyz": xyz, "rpy": rpy, "eje": eje, "T": origen(np, xyz, rpy)}
            self.por_hijo[j.find("child").get("link")] = info
            if info["tipo"] != "fixed":
                self.moviles.append(info["nombre"])
        self.moviles.sort()

    def cadena(self, desde, hasta):
        js = []
        l = hasta
        while l != desde:
            if l not in self.por_hijo:
                raise Fallo(f"el URDF no tiene una cadena de '{desde}' a '{hasta}'")
            js.append(self.por_hijo[l])
            l = js[-1]["padre"]
        return js[::-1]

    def fk(self, desde, hasta, q=None):
        np = self.np
        T = np.eye(4)
        for j in self.cadena(desde, hasta):
            T = T @ j["T"]
            if j["tipo"] in ("revolute", "continuous"):
                if q is None or j["nombre"] not in q:
                    raise Fallo(f"falta el valor de la articulación {j['nombre']}")
                T = T @ giro_eje(np, j["eje"], q[j["nombre"]])
            elif j["tipo"] != "fixed":
                raise Fallo(f"tipo de articulación no previsto en la cadena: {j['tipo']} ({j['nombre']})")
        return T


def origen(np, xyz, rpy):
    """<origin> de URDF: Trans(xyz) · Rz(yaw) · Ry(pitch) · Rx(roll)."""
    r, p, y = rpy
    cr, sr, cp, sp, cy, sy = math.cos(r), math.sin(r), math.cos(p), math.sin(p), math.cos(y), math.sin(y)
    T = np.eye(4)
    T[:3, :3] = [[cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr],
                 [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr],
                 [-sp, cp * sr, cp * cr]]
    T[:3, 3] = xyz
    return T


def giro_eje(np, eje, t):
    """Rodrigues: giro t alrededor del eje unitario."""
    k = np.array(eje, dtype=float)
    k = k / np.linalg.norm(k)
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    T = np.eye(4)
    T[:3, :3] = np.eye(3) + math.sin(t) * K + (1 - math.cos(t)) * (K @ K)
    return T


def angulo_giro(np, Ra, Rb):
    c = (np.trace(Ra.T @ Rb) - 1) / 2
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def plano(T):
    return [r(v) for v in T.reshape(16).tolist()]


def r(x, dec=12):
    """Redondeo fijo: hace el JSON estable entre ejecuciones y elimina -0.0."""
    if not math.isfinite(x):
        raise Fallo(f"valor no finito en el cálculo: {x}")
    v = round(float(x), dec)
    return 0.0 if v == 0 else v


def envolver(t):
    return math.atan2(math.sin(t), math.cos(t))


# --- Datos del curso -------------------------------------------------------------------------------
NS_XACRO = "{http://wiki.ros.org/xacro}"


def leer_mount_yaw(fichero):
    for p in ET.parse(fichero).getroot().iter(NS_XACRO + "property"):
        if p.get("name") == "mount_yaw":
            return float(p.get("value"))
    raise Fallo(f"{fichero} no define la propiedad mount_yaw")


def leer_montaje_doble(fichero, id_robot):
    for m in ET.parse(fichero).getroot().iter(NS_XACRO + "ur3e_rg2_lab"):
        if m.get("id") == id_robot:
            return {"x": float(m.get("x")), "y": float(m.get("y")), "yaw": float(m.get("yaw"))}
    raise Fallo(f"{fichero} no coloca el robot {id_robot}")


def leer_cinematica(yaml, fichero):
    with open(fichero, encoding="utf-8") as f:
        k = yaml.safe_load(f)["kinematics"]
    return {c: {e: float(k[c][e]) for e in ("x", "y", "z", "roll", "pitch", "yaw")} for c, _ in CLAVES}, k["hash"]


# --- Cálculo ---------------------------------------------------------------------------------------
def calcular(np, yaml, xacro, rutas, versiones):
    curso_pkg = rutas["curso"] / PKG_CURSO
    urd = rutas["ur_description"]
    drv = rutas["ur_driver"] / "ur_robot_driver"
    tmp = Path(tempfile.mkdtemp(prefix="fk_desde_xacro_"))
    try:
        instalar_sustituto_ament({
            "launcher_robots_lab_robotica": curso_pkg,
            "ur_description": urd,
            "ur_robot_driver": drv,
            # Solo aparece como ruta de texto (script_filename de ros2_control); no afecta a la cinemática.
            "ur_client_library": tmp / "ur_client_library-sustituto",
        })
        # Argumentos con los que ur_robot_driver/launch/ur_rsp.launch.py llama a xacro desde sim_<id>
        base_args = {
            "name": "ur3e", "ur_type": "ur3e", "tf_prefix": "", "use_mock_hardware": "true",
            "joint_limit_params": str(urd / "config/ur3e/joint_limits.yaml"),
            "physical_params": str(urd / "config/ur3e/physical_parameters.yaml"),
            "visual_params": str(urd / "config/ur3e/visual_parameters.yaml"),
            "script_filename": str(tmp / "ur_client_library-sustituto/resources/external_control.urscript"),
            "input_recipe_filename": str(drv / "resources/rtde_input_recipe.txt"),
            "output_recipe_filename": str(drv / "resources/rtde_output_recipe.txt"),
        }
        args_doc = {k: v for k, v in base_args.items() if k in ("name", "ur_type", "tf_prefix", "use_mock_hardware")}
        args_doc.update({"joint_limit_params": "ur_description/config/ur3e/joint_limits.yaml",
                         "physical_params": "ur_description/config/ur3e/physical_parameters.yaml",
                         "visual_params": "ur_description/config/ur3e/visual_parameters.yaml"})

        # Nominal: el xacro común del curso con la cinemática por defecto y mount_yaw = pi (world ≡ base_link)
        envoltorio = tmp / "ur3e_rg2_nominal.urdf.xacro"
        envoltorio.write_text(
            '<?xml version="1.0"?>\n<robot xmlns:xacro="http://wiki.ros.org/xacro" name="$(arg name)">\n'
            '  <xacro:property name="mount_yaw" value="${pi}"/>\n'
            '  <xacro:include filename="$(find launcher_robots_lab_robotica)/urdf/ur3e_rg2_comun.urdf.xacro"/>\n'
            '</robot>\n', encoding="utf-8")
        robots = {"nominal": {
            "xacro": "envoltorio temporal: <xacro:property name=\"mount_yaw\" value=\"${pi}\"/> + "
                     f"include de {PKG_CURSO}/urdf/ur3e_rg2_comun.urdf.xacro",
            "urdf": expandir(xacro, envoltorio, base_args),
            "args": dict(args_doc, kinematics_params="(por defecto) ur_description/config/ur3e/default_kinematics.yaml"),
            "calib": urd / "config/ur3e/default_kinematics.yaml", "mount_yaw": math.pi, "doble": None,
        }}
        urdf_ur = Urdf(np, expandir(xacro, urd / "urdf/ur.urdf.xacro", {"name": "ur3e", "ur_type": "ur3e"}))
        dobles = {}
        for id_robot in IDS:
            fich = curso_pkg / f"urdf/ur3e_rg2_{id_robot}.urdf.xacro"
            calib = curso_pkg / f"calibration/calibration_{id_robot}.yaml"
            nd = DOBLE[id_robot]
            if nd not in dobles:
                dobles[nd] = Urdf(np, expandir(xacro, curso_pkg / f"urdf/{nd}.urdf.xacro", {"use_mock_hardware": "true"}))
            robots[id_robot] = {
                "xacro": f"{PKG_CURSO}/urdf/ur3e_rg2_{id_robot}.urdf.xacro",
                "urdf": expandir(xacro, fich, dict(base_args, kinematics_params=str(calib))),
                "args": dict(args_doc, kinematics_params=f"{PKG_CURSO}/calibration/calibration_{id_robot}.yaml"),
                "calib": calib, "mount_yaw": leer_mount_yaw(fich),
                "doble": (nd, dobles[nd], leer_montaje_doble(curso_pkg / f"urdf/{nd}.urdf.xacro", id_robot)),
            }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    qs = [dict(zip(ARTICULACIONES, q)) for q in CONFIGURACIONES]
    salida, datos_js = {}, {}
    nominal_T = None
    for nombre, rb in robots.items():
        u = Urdf(np, rb["urdf"])
        T_tool0 = [u.fk("base_link", "tool0", q) for q in qs]
        cin, hash_calib = leer_cinematica(yaml, rb["calib"])
        if nombre == "nominal":
            nominal_T, nominal_cin, u_nominal = T_tool0, cin, u
        T_wb = u.fk("world", "base_link")
        bj = u.por_hijo["base_link"]
        T_wi = u.fk("world", "base_link_inertia")
        yaw_inercia = math.atan2(T_wi[1, 0], T_wi[0, 0])
        comp = {"world_base_link_inertia_yaw_menos_mount_yaw_rad": r(envolver(yaw_inercia - rb["mount_yaw"]))}
        if abs(comp["world_base_link_inertia_yaw_menos_mount_yaw_rad"]) > 1e-9:
            raise Fallo(f"{nombre}: el giro de base_link_inertia en world no coincide con mount_yaw")
        frames = {"individual": {"prefijo": "", "links": u.links,
                                 "articulaciones_brazo": [j["nombre"] for j in u.cadena("base_link", "tool0") if j["tipo"] != "fixed"],
                                 "articulaciones_moviles": u.moviles},
                  "doble": None}
        wb = {"individual": {"xyz": [r(v) for v in bj["xyz"]], "rpy": [r(v) for v in bj["rpy"]], "T": plano(T_wb)},
              "doble": None}
        if rb["doble"]:
            nd, ud, mont = rb["doble"]
            p = f"{nombre}_"
            qd = [{p + k: v for k, v in q.items()} for q in qs]
            Td = [ud.fk(p + "base_link", p + "tool0", q) for q in qd]
            comp["tool0_individual_frente_a_doble_max_m"] = r(max(float(np.abs(a - b).max()) for a, b in zip(T_tool0, Td)))
            bjd = ud.por_hijo[p + "base_link"]
            wb["doble"] = {"fichero": f"{PKG_CURSO}/urdf/{nd}.urdf.xacro", "frame": p + "base_link",
                           "xyz": [r(v) for v in bjd["xyz"]], "rpy": [r(v) for v in bjd["rpy"]],
                           "T": plano(ud.fk("world", p + "base_link"))}
            frames["doble"] = {"fichero": f"{PKG_CURSO}/urdf/{nd}.urdf.xacro", "prefijo": p,
                               "links": ["world"] + [l for l in ud.links if l.startswith(p)],
                               "articulaciones_brazo": [j["nombre"] for j in ud.cadena(p + "base_link", p + "tool0") if j["tipo"] != "fixed"],
                               "articulaciones_moviles": [j for j in ud.moviles if j.startswith(p)]}
        else:
            Tu = [urdf_ur.fk("base_link", "tool0", q) for q in qs]
            comp["tool0_frente_a_ur_description_ur_urdf_xacro_max_m"] = r(max(float(np.abs(a - b).max()) for a, b in zip(T_tool0, Tu)))
            if comp["tool0_frente_a_ur_description_ur_urdf_xacro_max_m"] > 1e-12:
                raise Fallo("el nominal del xacro del curso no coincide con ur_description/urdf/ur.urdf.xacro")
        T_rg2 = u.fk("tool0", "onrobot_rg2_base_link")

        # Comparación con el nominal (posición y giro de tool0 y origen de cada articulación)
        desp = [float(np.linalg.norm(a[:3, 3] - b[:3, 3])) for a, b in zip(T_tool0, nominal_T)]
        giro = [angulo_giro(np, a[:3, :3], b[:3, :3]) for a, b in zip(T_tool0, nominal_T)]
        origenes = {}
        for c, _ in CLAVES:
            Ta = origen(np, [cin[c][e] for e in "xyz"], [cin[c][e] for e in ("roll", "pitch", "yaw")])
            Tb = origen(np, [nominal_cin[c][e] for e in "xyz"], [nominal_cin[c][e] for e in ("roll", "pitch", "yaw")])
            origenes[c] = {"dif_posicion_mm": r(1000 * float(np.linalg.norm(Ta[:3, 3] - Tb[:3, 3])), 6),
                           "dif_giro_grados": r(angulo_giro(np, Ta[:3, :3], Tb[:3, :3]), 6)}
        frente = {"desplazamiento_tool0_mm": [r(1000 * d, 6) for d in desp],
                  "desplazamiento_tool0_max_mm": r(1000 * max(desp), 6),
                  "desplazamiento_tool0_medio_mm": r(1000 * sum(desp) / len(desp), 6),
                  "giro_tool0_max_grados": r(max(giro), 6),
                  "origenes_articulaciones": origenes}
        sospechoso = max(desp) > UMBRAL_SOSPECHOSO_M
        doc = {
            "formato": "gemelo-celda/cinematica-referencia v1",
            "robot": nombre,
            "generado_por": "tools/fixtures/fk_desde_xacro.py (no editar a mano; ver tools/fixtures/LEEME.md)",
            "versiones": versiones,
            "fuentes": {"xacro_individual": rb["xacro"], "argumentos_xacro": rb["args"],
                        "calibracion": (f"{PKG_CURSO}/calibration/calibration_{nombre}.yaml" if nombre != "nominal"
                                        else "ur_description/config/ur3e/default_kinematics.yaml"),
                        "hash_calibracion": hash_calib},
            "convenciones": "metros y radianes; T = matriz 4x4 por filas en 16 valores (como src/kin.js); "
                            "rpy de URDF: R = Rz(yaw)·Ry(pitch)·Rx(roll); valores redondeados a 1e-12",
            "mount_yaw": r(rb["mount_yaw"]),
            "world_base_link": wb,
            "articulaciones": ARTICULACIONES,
            "configuraciones": CONFIGURACIONES,
            "tool0_en_base_link": [plano(T) for T in T_tool0],
            "T_tool0_onrobot_rg2_base_link": plano(T_rg2),
            "frames": frames,
            "frente_al_nominal": frente,
            "comprobaciones": comp,
            "sospechoso": sospechoso,
        }
        if nombre == "nominal":
            doc["relacion_con_gemelo"] = {
                "funcion": "KIN.fk(q) de src/kin.js devuelve tool0 en base_link, el mismo marco que tool0_en_base_link",
                "T_base_link_marco_gemelo": plano(np.eye(4)),
                "T_tool0_marco_gemelo": plano(np.eye(4)),
                "dh": "KIN.fk(q) = KIN.PRE · KIN.fkDH(q), con PRE = Rz(pi) y POST = identidad (base_link frente al marco DH)",
                "tcp_gemelo": "el gemelo pone su TCP en tool0 · Trans(0, 0, pinza.tcpZ(w)) (colision.js, tcpDeQ); "
                              "el URDF del curso no define un frame TCP: la RG2 cuelga de tool0 con T_tool0_onrobot_rg2_base_link",
                "comprobacion": "node tools/fixtures/comprobar_kin.js (error máximo < 1e-6 en las 20 configuraciones)",
            }
        if sospechoso:
            girados = [f"{c} ({ARTICULACIONES[i]}, {origenes[c]['dif_giro_grados']:.1f}°)"
                       for i, (c, _) in enumerate(CLAVES) if origenes[c]["dif_giro_grados"] > 90]
            # Hipótesis: el YAML equivale al nominal con el cero de elbow y wrist_1 girado media vuelta
            T_h = [u_nominal.fk("base_link", "tool0", dict(zip(ARTICULACIONES, [a + b for a, b in zip(q, OFFSET_HIPOTESIS)])))
                   for q in CONFIGURACIONES]
            hip = {"descripcion": f"FK_{nombre}(q) frente a FK_nominal(q + offset_q)",
                   "offset_q": [r(v) for v in OFFSET_HIPOTESIS],
                   "residuo_posicion_max_mm": r(1000 * max(float(np.linalg.norm(a[:3, 3] - b[:3, 3])) for a, b in zip(T_tool0, T_h)), 6),
                   "residuo_giro_max_grados": r(max(angulo_giro(np, a[:3, :3], b[:3, :3]) for a, b in zip(T_tool0, T_h)), 6)}
            doc["hipotesis"] = hip
            mm = lambda T: ", ".join(f"{1000 * v:.1f}" for v in (T[0, 3], T[1, 3], T[2, 3]))
            doc["motivo"] = (
                f"tool0 queda a {frente['desplazamiento_tool0_medio_mm']:.1f} mm de media (máx. "
                f"{frente['desplazamiento_tool0_max_mm']:.1f} mm) del nominal; el umbral es {UMBRAL_SOSPECHOSO_M * 1000:.0f} mm. "
                "Orígenes girados >90° respecto al nominal: " + (", ".join(girados) or "ninguno") + ". "
                f"La FK equivale a la nominal con elbow_joint + pi y wrist_1_joint - pi (residuo máx. "
                f"{hip['residuo_posicion_max_mm']:.1f} mm y {hip['residuo_giro_max_grados']:.2f}°, campo hipotesis): "
                "el antebrazo queda girado media vuelta y la muñeca pasa al otro lado del codo. "
                "Se reproduce tal cual sale del xacro del curso, sin corregir. SIN VALIDAR en ROS.")
            doc["validacion_ros"] = [
                f"1. En el contenedor del curso: ros2 launch launcher_robots_lab_robotica sim_{nombre}.launch.py "
                "(el hardware simulado arranca en configuraciones[1], la de initial_positions.yaml).",
                f"2. Sin mover el robot: ros2 run tf2_ros tf2_echo base_link tool0. Este fichero predice ({mm(T_tool0[1])}) mm; "
                f"el nominal, ({mm(nominal_T[1])}) mm. En RViz, el antebrazo sale plegado hacia abajo en vez de seguir recto hacia arriba.",
                f"3. Si tf2_echo da lo que predice este fichero, ROS ve el mismo desplazamiento: el gemelo reproduce ROS y la "
                f"anomalía está en calibration_{nombre}.yaml.",
                f"4. Para saber si el YAML describe el robot real: con robot_{nombre}.launch.py y el robot real en cualquier pose, "
                "comparar ros2 run tf2_ros tf2_echo base tool0 con la pose de la herramienta que da el pendant en Base, con un TCP "
                f"de offset cero. Una diferencia de ≈{frente['desplazamiento_tool0_medio_mm']:.0f} mm confirma que el YAML no "
                f"corresponde al robot: preguntar al profesor antes de usar el {nombre}.",
            ]
        salida[nombre] = doc
        datos_js[nombre] = {"mount_yaw": rb["mount_yaw"], "doble": rb["doble"][2] if rb["doble"] else None,
                            "doble_fichero": f"urdf/{rb['doble'][0]}.urdf.xacro" if rb["doble"] else None,
                            "kinematics": cin, "hash": hash_calib, "sospechoso": sospechoso}
    return salida, datos_js


# --- Serialización determinista ---------------------------------------------------------------------
def a_json(obj, n=0):
    esp = "  "
    if isinstance(obj, dict):
        if not obj:
            return "{}"
        filas = [f"{esp * (n + 1)}{json.dumps(k, ensure_ascii=False)}: {a_json(v, n + 1)}" for k, v in obj.items()]
        return "{\n" + ",\n".join(filas) + "\n" + esp * n + "}"
    if isinstance(obj, list):
        if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in obj):
            return "[" + ", ".join(a_json(v) for v in obj) + "]"
        return "[\n" + ",\n".join(esp * (n + 1) + a_json(v, n + 1) for v in obj) + "\n" + esp * n + "]"
    if isinstance(obj, float):
        return repr(r(obj))
    return json.dumps(obj, ensure_ascii=False)


def num_js(x):
    return repr(float(x)) if x != 0 else "0"


def a_js(datos, versiones):
    c = versiones["curso"]
    u = versiones["ur_description"]
    lineas = [
        "// GENERADO por tools/fixtures/fk_desde_xacro.py: no editar a mano (ver tools/fixtures/LEEME.md).",
        "// Calibración cinemática de los UR3e del laboratorio y su montaje respecto a «world».",
        "// Atribución (copiado con la decisión Q4 = A del plan v9; el repo del curso no declara licencia):",
        f"//   repo {c['repo']}, commit {c['commit'][:7]} ({c['commit']}),",
        f"//   {PKG_CURSO}/calibration/calibration_<id>.yaml  -> kinematics, hash",
        f"//   {PKG_CURSO}/urdf/ur3e_rg2_<id>.urdf.xacro      -> mount_yaw",
        f"//   {PKG_CURSO}/urdf/doble_ur3e_<a>_<b>.urdf.xacro -> doble (x, y, yaw del robot en la escena de dos)",
        f"// «nominal»: config/ur3e/default_kinematics.yaml de {u['repo']} (rama {u['rama']}, commit {u['commit'][:7]},",
        "//   licencia BSD-3-Clause, Universal Robots A/S).",
        "// Cada entrada de kinematics es el <origin> (xyz en m, rpy en rad; R = Rz(yaw)·Ry(pitch)·Rx(roll)) de la",
        "// articulación de articulacionDe[clave]. world -> base_link = Rz(mount_yaw - pi) (+ x, y en la escena doble).",
        "// sospechoso: tool0 se aleja más de 50 mm del nominal (ver tests/fixtures/cinematica/<id>.json).",
        "const CALIBRACION = {",
        "  fuente: { repo: " + json.dumps(c["repo"]) + ", commit: " + json.dumps(c["commit"]) + " },",
        "  articulacionDe: { " + ", ".join(f"{k}: {json.dumps(a)}" for k, a in CLAVES) + " },",
        "  robots: {",
    ]
    for nombre, d in datos.items():
        lineas.append(f"    {json.dumps(nombre)}: {{")
        lineas.append(f"      mount_yaw: {num_js(d['mount_yaw'])},")
        if d["doble"]:
            m = d["doble"]
            lineas.append(f"      doble: {{ fichero: {json.dumps(d['doble_fichero'])}, x: {num_js(m['x'])}, "
                          f"y: {num_js(m['y'])}, yaw: {num_js(m['yaw'])} }},")
        else:
            lineas.append("      doble: null,")
        lineas.append("      kinematics: {")
        for k, _ in CLAVES:
            v = d["kinematics"][k]
            lineas.append(f"        {k}: {{ " + ", ".join(f"{e}: {num_js(v[e])}" for e in
                                                        ("x", "y", "z", "roll", "pitch", "yaw")) + " },")
        lineas.append("      },")
        lineas.append(f"      hash: {json.dumps(d['hash'])},")
        lineas.append(f"      sospechoso: {'true' if d['sospechoso'] else 'false'},")
        lineas.append("    },")
    lineas += ["  },", "};", "if (typeof module !== 'undefined') module.exports = CALIBRACION;", ""]
    return "\n".join(lineas)


# --- Escritura sin ficheros a medias -----------------------------------------------------------------
def escribir_todo(raiz, contenidos):
    temporales = []
    try:
        for rel, texto in contenidos.items():
            destino = raiz / rel
            destino.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(prefix="." + destino.name + ".", dir=destino.parent)
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
                f.write(texto)
            temporales.append((tmp, destino))
    except OSError as e:
        for tmp, _ in temporales:
            os.unlink(tmp)
        raise Fallo(f"no se pudo escribir la salida: {e}")
    for tmp, destino in temporales:
        os.replace(tmp, destino)


def main():
    ap = argparse.ArgumentParser(description="Ficheros de referencia de cinemática desde el xacro del curso (T1.3).")
    ap.add_argument("--curso", type=Path, help=f"clon de {CURSO['repo']} en {CURSO['commit'][:7]}")
    ap.add_argument("--ur-description", type=Path, help=f"clon de {UR_DESCRIPTION['repo']} en {UR_DESCRIPTION['commit'][:7]}")
    ap.add_argument("--ur-driver", type=Path, help=f"clon de {UR_DRIVER['repo']} en {UR_DRIVER['commit'][:7]}")
    ap.add_argument("--cache", type=Path, default=Path.home() / ".cache/gemelo-celda/fixtures",
                    help="dónde se descargan las fuentes que no se pasan (por defecto %(default)s)")
    ap.add_argument("--salida", type=Path, default=RAIZ_REPO, help="raíz del repo donde se escribe (por defecto, este repo)")
    ap.add_argument("--comprobar", action="store_true", help="no escribe: falla si los ficheros actuales no coinciden")
    ap.add_argument("--permitir-otros-commits", action="store_true",
                    help="acepta fuentes en otro commit o con cambios (queda anotado en versiones)")
    a = ap.parse_args()
    try:
        np, yaml, xacro = importar_dependencias()
        cache = a.cache.expanduser().resolve()
        ficheros_curso = [f"{PKG_CURSO}/calibration/calibration_{i}.yaml" for i in IDS] + \
                         [f"{PKG_CURSO}/urdf/ur3e_rg2_{i}.urdf.xacro" for i in IDS] + \
                         [f"{PKG_CURSO}/urdf/{n}.urdf.xacro" for n in sorted(set(DOBLE.values()))] + \
                         [f"{PKG_CURSO}/urdf/{n}" for n in ("ur3e_rg2_comun.urdf.xacro", "ur3e_rg2_lab.macro.xacro", "rg2.urdf.xacro")]
        ficheros_urd = ["package.xml", "urdf/ur_macro.xacro", "urdf/ur.urdf.xacro", "config/ur3e/default_kinematics.yaml",
                        "config/ur3e/joint_limits.yaml", "config/ur3e/physical_parameters.yaml",
                        "config/ur3e/visual_parameters.yaml", "config/initial_positions.yaml"]
        ficheros_drv = ["ur_robot_driver/package.xml", "ur_robot_driver/urdf/ur.ros2_control.xacro"]
        rutas, commits = {}, {}
        for nombre, fuente, carpeta, fich in (("curso", CURSO, a.curso, ficheros_curso),
                                               ("ur_description", UR_DESCRIPTION, a.ur_description, ficheros_urd),
                                               ("ur_driver", UR_DRIVER, a.ur_driver, ficheros_drv)):
            rutas[nombre], commits[nombre] = preparar_repo(nombre, fuente, carpeta, cache, fich, a.permitir_otros_commits)
        versiones = {
            "python": platform.python_version(), "numpy": np.__version__, "pyyaml": yaml.__version__,
            "xacro": importlib.metadata.version("xacro"),
            "curso": {"repo": CURSO["repo"], "commit": commits["curso"]},
            "ur_description": {"repo": UR_DESCRIPTION["repo"], "rama": UR_DESCRIPTION["rama"], "commit": commits["ur_description"],
                               "version": version_paquete(rutas["ur_description"] / "package.xml")},
            "ur_robot_driver": {"repo": UR_DRIVER["repo"], "rama": UR_DRIVER["rama"], "commit": commits["ur_driver"],
                                "version": version_paquete(rutas["ur_driver"] / "ur_robot_driver/package.xml")},
            "ur_client_library": "sustituto: xacro solo usa su ruta como texto (script_filename); no afecta a la cinemática",
            "ament_index_python": "sustituto mínimo del script (mapa de paquetes a carpetas)",
        }
        docs, datos_js = calcular(np, yaml, xacro, rutas, versiones)
        contenidos = {f"{SALIDAS_JSON}/{n}.json": a_json(d) + "\n" for n, d in docs.items()}
        contenidos[SALIDA_JS] = a_js(datos_js, versiones)
        raiz = a.salida.resolve()
        if a.comprobar:
            distintos = [rel for rel, t in contenidos.items()
                         if not (raiz / rel).is_file() or (raiz / rel).read_text(encoding="utf-8") != t]
            if distintos:
                raise Fallo("no coinciden con lo generado: " + ", ".join(distintos))
            print("los ficheros de referencia coinciden con lo generado")
        else:
            escribir_todo(raiz, contenidos)
            for rel in contenidos:
                print(f"escrito {rel}")
        for n, d in docs.items():
            f = d["frente_al_nominal"]
            print(f"{n:8s} tool0 frente al nominal: máx {f['desplazamiento_tool0_max_mm']:.3f} mm, "
                  f"medio {f['desplazamiento_tool0_medio_mm']:.3f} mm, sospechoso={d['sospechoso']}")
    except Fallo as e:
        print(f"ERROR: {e}\nNo se ha escrito ningún fichero.", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
