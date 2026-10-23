import type { Continent } from '../game/types';

export interface Scale {
  id: string;
  /** Intervalos en semitonos desde la tónica. */
  intervals: number[];
  /** Nota MIDI de la tónica. */
  root: number;
  /** Bordón grave sostenido. */
  drone: boolean;
}

const S = (id: string, intervals: number[], root: number, drone = false): Scale => ({ id, intervals, root, drone });

/**
 * Escala según continente (y, en Asia, por subregión). Son generalizaciones de la etnomusicología:
 * la música real de cada lugar es mucho más variada.
 */
export function scaleFor(continent: Continent, lat: number, lng: number): Scale {
  switch (continent) {
    case 'EUROPE': return S('dorian', [0, 2, 3, 5, 7, 9, 10], 50);
    case 'AFRICA': return S('egyptian', [0, 2, 5, 7, 10], 52);
    case 'NORTH_AMERICA': return S('blues', [0, 3, 5, 6, 7, 10], 55);
    case 'SOUTH_AMERICA': return S('andean', [0, 3, 5, 7, 10], 57);
    case 'OCEANIA': return S('majorPenta', [0, 2, 4, 7, 9], 52, true);
    case 'ANTARCTICA': return S('wholeTone', [0, 2, 4, 6, 8, 10], 50, true);
    case 'ASIA':
      if (lng < 60) return S('hijaz', [0, 1, 4, 5, 7, 8, 10], 50, true);
      if (lng < 95 && lat < 38) return S('yaman', [0, 2, 4, 6, 7, 9, 11], 50, true);
      if (lat < 22) return S('pelog', [0, 1, 3, 7, 8], 52);
      if (lng > 128) return S('hirajoshi', [0, 2, 3, 7, 8], 50);
      return S('gong', [0, 2, 4, 7, 9], 50);
  }
}

/** Nota MIDI del grado `degree` (puede ser negativo o pasar de octava). */
export function degreeToMidi(scale: Scale, degree: number): number {
  const n = scale.intervals.length;
  const idx = ((degree % n) + n) % n;
  return scale.root + scale.intervals[idx] + 12 * Math.floor(degree / n);
}

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
