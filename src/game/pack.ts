import { PACK_SIZE } from '../config';
import { isPresent } from './scoring';
import { shuffle, type Rng } from './random';
import type { Evidence, Species } from './types';

/** Fila de un recuento de especies en una zona (forma reducida de species_counts). */
export interface ZoneCount {
  species: Species;
  count: number;
}

export const MIN_DECOYS = 3;
const GOOD_PER_PACK = 2;
const DECOY_CANDIDATES = 16;

/** Una carta solo es jugable si tiene foto con licencia abierta o, al menos, nombre y artículo. */
export function isPlayable(s: Species): boolean {
  return Boolean(s.wikiTitle) && (s.photo == null || s.photo.license !== 'all-rights-reserved');
}

/** Elige las cartas válidas: preferimos nativas; si no hay, cualquiera con registros. */
export function pickGood(local: ZoneCount[], nativeIds: Set<number>, rng: Rng): ZoneCount[] {
  const usable = local.filter((r) => isPlayable(r.species) && r.species.photo);
  const native = usable.filter((r) => nativeIds.has(r.species.taxonId));
  return shuffle(native.length ? native : usable, rng).slice(0, GOOD_PER_PACK);
}

/** Candidatas a señuelo: viven en la región amplia pero no aparecen en el recuento local. */
export function pickDecoyCandidates(local: ZoneCount[], wide: ZoneCount[], rng: Rng): Species[] {
  const localIds = new Set(local.map((r) => r.species.taxonId));
  const seen = new Set<number>();
  const out: Species[] = [];
  for (const r of shuffle(wide, rng)) {
    const id = r.species.taxonId;
    if (localIds.has(id) || seen.has(id) || !isPlayable(r.species) || !r.species.photo) continue;
    seen.add(id);
    out.push(r.species);
    if (out.length >= DECOY_CANDIDATES) break;
  }
  return out;
}

/**
 * Junta válidas y señuelos ya verificados (`presentIds` son candidatas que sí resultaron estar en el
 * círculo y por tanto no pueden ser señuelo). Devuelve null si no hay sobre jugable.
 */
export function assemblePack(
  good: Species[],
  candidates: Species[],
  presentIds: Set<number>,
  rng: Rng,
  size = PACK_SIZE,
): Species[] | null {
  if (!good.length) return null;
  const decoys = candidates.filter((s) => !presentIds.has(s.taxonId)).slice(0, size - good.length);
  if (decoys.length < MIN_DECOYS || good.length + decoys.length < size - 1) return null;
  return shuffle([...good, ...decoys], rng);
}

/** Modo Equilibrado: una especie por grupo botánico para que el sobre sea variado. */
export function pickBalanced(pool: Species[], rng: Rng, size = PACK_SIZE): Species[] {
  const byGroup = new Map<string, Species[]>();
  for (const s of pool) {
    const list = byGroup.get(s.group) ?? [];
    list.push(s);
    byGroup.set(s.group, list);
  }
  const groups = shuffle([...byGroup.keys()], rng);
  const out: Species[] = [];
  for (const g of groups) {
    if (out.length >= size) break;
    const list = byGroup.get(g)!;
    out.push(list[Math.floor(rng() * list.length)]);
  }
  return out;
}

/** La respuesta «oficial»: la válida con más pruebas; desempata la nativa. */
export function chooseAnswer(cards: Species[], evidence: Record<number, Evidence>): number | null {
  const valid = cards.filter((c) => isPresent(evidence[c.taxonId]));
  if (!valid.length) return null;
  valid.sort((a, b) => {
    const ea = evidence[a.taxonId];
    const eb = evidence[b.taxonId];
    return Number(eb.native) - Number(ea.native) || eb.inat + eb.gbif - (ea.inat + ea.gbif);
  });
  return valid[0].taxonId;
}

export function emptyEvidence(): Evidence {
  return { inat: 0, gbif: 0, native: false, points: [] };
}
