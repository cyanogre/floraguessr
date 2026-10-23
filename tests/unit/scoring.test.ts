import { describe, expect, it } from 'vitest';
import { isPresent, scoreRound } from '../../src/game/scoring';
import { tiersFrom, DEFAULT_THRESHOLDS } from '../../src/game/rarity';
import { ev } from './fixtures';

const tiers = tiersFrom(DEFAULT_THRESHOLDS);
const tier = (id: string) => tiers.find((t) => t.id === id)!;

describe('isPresent', () => {
  it('acepta una observación de grado investigación', () => expect(isPresent(ev(1))).toBe(true));
  it('acepta dos registros de GBIF sin iNaturalist', () => expect(isPresent(ev(0, 2))).toBe(true));
  it('rechaza un único registro de GBIF', () => expect(isPresent(ev(0, 1))).toBe(false));
  it('rechaza sin pruebas', () => expect(isPresent(undefined)).toBe(false));
});

describe('scoreRound', () => {
  it('fallo vale 0', () => {
    expect(scoreRound({ correct: false, tier: tier('legendaria'), native: true, usedHint: false }).points).toBe(0);
  });
  it('común sin extras = 100', () => {
    expect(scoreRound({ correct: true, tier: tier('comun'), native: false, usedHint: false }).points).toBe(100);
  });
  it('multiplica rareza, nativa y pista', () => {
    const r = scoreRound({ correct: true, tier: tier('epica'), native: true, usedHint: true });
    expect(r.points).toBe(Math.round(100 * 4 * 1.25 * 0.7));
    expect(r.factors.map((f) => f.key)).toEqual(['base', 'rarity', 'native', 'hint']);
  });
  it('legendaria nativa = 875', () => {
    expect(scoreRound({ correct: true, tier: tier('legendaria'), native: true, usedHint: false }).points).toBe(875);
  });
});
