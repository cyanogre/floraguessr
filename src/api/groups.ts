import type { SpecimenShape } from '../game/types';

/**
 * Nombre del taxón ancestro → [grupo legible, silueta]. Se busca del más concreto al más general.
 * Coincide con los grupos del modo Equilibrado.
 */
export const GROUPS: Record<string, [string, SpecimenShape]> = {
  Orchidaceae: ['Orquídeas', 'orchid'],
  Poaceae: ['Gramíneas', 'grass'],
  Arecaceae: ['Palmeras', 'palm'],
  Cactaceae: ['Cactus', 'cactus'],
  Crassulaceae: ['Crasuláceas', 'succulent'],
  Fabaceae: ['Leguminosas', 'leaf'],
  Asteraceae: ['Asteráceas', 'flower'],
  Rosaceae: ['Rosáceas', 'flower'],
  Lamiaceae: ['Labiadas', 'leaf'],
  Ericaceae: ['Ericáceas', 'flower'],
  Proteaceae: ['Proteáceas', 'flower'],
  Myrtaceae: ['Mirtáceas', 'leaf'],
  Droseraceae: ['Droseráceas', 'pitcher'],
  Sarraceniaceae: ['Sarraceniáceas', 'pitcher'],
  Nepenthaceae: ['Nepentáceas', 'pitcher'],
  Nymphaeaceae: ['Ninfeáceas', 'lily'],
  Amaryllidaceae: ['Amarilidáceas', 'lily'],
  Lauraceae: ['Lauráceas', 'leaf'],
  Dipterocarpaceae: ['Dipterocarpáceas', 'leaf'],
  Ranunculaceae: ['Ranunculáceas', 'flower'],
  Brassicaceae: ['Crucíferas', 'flower'],
  Cucurbitaceae: ['Cucurbitáceas', 'leaf'],
  Euphorbiaceae: ['Euforbiáceas', 'leaf'],
  Araceae: ['Aráceas', 'leaf'],
  Bromeliaceae: ['Bromeliáceas', 'succulent'],
  Malvaceae: ['Malváceas', 'flower'],
  Fagales: ['Fagales', 'leaf'],
  Pinopsida: ['Coníferas', 'conifer'],
  Cycadopsida: ['Cícadas', 'palm'],
  Gnetopsida: ['Gnetófitos', 'leaf'],
  Ginkgoopsida: ['Ginkgo', 'leaf'],
  Polypodiopsida: ['Helechos', 'fern'],
  Lycopodiopsida: ['Licófitos', 'fern'],
  Bryophyta: ['Musgos', 'moss'],
  Marchantiophyta: ['Hepáticas', 'moss'],
  Anthocerotophyta: ['Antocerotas', 'moss'],
  Liliopsida: ['Monocotiledóneas', 'grass'],
  Magnoliopsida: ['Dicotiledóneas', 'leaf'],
};

/** Recibe los nombres de ancestros (de general a concreto) y devuelve el grupo más específico. */
export function groupFromAncestors(names: string[]): [string, SpecimenShape] {
  for (let i = names.length - 1; i >= 0; i--) {
    const g = GROUPS[names[i]];
    if (g) return g;
  }
  return ['Plantas', 'leaf'];
}

export function shapeForGroup(group: string): SpecimenShape {
  for (const [label, shape] of Object.values(GROUPS)) if (label === group) return shape;
  return 'leaf';
}
