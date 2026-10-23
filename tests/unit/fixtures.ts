import type { Evidence, Round, Species } from '../../src/game/types';

export function sp(id: number, over: Partial<Species> = {}): Species {
  return {
    taxonId: id, sci: `Genus sp${id}`, group: 'Helechos', name: `Planta ${id}`,
    photo: { url: `https://example.org/${id}.jpg`, attribution: '(c) A', license: 'cc-by' },
    views: 1000, observations: 10, iucn: null, wikiTitle: `Genus_sp${id}`, ...over,
  };
}

export function ev(inat: number, gbif = 0, native = false): Evidence {
  return { inat, gbif, native, points: [] };
}

/** Sobre de 6: las cartas 1 y 2 viven en el círculo (la 1 nativa), 3-6 no. */
export function round(): Round {
  const cards = [1, 2, 3, 4, 5, 6].map((i) => sp(i));
  return {
    place: { lat: 40, lng: -4, continent: 'EUROPE' },
    cards,
    evidence: { 1: ev(5, 2, true), 2: ev(0, 3), 3: ev(0), 4: ev(0, 1), 5: ev(0), 6: ev(0) },
    answerId: 1,
  };
}
