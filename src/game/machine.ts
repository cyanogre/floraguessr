import { REROLLS, ROUNDS, type Difficulty } from '../config';
import { tierFor, type Tier } from './rarity';
import { isPresent, scoreRound, type ScoreBreakdown } from './scoring';
import { shuffle, type Rng } from './random';
import type { Round } from './types';

export type Mode = 'mundial' | 'equilibrado';
export type Phase = 'menu' | 'loading' | 'choosing' | 'revealed' | 'finished' | 'error';

export interface RoundResult {
  round: Round;
  pickedId: number | null;
  correct: boolean;
  surrendered: boolean;
  usedHint: boolean;
  score: ScoreBreakdown;
}

export interface GameState {
  phase: Phase;
  mode: Mode;
  difficulty: Difficulty;
  /** Ronda actual, 1…ROUNDS. */
  roundNo: number;
  score: number;
  rerolls: number;
  round: Round | null;
  selectedId: number | null;
  hintUsed: boolean;
  /** Cartas tachadas por la pista. */
  struck: number[];
  result: RoundResult | null;
  history: RoundResult[];
  error: 'network' | 'noPlace' | null;
}

export type GameEvent =
  | { type: 'start'; mode: Mode; difficulty: Difficulty }
  | { type: 'loaded'; round: Round }
  | { type: 'failed'; reason: 'network' | 'noPlace' }
  | { type: 'retry' }
  | { type: 'select'; id: number }
  | { type: 'confirm' }
  | { type: 'surrender' }
  | { type: 'hint'; rng: Rng }
  | { type: 'reroll' }
  | { type: 'next' }
  | { type: 'menu' };

export function initialState(): GameState {
  return {
    phase: 'menu', mode: 'mundial', difficulty: 'normal', roundNo: 0, score: 0, rerolls: 0,
    round: null, selectedId: null, hintUsed: false, struck: [], result: null, history: [], error: null,
  };
}

const freshRound = (s: GameState): GameState => ({
  ...s, phase: 'loading', round: null, selectedId: null, hintUsed: false, struck: [], result: null, error: null,
});

/** Dos cartas que no viven en el círculo, para tachar con la pista. */
export function hintStrikes(round: Round, rng: Rng): number[] {
  const absent = round.cards.filter((c) => !isPresent(round.evidence[c.taxonId])).map((c) => c.taxonId);
  return shuffle(absent, rng).slice(0, 2);
}

export function reduce(s: GameState, e: GameEvent, tiers: Tier[]): GameState {
  switch (e.type) {
    case 'start':
      return freshRound({ ...initialState(), mode: e.mode, difficulty: e.difficulty, roundNo: 1, rerolls: REROLLS, history: [] });
    case 'loaded':
      return s.phase === 'loading' ? { ...s, phase: 'choosing', round: e.round } : s;
    case 'failed':
      return s.phase === 'loading' ? { ...s, phase: 'error', error: e.reason } : s;
    case 'retry':
      return s.phase === 'error' ? freshRound(s) : s;
    case 'select': {
      if (s.phase !== 'choosing' || !s.round?.cards.some((c) => c.taxonId === e.id) || s.struck.includes(e.id)) return s;
      return { ...s, selectedId: e.id };
    }
    case 'confirm':
    case 'surrender': {
      if (s.phase !== 'choosing' || !s.round) return s;
      const surrendered = e.type === 'surrender';
      if (!surrendered && s.selectedId == null) return s;
      const pickedId = surrendered ? null : s.selectedId;
      const card = s.round.cards.find((c) => c.taxonId === (pickedId ?? s.round!.answerId))!;
      const ev = s.round.evidence[card.taxonId];
      const correct = !surrendered && isPresent(ev);
      const score = scoreRound({ correct, tier: tierFor(card.views, tiers), native: Boolean(ev?.native), usedHint: s.hintUsed });
      const result: RoundResult = { round: s.round, pickedId, correct, surrendered, usedHint: s.hintUsed, score };
      return { ...s, phase: 'revealed', result, score: s.score + score.points, history: [...s.history, result] };
    }
    case 'hint': {
      if (s.phase !== 'choosing' || !s.round || s.hintUsed) return s;
      const struck = hintStrikes(s.round, e.rng);
      return { ...s, hintUsed: true, struck, selectedId: struck.includes(s.selectedId ?? -1) ? null : s.selectedId };
    }
    case 'reroll':
      return s.phase === 'choosing' && s.rerolls > 0 ? freshRound({ ...s, rerolls: s.rerolls - 1 }) : s;
    case 'next':
      if (s.phase !== 'revealed') return s;
      return s.roundNo >= ROUNDS ? { ...s, phase: 'finished' } : freshRound({ ...s, roundNo: s.roundNo + 1 });
    case 'menu':
      return { ...initialState(), mode: s.mode, difficulty: s.difficulty };
  }
}
