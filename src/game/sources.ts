import { DIFFICULTY, PACK_SIZE, RADIUS_KM, type Difficulty } from '../config';
import * as gbif from '../api/gbif';
import * as inat from '../api/inat';
import * as wiki from '../api/wikipedia';
import { continentFor, normalizeContinent } from './geo';
import { assemblePack, chooseAnswer, emptyEvidence, pickBalanced, pickDecoyCandidates, pickGood } from './pack';
import type { Rng } from './random';
import type { Evidence, Place, Round, Species } from './types';

export interface RoundSource {
  next(signal: AbortSignal): Promise<Round>;
}

export class NoRoundError extends Error {
  constructor() {
    super('No se encontró un lugar jugable');
  }
}

const MAX_TRIES = 8;

/** Completa las cartas con nombre local, foto con licencia y visitas a Wikipedia. */
async function enrich(cards: Species[], locale: string, signal: AbortSignal): Promise<Species[]> {
  const details = await inat.taxaDetails(cards.map((c) => c.taxonId), locale, signal).catch(() => new Map<number, Species>());
  return Promise.all(
    cards.map(async (c) => {
      const d = details.get(c.taxonId);
      const merged: Species = d
        ? {
            ...c,
            ...d,
            // El grupo de la base manda (es el que equilibra el sobre); si no hay, el de iNaturalist.
            group: c.group && c.group !== 'Plantas' ? c.group : d.group,
            shape: c.group && c.group !== 'Plantas' ? c.shape ?? d.shape : d.shape,
            name: d.name || c.name,
            views: c.views ?? d.views,
            photo: d.photo ?? c.photo,
          }
        : c;
      if (merged.views == null && merged.wikiTitle) merged.views = await wiki.annualViews(merged.wikiTitle, signal).catch(() => null);
      return merged;
    }),
  );
}

/** Pruebas de iNaturalist (recuentos y nativas) y GBIF (una consulta) para un lugar y unas cartas. */
async function gatherEvidence(
  cards: Species[],
  place: { lat: number; lng: number },
  known: { inat?: Map<number, number>; native?: Set<number> },
  signal: AbortSignal,
): Promise<{ evidence: Record<number, Evidence>; continent?: string; country?: string }> {
  const ids = cards.map((c) => c.taxonId).join(',');
  const [inatCounts, nativeIds] = await Promise.all([
    known.inat ??
      inat.speciesCounts(place.lat, place.lng, RADIUS_KM, { taxon_id: ids }, signal).then((r) => new Map(r.map((x) => [x.species.taxonId, x.count]))),
    known.native ??
      inat.speciesCounts(place.lat, place.lng, RADIUS_KM, { taxon_id: ids, native: 'true' }, signal).then((r) => new Set(r.map((x) => x.species.taxonId))),
  ]);
  const keys = await Promise.all(cards.map((c) => (c.gbifKey ? Promise.resolve(c.gbifKey) : gbif.matchSpecies(c.sci, signal).catch(() => null))));
  const valid = keys.filter((k): k is number => k != null);
  const zone = await gbif.zoneRecords(valid, place.lat, place.lng, RADIUS_KM, signal).catch(() => null);
  const evidence: Record<number, Evidence> = {};
  cards.forEach((c, i) => {
    const k = keys[i];
    const e = emptyEvidence();
    e.inat = inatCounts.get(c.taxonId) ?? 0;
    e.native = nativeIds.has(c.taxonId);
    if (k != null && zone) {
      e.gbif = zone.counts.get(k) ?? 0;
      e.points = zone.points.get(k) ?? [];
    }
    evidence[c.taxonId] = e;
  });
  return { evidence, continent: zone?.continent, country: zone?.country };
}

function placeFrom(lat: number, lng: number, continent?: string, country?: string): Place {
  return { lat, lng, continent: normalizeContinent(continent) ?? continentFor(lat, lng), country };
}

/** Modo Mundial: sin listas. Lugar real, válidas del recuento local, señuelos de la región amplia. */
export class ZonalSource implements RoundSource {
  constructor(private difficulty: Difficulty, private rng: Rng, private locale = 'es') {}

