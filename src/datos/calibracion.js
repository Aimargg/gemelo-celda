// GENERADO por tools/fixtures/fk_desde_xacro.py: no editar a mano (ver tools/fixtures/LEEME.md).
// Calibración cinemática de los UR3e del laboratorio y su montaje respecto a «world».
// Atribución (copiado con la decisión Q4 = A del plan v9; el repo del curso no declara licencia):
//   repo ignacioDeusto/ros2_mucsi_26_27, commit 4e4e1a7 (4e4e1a74fe5ab81c3e1279120b33e9b235be198f),
//   ros_workspace/src/launcher_robots_lab_robotica/calibration/calibration_<id>.yaml  -> kinematics, hash
//   ros_workspace/src/launcher_robots_lab_robotica/urdf/ur3e_rg2_<id>.urdf.xacro      -> mount_yaw
//   ros_workspace/src/launcher_robots_lab_robotica/urdf/doble_ur3e_<a>_<b>.urdf.xacro -> doble (x, y, yaw del robot en la escena de dos)
// «nominal»: config/ur3e/default_kinematics.yaml de UniversalRobots/Universal_Robots_ROS2_Description (rama jazzy, commit 3852128,
//   licencia BSD-3-Clause, Universal Robots A/S).
// Cada entrada de kinematics es el <origin> (xyz en m, rpy en rad; R = Rz(yaw)·Ry(pitch)·Rx(roll)) de la
// articulación de articulacionDe[clave]. world -> base_link = Rz(mount_yaw - pi) (+ x, y en la escena doble).
// sospechoso: tool0 se aleja más de 50 mm del nominal (ver tests/fixtures/cinematica/<id>.json).
// Aún no entra en el build: se carga en T1.4.
const CALIBRACION = {
  fuente: { repo: "ignacioDeusto/ros2_mucsi_26_27", commit: "4e4e1a74fe5ab81c3e1279120b33e9b235be198f" },
  articulacionDe: { shoulder: "shoulder_pan_joint", upper_arm: "shoulder_lift_joint", forearm: "elbow_joint", wrist_1: "wrist_1_joint", wrist_2: "wrist_2_joint", wrist_3: "wrist_3_joint" },
  robots: {
    "nominal": {
      mount_yaw: 3.141592653589793,
      doble: null,
      kinematics: {
        shoulder: { x: 0, y: 0, z: 0.15185, roll: 0, pitch: 0, yaw: 0 },
        upper_arm: { x: 0, y: 0, z: 0, roll: 1.570796327, pitch: 0, yaw: 0 },
        forearm: { x: -0.24355, y: 0, z: 0, roll: 0, pitch: 0, yaw: 0 },
        wrist_1: { x: -0.2132, y: 0, z: 0.13105, roll: 0, pitch: 0, yaw: 0 },
        wrist_2: { x: 0, y: -0.08535, z: -1.750557762378351e-11, roll: 1.570796327, pitch: 0, yaw: 0 },
        wrist_3: { x: 0, y: 0.0921, z: -1.8890025766262e-11, roll: 1.570796326589793, pitch: 3.141592653589793, yaw: 3.141592653589793 },
      },
      hash: "calib_16756443741236045476",
      sospechoso: false,
    },
    "203": {
      mount_yaw: 0.785398163,
      doble: { fichero: "urdf/doble_ur3e_203_204.urdf.xacro", x: 0, y: 0, yaw: 0.785398163 },
      kinematics: {
        shoulder: { x: 0, y: 0, z: 0.151982148052407, roll: 0, pitch: 0, yaw: -1.252186961134272e-07 },
        upper_arm: { x: -0.000117751414108642, y: 0, z: 0, roll: 1.570529532239682, pitch: 0, yaw: 6.651065255205953e-06 },
        forearm: { x: -0.2438301105845021, y: 0, z: 0, roll: 3.140422330317566, pitch: 3.140175127557685, yaw: 3.141557960492696 },
        wrist_1: { x: -0.2130137298406746, y: -0.0008374574461011085, z: 0.131604615239527, roll: 0.006363349347924476, pitch: 0.00401697960892016, yaw: 4.539196023121239e-06 },
        wrist_2: { x: 6.007850950088259e-06, y: -0.08542863254646067, z: -8.597162561949335e-05, roll: 1.571802682556826, pitch: 0, yaw: -2.655106245398608e-06 },
        wrist_3: { x: -5.693288443582482e-05, y: 0.09218998896546257, z: -4.447305315826958e-05, roll: 1.570313920297103, pitch: 3.141592653589793, yaw: 3.141592540005369 },
      },
      hash: "calib_15656952713550414269",
      sospechoso: false,
    },
    "204": {
      mount_yaw: 2.502802148,
      doble: { fichero: "urdf/doble_ur3e_203_204.urdf.xacro", x: 0.0051, y: -0.9, yaw: 2.502802148 },
      kinematics: {
        shoulder: { x: 0, y: 0, z: 0.1521279453523494, roll: 0, pitch: 0, yaw: 2.041466800294101e-08 },
        upper_arm: { x: -0.000126490720455529, y: 0, z: 0, roll: 1.570319637987853, pitch: 0, yaw: -3.505034055612523e-07 },
        forearm: { x: -0.2438505136709801, y: 0, z: 0, roll: 3.14155051985654, pitch: 3.140466803531021, yaw: -7.084894948754381e-06 },
        wrist_1: { x: -0.2135185211425481, y: 0.0004846921902928406, z: 0.1314220698336163, roll: 3.137904612506837, pitch: -3.140656470281812, yaw: -1.537537853229302e-08 },
        wrist_2: { x: -1.154600175010752e-05, y: -0.08547949008565842, z: -2.708491974536627e-05, roll: 1.571113185480083, pitch: 0, yaw: 8.04165597882711e-07 },
        wrist_3: { x: -9.775976460195503e-05, y: 0.09224742740592033, z: -0.0001459608408510609, roll: 1.569214052652985, pitch: 3.141592653589793, yaw: 3.141592618528382 },
      },
      hash: "calib_18117822752032744163",
      sospechoso: true,
    },
    "205": {
      mount_yaw: 3.141592653589793,
      doble: { fichero: "urdf/doble_ur3e_205_206.urdf.xacro", x: 0, y: 0, yaw: 3.14159265358979 },
      kinematics: {
        shoulder: { x: 0, y: 0, z: 0.1519932046329507, roll: 0, pitch: 0, yaw: -1.218598534562937e-07 },
        upper_arm: { x: -0.000133574490397829, y: 0, z: 0, roll: 1.571184054925294, pitch: 0, yaw: 3.46931133972767e-07 },
        forearm: { x: -0.2436650957547605, y: 0, z: 0, roll: 3.141429134391114, pitch: 3.1413007534876, yaw: 3.141585104530758 },
        wrist_1: { x: -0.2131937361714605, y: -0.0007020488731425266, z: 0.1309164554311118, roll: 0.00536252025231981, pitch: 0.0008389012176466991, yaw: 6.286415122585481e-06 },
        wrist_2: { x: 8.773921560453022e-06, y: -0.08546373128392754, z: -7.049413943712751e-05, roll: 1.571621169361338, pitch: 0, yaw: -1.170707376603464e-06 },
        wrist_3: { x: -0.0001118912945880604, y: 0.09206143807114163, z: -0.0001405802282309842, roll: 1.569269301778692, pitch: 3.141592653589793, yaw: -3.141592499182456 },
      },
      hash: "calib_7896003446683457052",
      sospechoso: false,
    },
    "206": {
      mount_yaw: 3.141592653589793,
      doble: { fichero: "urdf/doble_ur3e_205_206.urdf.xacro", x: 0, y: -1.102, yaw: 3.14159265358979 },
      kinematics: {
        shoulder: { x: 0, y: 0, z: 0.1519047144003236, roll: 0, pitch: 0, yaw: -9.530599491829224e-08 },
        upper_arm: { x: -0.0001107110555958654, y: 0, z: 0, roll: 1.570329613154402, pitch: 0, yaw: 3.417864421477842e-06 },
        forearm: { x: -0.2437259737936491, y: 0, z: 0, roll: 0.001105848958660876, pitch: 0.0006034712402559254, yaw: -4.507836367124921e-06 },
        wrist_1: { x: -0.2132584137315163, y: -0.0004232381093861393, z: 0.1311440944208638, roll: 0.003227264192714675, pitch: 0.0009285627531319139, yaw: 7.543943465429524e-07 },
        wrist_2: { x: 0.000165700073623267, y: -0.08547162011592442, z: -0.0001881112192972863, roll: 1.572997184989922, pitch: 0, yaw: 1.978861212743183e-06 },
        wrist_3: { x: -9.449984879160511e-05, y: 0.0920975245267849, z: -9.62025620790864e-05, roll: 1.569751754450705, pitch: 3.141592653589793, yaw: 3.141592261980481 },
      },
      hash: "calib_2954753171256876401",
      sospechoso: false,
    },
  },
};
if (typeof module !== 'undefined') module.exports = CALIBRACION;
