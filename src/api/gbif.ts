import { CACHE_DAYS } from '../config';
import { circleWkt } from '../game/geo';
import type { Rng } from '../game/random';
import { cache } from './cache';
import { getJson } from './http';

export const GBIF = 'https://api.gbif.org/v1/';

/** Registros fiables: con coordenadas, sin problemas geoespaciales, presencia, observación o pliego. */
const FILTERS =
  'hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&basisOfRecord=HUMAN_OBSERVATION&basisOfRecord=PRESERVED_SPECIMEN';

const opts = (signal?: AbortSignal) => ({ service: 'gbif' as const, signal });

export async function matchSpecies(sci: string, signal?: AbortSignal): Promise<number | null> {
  return cache.get(`gbif:match:${sci}`, CACHE_DAYS.gbifMatch, async () => {
    const m = await getJson<{ usageKey?: number; speciesKey?: number; matchType?: string }>(
      `${GBIF}species/match?kingdom=Plantae&name=${encodeURIComponent(sci)}`,
      opts(signal),
    );
    if (!m.usageKey || m.matchType === 'NONE') return null;
    return m.speciesKey ?? m.usageKey;
  });
}

interface GbifOcc {
  decimalLatitude: number;
  decimalLongitude: number;
  speciesKey?: number;
  continent?: string;
  country?: string;
}
interface GbifSearch {
  count: number;
  results: GbifOcc[];
  facets?: { field: string; counts: { name: string; count: number }[] }[];
}

export interface ZoneRecords {
  counts: Map<number, number>;
  points: Map<number, [number, number][]>;
  continent?: string;
  country?: string;
}

/** Una sola llamada para todas las cartas: recuento por especie (faceta) y algunos puntos. */
export async function zoneRecords(keys: number[], lat: number, lng: number, radiusKm: number, signal?: AbortSignal): Promise<ZoneRecords> {
  const counts = new Map<number, number>();
  const points = new Map<number, [number, number][]>();
  if (!keys.length) return { counts, points };
  const tk = keys.map((k) => `taxonKey=${k}`).join('&');
  const url = `${GBIF}occurrence/search?${tk}&${FILTERS}&geometry=${encodeURIComponent(circleWkt(lat, lng, radiusKm))}&facet=speciesKey&facetLimit=${keys.length}&limit=150`;
  const d = await cache.get(`gbif:zone:${url}`, CACHE_DAYS.place, () => getJson<GbifSearch>(url, opts(signal)));
  for (const c of d.facets?.find((f) => f.field === 'SPECIES_KEY')?.counts ?? []) counts.set(Number(c.name), c.count);
  for (const r of d.results) {
    if (r.speciesKey == null) continue;
    const list = points.get(r.speciesKey) ?? [];
    if (list.length < 40) list.push([r.decimalLatitude, r.decimalLongitude]);
    points.set(r.speciesKey, list);
  }
  const first = d.results[0];
  return { counts, points, continent: first?.continent, country: first?.country };
}

/** Un registro fiable al azar de una especie, para situar la ronda en modo Equilibrado. */
export async function randomOccurrence(key: number, rng: Rng, signal?: AbortSignal): Promise<GbifOcc | null> {
  const base = `${GBIF}occurrence/search?taxonKey=${key}&${FILTERS}&coordinateUncertaintyInMeters=0,20000`;
  const n = await cache.get(`gbif:count:${key}`, CACHE_DAYS.place, async () => (await getJson<GbifSearch>(`${base}&limit=0`, opts(signal))).count);
  if (n < 3) return null;
  const offset = Math.floor(rng() * Math.min(n, 50_000));
  const d = await getJson<GbifSearch>(`${base}&limit=1&offset=${offset}`, opts(signal));
  const r = d.results[0];
  if (!r || Math.abs(r.decimalLatitude) > 78 || Math.abs(r.decimalLongitude) > 179) return null;
  return r;
}
