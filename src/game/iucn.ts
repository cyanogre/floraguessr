import type { Iucn } from './types';

const CODES: Iucn[] = ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX'];
const WORDS: Record<string, Iucn> = {
  'PREOCUPACION MENOR': 'LC', 'LEAST CONCERN': 'LC',
  'CASI AMENAZADA': 'NT', 'CASI AMENAZADO': 'NT', 'NEAR THREATENED': 'NT',
  VULNERABLE: 'VU',
  'EN PELIGRO': 'EN', ENDANGERED: 'EN',
  'EN PELIGRO CRITICO': 'CR', 'CRITICALLY ENDANGERED': 'CR',
  'EXTINTA EN ESTADO SILVESTRE': 'EW', 'EXTINCT IN THE WILD': 'EW',
  EXTINTA: 'EX', EXTINCT: 'EX',
};

/**
 * Deja solo estados de la Lista Roja de la UICN. Los rangos de NatureServe (G3, G2G3…) y otras
 * autoridades no son comparables y se descartan.
 */
export function normalizeIucn(status: unknown, authority?: unknown): Iucn | null {
  if (typeof status !== 'string' || !status.trim()) return null;
  if (typeof authority === 'string' && authority && !/iucn/i.test(authority)) return null;
  const s = status.trim().toUpperCase();
  if ((CODES as string[]).includes(s)) return s as Iucn;
  const plain = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return WORDS[plain] ?? null;
}
