import type { Page, Route } from '@playwright/test';

/** Simulación de iNaturalist, GBIF y Wikimedia suficiente para jugar en modo Mundial y Equilibrado. */
export interface MockLog {
  inat: string[];
  gbif: string[];
  wikimedia: { url: string; apiUserAgent: string | undefined }[];
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

export function taxon(id: number) {
  return {
    id,
    name: `Filix specimen${id}`,
    rank: 'species',
    preferred_common_name: `Helecho ${id}`,
    default_photo: {
      url: `https://static.inaturalist.org/photos/${id}/square.jpg`,
      medium_url: `https://static.inaturalist.org/photos/${id}/medium.jpg`,
      attribution: `(c) Ana Botánica, algunos derechos reservados (CC BY)`,
      license_code: 'cc-by',
    },
    wikipedia_url: `https://en.wikipedia.org/wiki/Filix_specimen${id}`,
    observations_count: 100 + id,
    conservation_status: id === 2 ? { status: 'VU', authority: 'IUCN Red List' } : null,
    ancestors: [{ name: 'Plantae', rank: 'kingdom' }, { name: 'Polypodiopsida', rank: 'class' }],
  };
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });

/** Locales: 1-5 (1 y 2 nativas). Región amplia: 1-5 y 101-120. */
const LOCAL = [1, 2, 3, 4, 5];
const WIDE = [...LOCAL, ...Array.from({ length: 20 }, (_, i) => 101 + i)];

export async function mockApis(page: Page, opts: { inatStatus?: number; first429?: boolean } = {}): Promise<MockLog> {
  const log: MockLog = { inat: [], gbif: [], wikimedia: [] };
  let sent429 = false;
  let point = 0;

  await page.route('https://api.inaturalist.org/**', async (route) => {
    const url = new URL(route.request().url());
    log.inat.push(url.pathname + url.search);
    if (opts.inatStatus) return json(route, {}, opts.inatStatus);
    if (opts.first429 && !sent429) {
      sent429 = true;
      return route.fulfill({ status: 429, headers: { 'retry-after': '1', 'access-control-allow-origin': '*' }, body: '' });
    }
    const q = url.searchParams;
    if (url.pathname.startsWith('/v1/taxa/')) {
      const ids = url.pathname.split('/').pop()!.split(',').map(Number);
      return json(route, { total_results: ids.length, results: ids.map(taxon) });
    }
    if (url.pathname === '/v1/observations') {
      if (q.get('order') === 'desc' && !q.has('id_below')) return json(route, { total_results: 1, results: [{ id: 5000 }] });
      point++;
      return json(route, { total_results: 1, results: [{ location: `${40 + point * 0.5},${-4 + point}`, obscured: false }] });
    }
    if (url.pathname === '/v1/observations/species_counts') {
      const radius = Number(q.get('radius'));
      const ids = q.get('taxon_id')?.split(',').map(Number);
      let pool = radius > 75 ? WIDE : LOCAL;
      if (q.get('native') === 'true') pool = pool.filter((id) => id <= 2);
      if (ids) pool = pool.filter((id) => ids.includes(id) && LOCAL.includes(id));
      return json(route, { total_results: pool.length, results: pool.map((id) => ({ count: 6 - Math.min(id, 5), taxon: taxon(id) })) });
    }
    return json(route, { total_results: 0, results: [] });
  });

  await page.route('https://api.gbif.org/**', async (route) => {
    const url = new URL(route.request().url());
    log.gbif.push(url.pathname + url.search);
    const q = url.searchParams;
    if (url.pathname === '/v1/species/match') {
      const name = q.get('name') ?? '';
      const id = Number(name.match(/(\d+)$/)?.[1] ?? 9);
      return json(route, { usageKey: 1000 + id, speciesKey: 1000 + id, matchType: 'EXACT' });
    }
    if (url.pathname === '/v1/occurrence/search') {
      if (q.get('limit') === '0') return json(route, { count: 120, results: [] });
      if (q.has('offset')) return json(route, { count: 120, results: [{ decimalLatitude: 42.1, decimalLongitude: -3.2, continent: 'EUROPE', country: 'España' }] });
      const keys = q.getAll('taxonKey').map(Number);
      // Las especies 1 y 2 y la primera clave consultada tienen registros en el círculo.
      const present = keys.filter((k, i) => i === 0 || k - 1000 <= 2);
      return json(route, {
        count: present.length * 3,
        facets: [{ field: 'SPECIES_KEY', counts: present.map((k) => ({ name: String(k), count: 3 })) }],
        results: present.flatMap((k) => [0, 1, 2].map((i) => ({ speciesKey: k, decimalLatitude: 40.6 + i * 0.1, decimalLongitude: -3.4 + i * 0.1, continent: 'EUROPE', country: 'España' }))),
      });
    }
    return json(route, {});
  });

  const wm = async (route: Route) => {
    const req = route.request();
    log.wikimedia.push({ url: req.url(), apiUserAgent: req.headers()['api-user-agent'] });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'api-user-agent' } });
    if (req.url().includes('/w/api.php') && req.url().includes('prop=pageviews')) {
      const titles = (new URL(req.url()).searchParams.get('titles') ?? '').split('|');
      return json(route, {
        query: {
          normalized: titles.map((t) => ({ from: t, to: t.replace(/_/g, ' ') })),
          pages: titles.map((t) => {
            const id = Number(t.match(/specimen(\d+)/)?.[1] ?? 1);
            return { title: t.replace(/_/g, ' '), pageviews: { '2026-10-01': id * 10, '2026-10-02': id * 10 } };
          }),
        },
      });
    }
    if (req.url().includes('/pageviews/')) {
      const id = Number(req.url().match(/specimen(\d+)/)?.[1] ?? 1);
      return json(route, { items: Array.from({ length: 12 }, () => ({ views: id * 400 })) });
    }
    if (req.url().includes('/page/summary/')) {
      return json(route, { extract: 'Helecho de sotobosque húmedo, citado en la zona desde antiguo.', content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Filix' } } });
    }
    return json(route, {}, 404);
  };
  await page.route('https://wikimedia.org/**', wm);
  await page.route('https://*.wikipedia.org/**', wm);
  await page.route('https://static.inaturalist.org/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route('https://server.arcgisonline.com/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  return log;
}

export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}
