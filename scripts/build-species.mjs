/**
 * Convierte la base heredada (legacy/especies.js) en public/data/equilibrado.json:
 * - umbrales de rareza por percentiles de la propia base;
 * - estado UICN normalizado (fuera rangos NatureServe y textos);
 * - visitas descartadas cuando el artículo de Wikipedia es de otra especie;
 * - foto marcada como «licencia sin verificar» (la base vieja no la guardó).
 *
 * Uso: node scripts/build-species.mjs [ruta/especies.js]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const src = process.argv[2] ?? 'legacy/especies.js';
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(src, 'utf8'), sandbox);
const rows = sandbox.window.SPECIES_DB;
if (!Array.isArray(rows)) throw new Error(`${src} no define window.SPECIES_DB`);

const IUCN = ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX'];
const WORDS = { VULNERABLE: 'VU', 'EN PELIGRO': 'EN', 'EN PELIGRO CRITICO': 'CR', 'CASI AMENAZADA': 'NT', 'PREOCUPACION MENOR': 'LC' };
const iucn = (c) => {
  if (!c) return null;
  const s = String(c).trim().toUpperCase();
  if (IUCN.includes(s)) return s;
  return WORDS[s.normalize('NFD').replace(/[̀-ͯ]/g, '')] ?? null;
};

/**
 * ¿El título de Wikipedia corresponde a otra especie del mismo género? (p. ej. Pinus yecorensis →
 * Pinus_pseudostrobus). Mismo epíteto en otro género es un sinónimo y vale; un género solo o un
 * nombre común («Jack pine») también.
 */
const otherSpecies = (sci, title) => {
  const t = title.replace(/_/g, ' ');
  if (t === sci) return false;
  const [genus, epithet] = sci.split(' ');
  const m = t.match(/^([A-Z][a-z]+) ([a-z-]+)$/);
  return Boolean(m && m[1] === genus && m[2] !== epithet);
};

let dubious = 0;
const species = rows.map(([sci, group, e]) => {
  const bad = otherSpecies(sci, e.w);
  if (bad) dubious++;
  return {
    taxonId: e.t,
    sci,
    group,
    name: e.n || '',
    photo: e.i ? { url: e.i, attribution: '', license: null } : null,
    views: bad ? null : e.v,
    observations: e.o,
    iucn: iucn(e.c),
    wikiTitle: e.w,
  };
});

const ORDER = ['comun', 'pocoComun', 'rara', 'epica', 'legendaria'];
const SHARE = { comun: 0.5, pocoComun: 0.25, rara: 0.15, epica: 0.07, legendaria: 0.03 };
const views = species.map((s) => s.views).filter((v) => v != null).sort((a, b) => b - a);
const thresholds = {};
let acc = 0;
for (const id of ORDER) {
  acc += SHARE[id];
  thresholds[id] = id === 'legendaria' ? 0 : views[Math.min(views.length - 1, Math.floor((acc - 1e-9) * views.length))];
}

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: src,
  thresholds,
  species,
};
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/equilibrado.json', JSON.stringify(out));
const count = Object.fromEntries(ORDER.map((id) => [id, 0]));
for (const s of species) {
  if (s.views == null) { count.comun++; continue; }
  count[ORDER.find((id) => s.views >= thresholds[id])]++;
}
console.log(`${species.length} especies · ${dubious} con visitas descartadas (artículo de otra especie)`);
console.log('umbrales', thresholds);
console.log('reparto', count);
