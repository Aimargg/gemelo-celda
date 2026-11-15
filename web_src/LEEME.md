# Gemelo de la celda UR3e: página propia con escenas compartidas

Esta carpeta es el gemelo 3D listo para alojarlo fuera de claude.ai. Cualquiera con el enlace completo puede abrir escenas, guardarlas y editarlas, sin cuenta.

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página |
| `config.js` | La conexión con tu proyecto de Firebase (hay que rellenarlo) |
| `firebase.js` | La librería de Firebase 13.1.0, incluida en el paquete |
| `ur3e-malla.json`, `mesa.jpg` | Modelo del robot y textura de la mesa |
| `firestore.rules` | Las reglas de seguridad que se pegan en Firestore |
| `LEEME.md` | Esta guía; no hace falta subirla |

Clave del grupo: `@@CLAVE@@`
Está en `firestore.rules` y va al final del enlace. Quien no la tenga no ve ni toca nada.

## 1. Firebase (unos 10 min)

1. Entra en https://console.firebase.google.com con tu cuenta de Google y pulsa **Crear un proyecto** (o «Agregar proyecto»).
   - Nombre: `gemelo-celda`.
   - Google Analytics: desactívalo, no hace falta.
   - Pulsa **Crear proyecto**.
2. En el menú de la izquierda, entra en **Firestore** (puede aparecer como «Firestore Database» o dentro de «Databases & Storage») y pulsa **Crear base de datos**.
   - Si te pregunta la edición, elige **Standard**.
   - Ubicación: `europe-southwest1 (Madrid)`. Después no se puede cambiar.
   - Modo: **producción**.
   - Pulsa **Crear**.
3. En la pestaña **Reglas**, borra todo lo que haya, pega el contenido entero de `firestore.rules` y pulsa **Publicar**.
4. Registra la app web.
   - Ve a la rueda dentada › **Configuración del proyecto** › **General** › **Tus apps** y pulsa el icono **`</>`** (Web).
   - Apodo: `gemelo`. **No** marques Firebase Hosting. Pulsa **Registrar app**.
   - Copia solo el bloque que empieza por `const firebaseConfig = {` y acaba en `};`.
5. Abre `config.js` con el Bloc de notas y sustituye el bloque de ejemplo (el de `PEGA_AQUI`) por el que has copiado. No toques la última línea. Guarda el archivo.

## 2. GitHub Pages (unos 5 min)

Usa un repositorio **personal y aparte**, nunca el del proyecto de Robótica: este código lo ha generado una IA y nadie del grupo lo ha escrito.

6. En https://github.com/new crea el repositorio `gemelo-celda`.
   - Visibilidad: **Public** (GitHub Pages gratis necesita repositorio público).
   - Sin README.
   - Pulsa **Create repository**.
7. En la página del repositorio vacío, pulsa el enlace **uploading an existing file**.
   - Arrastra `index.html`, `config.js`, `firebase.js`, `ur3e-malla.json` y `mesa.jpg`.
   - Pulsa **Commit changes**.
8. Ve a **Settings** › **Pages**.
   - En «Build and deployment», elige Source: **Deploy from a branch**.
   - Branch: **main** y **/ (root)**. Pulsa **Save**.
   - En 1 o 2 minutos aparece «Your site is live at `https://TU_USUARIO.github.io/gemelo-celda/`».

## 3. Probar y compartir

9. Abre `https://TU_USUARIO.github.io/gemelo-celda/#g=@@CLAVE@@`.
   - En la barra de escenas (arriba, junto al título) debe poner «ninguna escena guardada», sin avisos rojos.
10. Pulsa **Guardar escena**. Escribe tu nombre y el de la escena, y pulsa **Guardar como escena nueva**. Debe salir «Escena guardada».
11. Comprueba que ha llegado: en Firestore › **Datos** tiene que aparecer `grupos` › `@@CLAVE@@` › `escenas` con un documento.
12. Abre el mismo enlace en el móvil. Tiene que salir la escena.
13. Comparte el **enlace completo, con `#g=…`**, en el grupo. Cada persona escribe su nombre la primera vez que guarda.

## Si algo falla

| Aviso en la página | Qué hacer |
|---|---|
| «Falta conectar la página con Firebase» | `config.js` sigue con `PEGA_AQUI`, o no lo has subido. Repite el paso 5 y vuelve a subirlo. |
| «La clave del grupo del enlace no es válida…» | Las reglas no están publicadas (paso 3) o el enlace no lleva la clave exacta. |
| «Al enlace le falta la clave del grupo» | Se ha abierto sin la parte `#g=…`. Usa el enlace completo; después la página la recuerda en ese navegador. |
| La página sale en blanco | Revisa que los cinco archivos están en la raíz del repositorio, no dentro de una carpeta. |

## Cómo funciona

- **Tu mesa** es tu copia de trabajo y se queda en tu navegador. Abrir una escena no la cambia. Si modificas una escena abierta, lo editado pasa a Tu mesa y la escena original no se toca hasta que pulses **Guardar cambios**.
- Cualquiera del grupo puede editar o mandar a la papelera cualquier escena. Desde la papelera se restaura o se borra para siempre.
- Al guardar se hace la comprobación previa. El punto verde o rojo de cada escena indica si es viable.
- Las escenas que tengáis en la versión de claude.ai no pasan solas. Ábrelas allí, pulsa **Copiar código de lo que ves**, pega el código aquí con **Abrir código** y guárdala.

## Mantenimiento

- **Actualizar la página:** en el repositorio, ve a **Add file** › **Upload files** y sube los archivos nuevos con el mismo nombre; se sustituyen.
- **Si la clave se filtra:** cámbiala en las reglas (Firestore › Reglas › Publicar) y comparte el enlace con la clave nueva. Las escenas guardadas con la clave antigua dejan de verse, aunque siguen en Firestore.
- **Coste:** la cuota gratuita de Firestore (1 GiB, 50 000 lecturas y 20 000 escrituras al día) sobra para el grupo.
