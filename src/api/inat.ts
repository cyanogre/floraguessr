import { CACHE_DAYS } from '../config';
import { normalizeIucn } from '../game/iucn';
import type { Rng } from '../game/random';
import type { Species } from '../game/types';
import type { ZoneCount } from '../game/pack';
import { cache } from './cache';
import { getJson } from './http';
import { groupFromAncestors } from './groups';

export const INAT = 'https://api.inaturalist.org/v1/';

/** Filtros comunes: plantas, grado investigación, silvestres. */
const BASE = 'iconic_taxa=Plantae&quality_grade=research&captive=false';

interface InatPhoto {
  url?: string;
  medium_url?: string;
  attribution?: string;
  license_code?: string | null;
}
export interface InatTaxon {
  id: number;
  name: string;
  rank: string;
  preferred_common_name?: string;
  english_common_name?: string;
  default_photo?: InatPhoto | null;
  wikipedia_url?: string | null;
  observations_count?: number;
  conservation_status?: { status?: string; authority?: string } | null;
  ancestors?: { name: string; rank: string }[];
}
interface Paged<T> {
  total_results: number;
  results: T[];
}

const opts = (signal?: AbortSignal) => ({ service: 'inat' as const, signal });

export function photoFrom(p: InatPhoto | null | undefined): Species['photo'] {
  const raw = p?.medium_url ?? p?.url?.replace('/square.', '/medium.');
  if (!raw) return null;
  return {
    url: raw,
    attribution: p?.attribution ?? '',
    license: p?.license_code ? p.license_code : 'all-rights-reserved',
  };
}

export function wikiTitleFrom(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const t = decodeURIComponent(url.split('/wiki/')[1] ?? '').split('#')[0];
  return t || undefined;
}

export function speciesFromTaxon(t: InatTaxon): Species {
  const [group, shape] = groupFromAncestors((t.ancestors ?? []).map((a) => a.name));
  return {
    taxonId: t.id,
    sci: t.name,
    group,
    shape,
    name: t.preferred_common_name || t.english_common_name || '',
    photo: photoFrom(t.default_photo),
    views: null,
    observations: t.observations_count ?? 0,
    iucn: normalizeIucn(t.conservation_status?.status, t.conservation_status?.authority),
    wikiTitle: wikiTitleFrom(t.wikipedia_url),
  };
}

/** Recuento de especies de planta en un círculo. `extra` añade filtros (native, taxon_id…). */
export async function speciesCounts(
  lat: number,
  lng: number,
  radiusKm: number,
  extra: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<ZoneCount[]> {
  const q = new URLSearchParams({ lat: lat.toFixed(4), lng: lng.toFixed(4), radius: String(radiusKm), per_page: '200', ...extra });
  const url = `${INAT}observations/species_counts?${BASE}&${q}`;
  const key = `inat:sc:${q}`;
  const data = await cache.get(key, CACHE_DAYS.place, () =>
    getJson<Paged<{ count: number; taxon: InatTaxon }>>(url, opts(signal)),
  );
  return data.results
    .filter((r) => r.taxon?.rank === 'species')
    .map((r) => ({ count: r.count, species: speciesFromTaxon(r.taxon) }));
}

/** Detalle de hasta 30 taxones en una llamada: nombres locales, foto con licencia, ancestros. */
export async function taxaDetails(ids: number[], locale: string, signal?: AbortSignal): Promise<Map<number, Species>> {
  const out = new Map<number, Species>();
  const missing: number[] = [];
  for (const id of ids) {
    const hit = await cache.peek<Species>(`inat:taxon:${locale}:${id}`);
    if (hit) out.set(id, hit);
    else missing.push(id);
  }
  for (let i = 0; i < missing.length; i += 30) {
    const chunk = missing.slice(i, i + 30);
    const data = await getJson<Paged<InatTaxon>>(`${INAT}taxa/${chunk.join(',')}?locale=${locale}`, opts(signal));
    for (const t of data.results) {
      const s = speciesFromTaxon(t);
      out.set(t.id, s);
      await cache.put(`inat:taxon:${locale}:${t.id}`, CACHE_DAYS.taxon, s);
    }
  }
  return out;
}

/**
 * Observación de planta al azar. No usamos order_by=random (no está documentado): elegimos un id
 * aleatorio y pedimos la primera observación por encima, dentro de una región elegida al azar.
 */
export async function randomPlantPoint(rng: Rng, signal?: AbortSignal): Promise<{ lat: number; lng: number } | null> {
  const maxId = await cache.get('inat:maxId', 1, async () => {
    const d = await getJson<Paged<{ id: number }>>(`${INAT}observations?${BASE}&order_by=id&order=desc&per_page=1`, opts(signal));
    return d.results[0]?.id ?? 250_000_000;
  });
  const [swlat, swlng, nelat, nelng] = REGIONS[Math.floor(rng() * REGIONS.length)];
  const pivot = Math.floor(rng() * maxId);
  const box = `swlat=${swlat}&swlng=${swlng}&nelat=${nelat}&nelng=${nelng}`;
  const common = `${INAT}observations?${BASE}&${box}&acc_below=2000&geoprivacy=open&per_page=1`;
  type Obs = { location?: string; obscured?: boolean };
  let d = await getJson<Paged<Obs>>(`${common}&id_above=${pivot}&order_by=id&order=asc`, opts(signal));
  if (!d.results.length) d = await getJson<Paged<Obs>>(`${common}&id_below=${pivot}&order_by=id&order=desc`, opts(signal));
  const o = d.results[0];
  if (!o?.location || o.obscured) return null;
  const [lat, lng] = o.location.split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Regiones (swlat, swlng, nelat, nelng) con el mismo peso, para que no todo sea Norteamérica y Europa. */
export const REGIONS: [number, number, number, number][] = [
  [35, -11, 60, 30], // Europa
  [-35, -18, 15, 52], // África
  [15, -125, 50, -65], // Norteamérica
  [-5, -118, 33, -60], // Mesoamérica y Caribe
  [-56, -82, 5, -34], // Sudamérica
  [-45, 112, -10, 155], // Australia
  [-48, 165, -34, 179], // Nueva Zelanda
  [5, 60, 35, 98], // Asia meridional
  [-11, 95, 25, 141], // Sudeste asiático
  [20, 100, 46, 146], // Asia oriental
  [12, 26, 43, 63], // Oriente Próximo y Cáucaso
  [45, 30, 70, 179], // Siberia y Asia central
];
