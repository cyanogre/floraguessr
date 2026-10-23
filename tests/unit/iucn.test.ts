import { describe, expect, it } from 'vitest';
import { normalizeIucn } from '../../src/game/iucn';

describe('normalizeIucn', () => {
  it.each([
    ['EN', undefined, 'EN'], ['vu', undefined, 'VU'], ['EN PELIGRO CRÍTICO', undefined, 'CR'], ['VULNERABLE', undefined, 'VU'],
    ['G3', undefined, null], ['G2G3', undefined, null], ['', undefined, null], ['EN', 'NatureServe', null], ['NT', 'IUCN Red List', 'NT'],
  ])('%s (%s) → %s', (s, a, out) => expect(normalizeIucn(s, a)).toBe(out));
});
