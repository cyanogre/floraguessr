/**
 * Comprueba con llamadas reales los parámetros de iNaturalist en los que se apoya el juego.
 * Uso: npm run verify-apis   (necesita salida a api.inaturalist.org)
 *
 * Imprime un informe: qué funciona, qué se ignora en silencio y qué alternativa usa el juego.
 */
const API = 'https://api.inaturalist.org/v1/';
const UA = 'FloraGuessr/0.1 (verificación de parámetros)';
const BASE = 'iconic_taxa=Plantae&quality_grade=research&captive=false';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  await sleep(1100); // ≤ 60/min
  const res = await fetch(API + path, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

const report = [];
const check = async (name, fn) => {
  try {
    const [ok, detail] = await fn();
    report.push([ok ? 'OK ' : 'NO ', name, detail]);
  } catch (e) {
    report.push(['ERR', name, String(e.message ?? e)]);
  }
};

// 1. order_by=random: dos peticiones deberían devolver observaciones distintas y no las más recientes.
await check('order_by=random en /observations', async () => {
  const a = await get(`observations?${BASE}&order_by=random&per_page=5`);
  const b = await get(`observations?${BASE}&order_by=random&per_page=5`);
  const latest = await get(`observations?${BASE}&per_page=5`);
  const ids = (d) => d.results.map((o) => o.id).join(',');
  const differs = ids(a) !== ids(b);
  const notLatest = ids(a) !== ids(latest);
  return [differs && notLatest, `A=${ids(a)} · B=${ids(b)} · por defecto=${ids(latest)}`];
});

// 2. native=true en species_counts sin place_id: ¿filtra algo?
await check('native=true en /observations/species_counts (punto + radio)', async () => {
  const q = `observations/species_counts?${BASE}&lat=40.4168&lng=-3.7038&radius=75&per_page=1`;
  const all = await get(q);
  const nat = await get(`${q}&native=true`);
  const intro = await get(`${q}&introduced=true`);
  const filters = nat.total_results < all.total_results;
  return [filters, `todas=${all.total_results} · native=${nat.total_results} · introduced=${intro.total_results}`];
});

// 3. taxon_id con varios ids (resueltos por nombre para no depender de ids de memoria).
await check('taxon_id con varios ids', async () => {
  const idOf = async (name) => (await get(`taxa?q=${encodeURIComponent(name)}&per_page=1`)).results[0].id;
  const quercus = await idOf('Quercus');
  const pinus = await idOf('Pinus');
  const d = await get(`observations/species_counts?quality_grade=research&lat=40.4168&lng=-3.7038&radius=75&per_page=100&taxon_id=${quercus},${pinus}`);
  const genera = new Set(d.results.map((r) => r.taxon.name.split(' ')[0]));
  return [genera.has('Quercus') && genera.has('Pinus'), `ids ${quercus},${pinus} → ${d.total_results} especies; géneros: ${[...genera].join(', ')}`];
});

// 4. acc_below: todas las devueltas con positional_accuracy < N.
await check('acc_below en /observations', async () => {
  const d = await get(`observations?${BASE}&acc_below=100&per_page=30`);
  const bad = d.results.filter((o) => o.positional_accuracy == null || o.positional_accuracy >= 100);
  return [bad.length === 0, `${d.results.length} devueltas, ${bad.length} fuera de rango`];
});

// 5. Alternativa usada por el juego: id aleatorio + id_above + caja geográfica.
await check('id_above + order_by=id (alternativa al azar)', async () => {
  const top = await get(`observations?${BASE}&order_by=id&order=desc&per_page=1`);
  const max = top.results[0].id;
  const pivot = Math.floor(Math.random() * max);
  const d = await get(`observations?${BASE}&id_above=${pivot}&order_by=id&order=asc&per_page=1&swlat=35&swlng=-11&nelat=60&nelng=30`);
  const o = d.results[0];
  return [Boolean(o && o.id > pivot), `máx=${max} · pivote=${pivot} · devuelta=${o?.id} en ${o?.location}`];
});

// 6. Varios ids en /taxa (detalles en una sola llamada).
await check('/taxa/{id1,id2} con ancestros y licencia de foto', async () => {
  const d = await get('taxa/48586,47851?locale=es');
  const t = d.results[0];
  return [d.results.length === 2 && Boolean(t.default_photo?.license_code !== undefined), `n=${d.results.length}; ancestors=${Boolean(t.ancestors)}; licencia=${t.default_photo?.license_code}; atribución="${t.default_photo?.attribution}"`];
});

console.log('\nVerificación de parámetros de iNaturalist\n');
for (const [s, name, detail] of report) console.log(`${s}  ${name}\n     ${detail}`);