  async next(signal: AbortSignal): Promise<Round> {
    const wideKm = DIFFICULTY[this.difficulty];
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      signal.throwIfAborted();
      try {
        const pt = await inat.randomPlantPoint(this.rng, signal);
        if (!pt || Math.abs(pt.lat) > 78) continue;
        const local = await inat.speciesCounts(pt.lat, pt.lng, RADIUS_KM, {}, signal);
        if (local.filter((r) => r.species.photo).length < 4) continue;
        const nativeRows = await inat.speciesCounts(pt.lat, pt.lng, RADIUS_KM, { native: 'true' }, signal).catch(() => []);
        const nativeIds = new Set(nativeRows.map((r) => r.species.taxonId));
        const good = pickGood(local, nativeIds, this.rng);
        const page = String(1 + Math.floor(this.rng() * 3));
        const wide = await inat.speciesCounts(pt.lat, pt.lng, wideKm, { page }, signal);
        const candidates = pickDecoyCandidates(local, wide, this.rng);
        if (candidates.length < 4) continue;
        // Una sola llamada confirma qué candidatas sí tienen registros en el círculo.
        const present = await inat.speciesCounts(pt.lat, pt.lng, RADIUS_KM, { taxon_id: candidates.map((c) => c.taxonId).join(',') }, signal);
        const presentIds = new Set(present.map((r) => r.species.taxonId));
        const cards = assemblePack(good.map((g) => g.species), candidates, presentIds, this.rng);
        if (!cards) continue;
        const inatCounts = new Map<number, number>([...local, ...present].map((r) => [r.species.taxonId, r.count]));
        const enriched = await enrich(cards, this.locale, signal);
        const { evidence, continent, country } = await gatherEvidence(enriched, pt, { inat: inatCounts, native: nativeIds }, signal);
        const answerId = chooseAnswer(enriched, evidence);
        if (answerId == null) continue;
        return { place: placeFrom(pt.lat, pt.lng, continent, country), cards: enriched, evidence, answerId };
      } catch (e) {
        if (signal.aborted) throw e;
      }
    }
    throw new NoRoundError();
  }
}

/** Modo Equilibrado: sobre de la base cerrada (un grupo por carta) y lugar real de una de ellas. */
export class BalancedSource implements RoundSource {
  constructor(private pool: Species[], private rng: Rng, private locale = 'es') {}

  async next(signal: AbortSignal): Promise<Round> {
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      signal.throwIfAborted();
      try {
        const pack = pickBalanced(this.pool, this.rng, PACK_SIZE);
        let occ: Awaited<ReturnType<typeof gbif.randomOccurrence>> = null;
        for (const c of pack) {
          const key = c.gbifKey ?? (await gbif.matchSpecies(c.sci, signal));
          if (!key) continue;
          c.gbifKey = key;
          occ = await gbif.randomOccurrence(key, this.rng, signal);
          if (occ) break;
        }
        if (!occ) continue;
        const pt = { lat: occ.decimalLatitude, lng: occ.decimalLongitude };
        const cards = await enrich(pack, this.locale, signal);
        const { evidence, continent, country } = await gatherEvidence(cards, pt, {}, signal);
        const answerId = chooseAnswer(cards, evidence);
        if (answerId == null) continue;
        return { place: placeFrom(pt.lat, pt.lng, continent ?? occ.continent, country ?? occ.country), cards, evidence, answerId };
      } catch (e) {
        if (signal.aborted) throw e;
      }
    }
    throw new NoRoundError();
  }
}

/**
 * Mantiene la siguiente ronda preparándose mientras se juega la actual.
 * `cancel()` aborta todo lo pendiente (al volver al menú).
 */
export class RoundPipeline {
  private ctrl = new AbortController();
  private ahead: Promise<Round> | null = null;

  constructor(private source: RoundSource) {}

  /** Ronda lista para jugar: la precargada si la hay, o una nueva. */
  take(): Promise<Round> {
    const p = this.ahead ?? this.source.next(this.ctrl.signal);
    this.ahead = null;
    return p;
  }

  prefetch(): void {
    if (this.ahead || this.ctrl.signal.aborted) return;
    const p = this.source.next(this.ctrl.signal);
    p.catch(() => undefined);
    this.ahead = p;
  }

  /** Descarta la precarga (p. ej. si falló) para que el próximo take() empiece de cero. */
  discard(): void {
    this.ahead = null;
  }

  cancel(): void {
    this.ctrl.abort();
    this.ahead = null;
  }

  get signal(): AbortSignal {
    return this.ctrl.signal;
  }
}
