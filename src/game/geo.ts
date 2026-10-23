import type { Continent } from './types';

const KM_PER_DEG = 111.32;

/** Polígono WKT (sentido antihorario, cerrado) que aproxima un círculo de `radiusKm` para GBIF. */
export function circleWkt(lat: number, lng: number, radiusKm: number, segments = 24): string {
  const pts: string[] = [];
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= segments; i++) {
    const a = (2 * Math.PI * (i % segments)) / segments;
    const x = lng + (radiusKm / (KM_PER_DEG * cosLat)) * Math.cos(a);
    const y = lat + (radiusKm / KM_PER_DEG) * Math.sin(a);
    pts.push(`${x.toFixed(4)} ${y.toFixed(4)}`);
  }
  return `POLYGON((${pts.join(',')}))`;
}

/** Distancia ortodrómica en km. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Continente aproximado por coordenadas, cuando GBIF no lo indica. */
export function continentFor(lat: number, lng: number): Continent {
  if (lat < -60) return 'ANTARCTICA';
  if (lng < -25) return lat > 12 || (lat > 7 && lng < -77) ? 'NORTH_AMERICA' : 'SOUTH_AMERICA';
  if ((lng > 110 && lat < -10) || lng > 150 || (lng > 130 && lat < 0)) return 'OCEANIA';
  if (lat > 35 && lng < 40 && !(lat < 42 && lng > 26)) return 'EUROPE';
  if (lat > 45 && lng < 60) return 'EUROPE';
  if (lat <= 37 && lng < 52 && !(lng > 34 && lat > 12)) return 'AFRICA';
  if (lat < 12 && lng > 34 && lng < 52 && lat > -35) return 'AFRICA';
  return 'ASIA';
}

const GBIF_CONTINENTS: Record<string, Continent> = {
  EUROPE: 'EUROPE', AFRICA: 'AFRICA', NORTH_AMERICA: 'NORTH_AMERICA', SOUTH_AMERICA: 'SOUTH_AMERICA',
  OCEANIA: 'OCEANIA', ASIA: 'ASIA', ANTARCTICA: 'ANTARCTICA',
};

export function normalizeContinent(v: unknown): Continent | null {
  return typeof v === 'string' && v in GBIF_CONTINENTS ? GBIF_CONTINENTS[v] : null;
}
