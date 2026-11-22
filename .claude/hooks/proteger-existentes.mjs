#!/usr/bin/env node
// Hook PreToolUse (Edit|Write|MultiEdit|NotebookEdit).
// Impide MODIFICAR archivos que ya existen y encajan con un grupo protegido
// (configuración de calidad, migraciones aplicadas, tests…). Crear archivos
// nuevos sigue permitido: escribir una migración o un test nuevo es legítimo;
// cambiar uno existente para que algo «pase» es el atajo que se quiere cortar.
//
// Grupos en .claude/hooks/hooks-config.json → "proteger". Cada grupo:
//   { "nombre", "archivos": [nombres exactos], "rutas": [globs relativos al repo],
//     "modo": "bloquear" | "preguntar", "motivo": "qué hacer en su lugar" }
//     "solo_versionados": true (opcional) → un archivo solo cuenta como existente si ya está en el último commit
//               (HEAD): el que la sesión acaba de crear y aún no ha commiteado se puede seguir corrigiendo.
//   bloquear  → exit 2: la edición no se hace y Claude lee el motivo.
//   preguntar → permissionDecision "ask": en sesión interactiva te pregunta a ti;
//               en una ejecución con -p (sin nadie) Claude Code la deniega.
//
// Sin dependencias (Node 18+). No usa red ni lee nada fuera del repo.
// Lista de configuraciones por defecto derivada del hook config-protection de
// ECC (github.com/affaan-m/ECC, licencia MIT).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MAX_STDIN = 1024 * 1024;

export const GRUPOS_POR_DEFECTO = [
  {
    nombre: "configuracion-de-calidad",
    archivos: [
      ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yml", ".eslintrc.yaml",
      "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs", "eslint.config.ts", "eslint.config.mts", "eslint.config.cts",
      ".prettierrc", ".prettierrc.js", ".prettierrc.cjs", ".prettierrc.json", ".prettierrc.yml", ".prettierrc.yaml",
      "prettier.config.js", "prettier.config.cjs", "prettier.config.mjs",
      "biome.json", "biome.jsonc", ".biome.json", ".biome.jsonc", ".ruff.toml", "ruff.toml", ".shellcheckrc",
      ".stylelintrc", ".stylelintrc.json", ".stylelintrc.yml", ".stylelintrc.yaml", ".stylelintrc.js", ".stylelintrc.cjs", ".stylelintrc.mjs",
      "stylelint.config.js", "stylelint.config.cjs", "stylelint.config.mjs", "stylelint.config.ts",
      ".markdownlint.json", ".markdownlint.jsonc", ".markdownlint.yaml", ".markdownlint.yml", ".markdownlintrc",
      ".eslintignore", ".prettierignore", ".stylelintignore", ".markdownlintignore",
    ],
    modo: "bloquear",
    motivo: "No relajes la configuración del linter o del formateador: corrige el código para que la cumpla. Si el cambio de configuración es legítimo, pídeselo al usuario.",
  },
  {
    nombre: "proteccion-de-los-hooks",
    rutas: [".claude/hooks/**", ".claude/settings.json", ".claude/settings.local.json"],
    modo: "preguntar",
    motivo: "Estos archivos definen las protecciones del repo; cambiarlos lo decide el usuario.",
  },
];

function leerStdin() {
  return new Promise((resolve) => {
    let raw = "";
    let truncado = false;
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => {
      if (raw.length + c.length > MAX_STDIN) { truncado = true; raw += c.slice(0, MAX_STDIN - raw.length); }
      else raw += c;
    });
    process.stdin.on("end", () => resolve({ raw, truncado }));
    process.stdin.on("error", () => resolve({ raw, truncado }));
  });
}

export function globARegex(glob, insensible) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const barra = glob[i + 2] === "/";
        re += barra ? "(?:.*/)?" : ".*";
        i += barra ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if ("\\^$+.()|{}[]".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$", insensible ? "i" : "");
}

