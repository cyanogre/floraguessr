export type TierId = 'comun' | 'pocoComun' | 'rara' | 'epica' | 'legendaria';

export interface Tier {
  id: TierId;
  /** Visitas anuales mínimas para pertenecer al tier (de más a menos). */
  min: number;
  mult: number;
}

/** Proporción de especies que cae en cada tier, de común a legendaria. */
export const TIER_SHARE: Record<TierId, number> = {
  comun: 0.5,
  pocoComun: 0.25,
  rara: 0.15,
  epica: 0.07,
  legendaria: 0.03,
};

const MULT: Record<TierId, number> = { comun: 1, pocoComun: 1.5, rara: 2.5, epica: 4, legendaria: 7 };
const ORDER: TierId[] = ['comun', 'pocoComun', 'rara', 'epica', 'legendaria'];

/** Umbrales de respaldo (los del prototipo) por si no hay base calibrada. */
export const DEFAULT_THRESHOLDS: Record<TierId, number> = {
  comun: 300_000,
  pocoComun: 100_000,
  rara: 40_000,
  epica: 15_000,
  legendaria: 0,
};

/**
 * Calcula umbrales por percentiles: el 50 % más visitado es común, el 3 % menos visitado legendario.
 * Menos visitas = más rara.
 */
export function thresholdsFromViews(views: number[]): Record<TierId, number> {
  const v = views.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => b - a);
  if (v.length < 20) return { ...DEFAULT_THRESHOLDS };
  const at = (share: number) => v[Math.min(v.length - 1, Math.floor(share * v.length))];
  let acc = 0;
  const out = {} as Record<TierId, number>;
  for (const id of ORDER) {
    acc += TIER_SHARE[id];
    out[id] = id === 'legendaria' ? 0 : at(acc - 1e-9);
  }
  // Garantiza orden estrictamente decreciente aunque haya empates.
  for (let i = 1; i < ORDER.length - 1; i++) {
    if (out[ORDER[i]] >= out[ORDER[i - 1]]) out[ORDER[i]] = Math.max(0, out[ORDER[i - 1]] - 1);
  }
  return out;
}

export function tiersFrom(thresholds: Record<TierId, number>): Tier[] {
  return ORDER.map((id) => ({ id, min: thresholds[id], mult: MULT[id] }));
}

/** Sin dato de visitas → común: no premiamos lo que no podemos medir. */
export function tierFor(views: number | null, tiers: Tier[]): Tier {
  if (views == null) return tiers[0];
  return tiers.find((t) => views >= t.min) ?? tiers[tiers.length - 1];
}
