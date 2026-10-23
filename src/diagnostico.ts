/**
 * Página oculta (?diagnostico): comprueba desde el navegador del jugador las APIs y parámetros en
 * los que se apoya el juego. Sirve para verificar en vivo lo que no se puede probar en desarrollo.
 */
import { APP_UA } from './config';

const INAT = 'https://api.inaturalist.org/v1/';
const BASE = 'iconic_taxa=Plantae&quality_grade=research&captive=false';
const WM = { 'Api-User-Agent': APP_UA };

type Row = { name: string; ok: boolean | null; detail: string; ms: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, headers?: Record<string, string>) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
const inat = async (path: string) => {
  await sleep(1100);
  return get(INAT + path);
};

const checks: [string, () => Promise<[boolean, string]>][] = [
  ['iNaturalist: order_by=random', async () => {
    const ids = (d: { results: { id: number }[] }) => d.results.map((o) => o.id).join(',');
    const a = await inat(`observations?${BASE}&order_by=random&per_page=5`);
    const b = await inat(`observations?${BASE}&order_by=random&per_page=5`);
    const def = await inat(`observations?${BASE}&per_page=5`);
    return [ids(a) !== ids(b) && ids(a) !== ids(def), `A=${ids(a)} B=${ids(b)} normal=${ids(def)}`];
  }],
  ['iNaturalist: native=true en species_counts', async () => {
    const q = `observations/species_counts?${BASE}&lat=40.4168&lng=-3.7038&radius=75&per_page=1`;
    const all = await inat(q);
    const nat = await inat(`${q}&native=true`);
    return [nat.total_results < all.total_results, `todas=${all.total_results} nativas=${nat.total_results}`];
  }],
  ['iNaturalist: taxon_id con varios ids', async () => {
    const idOf = async (n: string) => (await inat(`taxa?q=${n}&per_page=1`)).results[0].id as number;
    const [q, p] = [await idOf('Quercus'), await idOf('Pinus')];
    const d = await inat(`observations/species_counts?quality_grade=research&lat=40.4168&lng=-3.7038&radius=75&per_page=100&taxon_id=${q},${p}`);
    const g = new Set<string>(d.results.map((r: { taxon: { name: string } }) => r.taxon.name.split(' ')[0]));
    return [g.has('Quercus') && g.has('Pinus'), `géneros: ${[...g].join(', ')}`];
  }],
  ['iNaturalist: acc_below', async () => {
    const d = await inat(`observations?${BASE}&acc_below=100&per_page=30`);
    const bad = d.results.filter((o: { positional_accuracy: number | null }) => o.positional_accuracy == null || o.positional_accuracy >= 100).length;
    return [bad === 0, `${d.results.length} devueltas, ${bad} fuera de rango`];
  }],
  ['iNaturalist: id_above (método del juego)', async () => {
    const top = await inat(`observations?${BASE}&order_by=id&order=desc&per_page=1`);
    const pivot = Math.floor(Math.random() * top.results[0].id);
    const d = await inat(`observations?${BASE}&id_above=${pivot}&order_by=id&order=asc&per_page=1&swlat=-45&swlng=112&nelat=-10&nelng=155`);
    const o = d.results[0];
    return [Boolean(o && o.id > pivot), `pivote ${pivot} → ${o?.id} en ${o?.location}`];
  }],
  ['iNaturalist: /taxa con licencia de foto', async () => {
    const d = await inat('taxa?q=Quercus%20robur&per_page=1');
    const t = await inat(`taxa/${d.results[0].id}?locale=es`);
    const p = t.results[0].default_photo;
    return [p && 'license_code' in p, `licencia=${p?.license_code} · ${p?.attribution}`];
  }],
  ['GBIF: recuento por especie en un círculo', async () => {
    const m = await get('https://api.gbif.org/v1/species/match?kingdom=Plantae&name=Quercus%20ilex');
    const wkt = 'POLYGON((-3 40,-3.5 40,-3.5 40.5,-3 40.5,-3 40))';
    const d = await get(`https://api.gbif.org/v1/occurrence/search?taxonKey=${m.speciesKey}&geometry=${encodeURIComponent(wkt)}&facet=speciesKey&limit=1`);
    return [d.count >= 0 && Array.isArray(d.facets), `clave ${m.speciesKey}, ${d.count} registros`];
  }],
  ['Wikipedia: visitas por lotes (API de acción)', async () => {
    const d = await get('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=pageviews&pvipdays=60&titles=Quercus_robur|Jack_pine', WM);
    type Page = { title: string; pageviews?: Record<string, number | null> };
    const pages: Page[] = d.query?.pages ?? [];
    const sum = (p: Page) => Object.values(p.pageviews ?? {}).reduce((a: number, b) => a + (b ?? 0), 0);
    return [pages.length === 2 && pages.every((p) => sum(p) > 0), pages.map((p) => `${p.title}: ${sum(p)}`).join(' · ')];
  }],
  ['Wikimedia: visitas mensuales (API REST)', async () => {
    const d = await get('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Quercus_robur/monthly/2025010100/2025120100', WM);
    return [d.items?.length > 0, `${d.items?.length} meses`];
  }],
  ['Wikipedia: resumen en español', async () => {
    const d = await get('https://es.wikipedia.org/api/rest_v1/page/summary/Quercus_robur', WM);
    return [Boolean(d.extract), (d.extract ?? '').slice(0, 60) + '…'];
  }],
  ['Satélite de Esri', () =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve([true, `${img.naturalWidth}×${img.naturalHeight}`]);
      img.onerror = () => resolve([false, 'no carga la tesela']);
      img.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/3/3';
    })],
];