export function rutasObjetivo(toolInput) {
  const comun = toolInput?.file_path || toolInput?.notebook_path || "";
  const edits = Array.isArray(toolInput?.edits) ? toolInput.edits : [];
  const todas = [comun, ...edits.map((e) => (e && typeof e === "object" ? e.file_path : ""))];
  return [...new Set(todas.filter((p) => typeof p === "string" && p))];
}

function existe(ruta) {
  try { fs.lstatSync(ruta); return true; }
  catch (e) { return !(e && e.code === "ENOENT"); } // ante un error raro, se trata como existente
}

// ¿Está rel en el último commit del repo? Ante cualquier fallo de git (no hay repo, no hay git), sí: se protege.
export function enHead(raizProyecto, rel) {
  const r = spawnSync("git", ["cat-file", "-e", `HEAD:${rel}`], { cwd: raizProyecto, stdio: "ignore" });
  if (r.error || r.status === null) return true;
  if (r.status === 0) return true;
  const repo = spawnSync("git", ["rev-parse", "--verify", "-q", "HEAD"], { cwd: raizProyecto, stdio: "ignore" });
  return Boolean(repo.error) || repo.status !== 0; // sin HEAD legible, se protege; con HEAD y sin el archivo, es nuevo
}

export function cargarGrupos(raizProyecto) {
  const archivo = path.join(raizProyecto, ".claude", "hooks", "hooks-config.json");
  if (!fs.existsSync(archivo)) return { grupos: GRUPOS_POR_DEFECTO };
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(archivo, "utf8")); }
  catch (e) { return { error: `hooks-config.json no es JSON válido (${e.message}). Arréglalo antes de seguir editando.` }; }
  const grupos = Array.isArray(cfg?.proteger) ? cfg.proteger : GRUPOS_POR_DEFECTO;
  return { grupos };
}

export function decidir(entrada, raizProyecto, plataforma = process.platform) {
  const insensible = plataforma === "win32" || plataforma === "darwin";
  const { grupos, error } = cargarGrupos(raizProyecto);
  if (error) return { codigo: 2, stderr: `BLOQUEADO: ${error}` };
  for (const objetivo of rutasObjetivo(entrada?.tool_input)) {
    const abs = path.isAbsolute(objetivo) ? objetivo : path.resolve(entrada?.cwd || raizProyecto, objetivo);
    if (!existe(abs)) continue; // crear es libre
    const base = path.basename(abs);
    const rel = path.relative(raizProyecto, abs).split(path.sep).join("/");
    const dentro = rel && !rel.startsWith("../") && !path.isAbsolute(rel);
    for (const g of grupos) {
      const porNombre = (g.archivos || []).some((n) => (insensible ? n.toLowerCase() === base.toLowerCase() : n === base));
      const porRuta = dentro && (g.rutas || []).some((glob) => globARegex(glob, insensible).test(rel));
      if (!porNombre && !porRuta) continue;
      if (g.solo_versionados && dentro && !enHead(raizProyecto, rel)) continue; // creado en esta tarea y sin commitear
      const mensaje = `${dentro ? rel : base} está protegido (grupo «${g.nombre}»). ${g.motivo || ""}`.trim();
      if (g.modo === "preguntar") {
        return {
          codigo: 0,
          stdout: JSON.stringify({
            hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: mensaje },
          }),
        };
      }
      return { codigo: 2, stderr: `BLOQUEADO: ${mensaje}` };
    }
  }
  return { codigo: 0 };
}

async function main() {
  const { raw, truncado } = await leerStdin();
  if (truncado) {
    process.stderr.write("BLOQUEADO: la entrada del hook supera 1 MB; haz la edición en partes más pequeñas.\n");
    process.exit(2);
  }
  let entrada = {};
  try { entrada = raw ? JSON.parse(raw) : {}; }
  catch { process.exit(0); } // sin entrada legible no hay nada que proteger
  const raiz = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd();
  const r = decidir(entrada, raiz);
  if (r.stdout) process.stdout.write(r.stdout + "\n");
  if (r.stderr) process.stderr.write(r.stderr + "\n");
  process.exit(r.codigo);
}

if (process.argv[1]?.endsWith("proteger-existentes.mjs")) main();
