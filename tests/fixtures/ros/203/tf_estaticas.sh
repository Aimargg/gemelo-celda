#!/bin/bash
# tf_estaticas.sh · gemelo de la celda UR3e · generado por el gemelo (IA), BORRADOR
# Robot: 203 (calibration_203.yaml del curso), en la posición B de la celda (derecha en la foto cenital).
# Frame: base_link (sin prefijo, como en sim_<id>). Metros y radianes (REP-103), redondeo a 1 mm y 0,001 rad.
# Huella de la disposición: 38b05d41 (FNV-1a de 32 bits de JSON.stringify(L), en UTF-8): casa este fichero con su disposición.
# Carga: bash tf_estaticas.sh, con ROS 2 Jazzy en el entorno: una static_transform_publisher por TF; Ctrl+C las para todas [SIN VALIDAR en ROS: U4].
# En una escena doble, carga las TF de un solo robot: cada frame admite un único padre.
# Metros y radianes; los ángulos, con setRPY (R = Rz(yaw)·Ry(pitch)·Rx(roll), ejes fijos). Los mismos números que tf/<child_frame_id>.yaml.
# zona_centro (centro de la bandeja): el destino del plato con un pedido de un plato; con dos, como en esta disposición, no se usa.
# Origen de cada valor, en la línea anterior a cada comando: MEDIDO, FABRICANTE o SUPUESTO; lo que se elige en el gemelo, «elegido en el gemelo».
trap 'kill $(jobs -p) 2>/dev/null' INT TERM
# base_link → mesa: SUPUESTO (giro world→base_link sin validar en ROS)
ros2 run tf2_ros static_transform_publisher --x 0.497 --y -0.117 --z 0.000 --roll 0.000 --pitch 0.000 --yaw 2.356 --frame-id base_link --child-frame-id mesa --ros-args -r __node:=tf_mesa &
# base_link → zona_fruta: SUPUESTO (disposición propuesta, sin medir)
ros2 run tf2_ros static_transform_publisher --x 0.221 --y -0.223 --z 0.000 --roll 0.000 --pitch 0.000 --yaw 2.356 --frame-id base_link --child-frame-id zona_fruta --ros-args -r __node:=tf_zona_fruta &
# base_link → plato_1_inicio: SUPUESTO (disposición propuesta, sin medir)
ros2 run tf2_ros static_transform_publisher --x 0.344 --y 0.105 --z 0.100 --roll 0.000 --pitch 0.000 --yaw 2.356 --frame-id base_link --child-frame-id plato_1_inicio --ros-args -r __node:=tf_plato_1_inicio &
# base_link → plato_2_inicio: SUPUESTO (disposición propuesta, sin medir)
ros2 run tf2_ros static_transform_publisher --x 0.348 --y -0.093 --z 0.100 --roll 0.000 --pitch 0.000 --yaw 2.356 --frame-id base_link --child-frame-id plato_2_inicio --ros-args -r __node:=tf_plato_2_inicio &
# base_link → marcador_4: SUPUESTO (disposición propuesta, sin medir)
ros2 run tf2_ros static_transform_publisher --x 0.087 --y 0.152 --z 0.000 --roll 0.000 --pitch 0.000 --yaw 2.356 --frame-id base_link --child-frame-id marcador_4 --ros-args -r __node:=tf_marcador_4 &
# base_link → marcador_5: SUPUESTO (disposición propuesta, sin medir)
ros2 run tf2_ros static_transform_publisher --x 0.144 --y 0.308 --z 0.000 --roll 0.000 --pitch 0.000 --yaw 2.356 --frame-id base_link --child-frame-id marcador_5 --ros-args -r __node:=tf_marcador_5 &
# base_link → bandeja: SUPUESTO (disposición propuesta, sin medir) · nominal: la sustituye la pose que publique Visión
ros2 run tf2_ros static_transform_publisher --x -0.351 --y 0.279 --z 0.240 --roll 0.000 --pitch 0.000 --yaw -0.785 --frame-id base_link --child-frame-id bandeja --ros-args -r __node:=tf_bandeja &
# bandeja → zona_primero: SUPUESTO (sin medir)
ros2 run tf2_ros static_transform_publisher --x -0.020 --y 0.100 --z 0.001 --roll 0.000 --pitch 0.000 --yaw 0.000 --frame-id bandeja --child-frame-id zona_primero --ros-args -r __node:=tf_zona_primero &
# bandeja → zona_segundo: SUPUESTO (sin medir)
ros2 run tf2_ros static_transform_publisher --x -0.020 --y -0.100 --z 0.001 --roll 0.000 --pitch 0.000 --yaw 0.000 --frame-id bandeja --child-frame-id zona_segundo --ros-args -r __node:=tf_zona_segundo &
# bandeja → zona_centro: SUPUESTO (sin medir)
ros2 run tf2_ros static_transform_publisher --x -0.020 --y 0.000 --z 0.001 --roll 0.000 --pitch 0.000 --yaw 0.000 --frame-id bandeja --child-frame-id zona_centro --ros-args -r __node:=tf_zona_centro &
# base_link → camara_cenital: SUPUESTO (disposición propuesta, sin medir) · nominal: la sustituye la calibración
ros2 run tf2_ros static_transform_publisher --x 0.497 --y 0.124 --z 0.410 --roll 0.000 --pitch 0.988 --yaw -2.393 --frame-id base_link --child-frame-id camara_cenital --ros-args -r __node:=tf_camara_cenital &
# camara_cenital → camara_cenital_optical: FABRICANTE (convenio de REP-103)
ros2 run tf2_ros static_transform_publisher --x 0.000 --y 0.000 --z 0.000 --roll -1.571 --pitch 0.000 --yaw -1.571 --frame-id camara_cenital --child-frame-id camara_cenital_optical --ros-args -r __node:=tf_camara_cenital_optical &
# base_link → camara_entrega: SUPUESTO (disposición propuesta, sin medir) · nominal: la sustituye la calibración
ros2 run tf2_ros static_transform_publisher --x 0.387 --y 0.552 --z 0.490 --roll 0.000 --pitch 0.600 --yaw -2.613 --frame-id base_link --child-frame-id camara_entrega --ros-args -r __node:=tf_camara_entrega &
# camara_entrega → camara_entrega_optical: FABRICANTE (convenio de REP-103)
ros2 run tf2_ros static_transform_publisher --x 0.000 --y 0.000 --z 0.000 --roll -1.571 --pitch 0.000 --yaw -1.571 --frame-id camara_entrega --child-frame-id camara_entrega_optical --ros-args -r __node:=tf_camara_entrega_optical &
# base_link → camara_persona: SUPUESTO (disposición propuesta, sin medir) · nominal: la sustituye la calibración
ros2 run tf2_ros static_transform_publisher --x 0.543 --y 0.354 --z 0.490 --roll 0.000 --pitch -0.044 --yaw 3.007 --frame-id base_link --child-frame-id camara_persona --ros-args -r __node:=tf_camara_persona &
# camara_persona → camara_persona_optical: FABRICANTE (convenio de REP-103)
ros2 run tf2_ros static_transform_publisher --x 0.000 --y 0.000 --z 0.000 --roll -1.571 --pitch 0.000 --yaw -1.571 --frame-id camara_persona --child-frame-id camara_persona_optical --ros-args -r __node:=tf_camara_persona_optical &
wait