export async function runDiagnostics(): Promise<void> {
  document.body.style.overflow = 'auto';
  const app = document.getElementById('app');
  if (app) app.hidden = true;
  const root = document.createElement('main');
  root.className = 'diag';
  root.innerHTML = `<h1>Diagnóstico</h1>
    <p>Comprobando las fuentes de datos desde este navegador. Tarda unos 20 segundos.</p>
    <table><thead><tr><th>Prueba</th><th>Resultado</th><th>Detalle</th></tr></thead><tbody></tbody></table>
    <p><button type="button" class="btn btn-primary" id="diag-copy" disabled>Copiar resultado</button> <span id="diag-msg" role="status"></span></p>
    <textarea id="diag-text" readonly rows="8" hidden></textarea>`;
  document.body.append(root);
  const tbody = root.querySelector('tbody')!;
  const rows: Row[] = [];
  for (const [name, fn] of checks) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${name}</td><td>…</td><td></td>`;
    tbody.append(tr);
    const t0 = performance.now();
    let row: Row;
    try {
      const [ok, detail] = await fn();
      row = { name, ok, detail, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      row = { name, ok: null, detail: String((e as Error).message ?? e), ms: Math.round(performance.now() - t0) };
    }
    rows.push(row);
    tr.children[1].textContent = row.ok === true ? 'Funciona' : row.ok === false ? 'No hace lo esperado' : 'Error';
    tr.className = row.ok === true ? 'is-ok' : 'is-miss';
    tr.children[2].textContent = `${row.detail} (${row.ms} ms)`;
  }
  const text = [`FloraGuessr · diagnóstico · ${new Date().toISOString()}`, navigator.userAgent, ...rows.map((r) => `${r.ok === true ? 'OK ' : r.ok === false ? 'NO ' : 'ERR'} ${r.name} — ${r.detail} (${r.ms} ms)`)].join('\n');
  const area = root.querySelector<HTMLTextAreaElement>('#diag-text')!;
  area.value = text;
  area.hidden = false;
  const btn = root.querySelector<HTMLButtonElement>('#diag-copy')!;
  btn.disabled = false;
  btn.addEventListener('click', async () => {
    const msg = root.querySelector('#diag-msg')!;
    try {
      await navigator.clipboard.writeText(text);
      msg.textContent = 'Copiado. Pégalo en el chat.';
    } catch {
      area.select();
      msg.textContent = 'Selecciona el texto de abajo y cópialo.';
    }
  });
}
