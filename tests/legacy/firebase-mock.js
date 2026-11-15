// Simulación de Firestore para pruebas (emula también las reglas del paquete)
const store = (globalThis.__fsStore ||= new Map()); const subs = (globalThis.__fsSubs ||= []);
export function initializeApp(cfg) { return { cfg }; }
export function getFirestore(app) { return { app }; }
export function collection(db, ...segs) { return { path: segs.join('/'), segs }; }
let n = 0; export function doc(col, id) { return { id: id || ('auto' + (++n) + Math.random().toString(36).slice(2, 6)), col }; }
const ok = col => col.segs[1] === 'clave-buena';
const err = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
const snap = col => ({ docs: [...store.entries()].filter(([k]) => k.startsWith(col.path + '/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => JSON.parse(JSON.stringify(v)) })) });
const notify = () => setTimeout(() => subs.forEach(s => s.cb(snap(s.col))), 20);
const CAMPOS = ['nombre', 'nota', 'autor', 'editadoPor', 'creado', 'editado', 'layout', 'ajustes', 'vista', 'estado', 'borrado', 'borradoPor'];
function esEscena(d) {
  const malo = Object.keys(d).find(k => !CAMPOS.includes(k)); if (malo) return 'campo ' + malo;
  if (typeof d.nombre !== 'string' || !d.nombre.length || d.nombre.length > 60) return 'nombre';
  if (typeof d.nota !== 'string' || d.nota.length > 500) return 'nota';
  if (typeof d.autor !== 'string' || d.autor.length > 40) return 'autor';
  if (typeof d.layout !== 'string' || d.layout.length > 50000) return 'layout';
  if (typeof d.borrado !== 'boolean') return 'borrado';
  if (JSON.stringify(d).includes('undefined')) return 'undefined';
  return null;
}
export function onSnapshot(col, cb, onErr) { if (!ok(col)) { setTimeout(() => onErr(err()), 30); return () => { }; } subs.push({ col, cb }); setTimeout(() => cb(snap(col)), 30); return () => { }; }
export async function setDoc(ref, data) { if (!ok(ref.col)) throw err(); const m = esEscena(data); if (m) { globalThis.__fsRechazo = m; throw err(); } store.set(ref.col.path + '/' + ref.id, JSON.parse(JSON.stringify(data))); notify(); }
export async function updateDoc(ref, data) { if (!ok(ref.col)) throw err(); const k = ref.col.path + '/' + ref.id; const v = { ...store.get(k), ...data }; const m = esEscena(v); if (m) { globalThis.__fsRechazo = m; throw err(); } store.set(k, v); notify(); }
export async function deleteDoc(ref) { const k = ref.col.path + '/' + ref.id; if (!ok(ref.col) || !(store.get(k) || {}).borrado) throw err(); store.delete(k); notify(); }
