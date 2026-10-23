import { HINT_FACTOR, MIN_GBIF_RECORDS, MIN_INAT_RESEARCH, NATIVE_BONUS, SCORE_BASE } from '../config';
import type { Evidence } from './types';
import type { Tier } from './rarity';

export function isPresent(e: Evidence | undefined): boolean {
  if (!e) return false;
  return e.inat >= MIN_INAT_RESEARCH || e.gbif >= MIN_GBIF_RECORDS;
}

export interface ScoreInput {
  correct: boolean;
  tier: Tier;
  native: boolean;
  usedHint: boolean;
}

export interface ScoreBreakdown {
  points: number;
  factors: { key: 'base' | 'rarity' | 'native' | 'hint'; value: number }[];
}

export function scoreRound({ correct, tier, native, usedHint }: ScoreInput): ScoreBreakdown {
  if (!correct) return { points: 0, factors: [] };
  const factors: ScoreBreakdown['factors'] = [
    { key: 'base', value: SCORE_BASE },
    { key: 'rarity', value: tier.mult },
  ];
  if (native) factors.push({ key: 'native', value: NATIVE_BONUS });
  if (usedHint) factors.push({ key: 'hint', value: HINT_FACTOR });
  const points = Math.round(factors.reduce((p, f) => p * f.value, 1));
  return { points, factors };
}
