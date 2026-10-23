import { describe, expect, it } from 'vitest';
import { initialState, reduce, type GameEvent, type GameState } from '../../src/game/machine';
import { DEFAULT_THRESHOLDS, tiersFrom } from '../../src/game/rarity';
import { seeded } from '../../src/game/random';
import { round } from './fixtures';

const tiers = tiersFrom(DEFAULT_THRESHOLDS);
const run = (events: GameEvent[], s: GameState = initialState()) => events.reduce((st, e) => reduce(st, e, tiers), s);
const start: GameEvent = { type: 'start', mode: 'mundial', difficulty: 'normal' };

describe('máquina de estados', () => {
  it('menú → cargando → eligiendo', () => {
    const s = run([start]);
    expect(s.phase).toBe('loading');
    expect(run([{ type: 'loaded', round: round() }], s).phase).toBe('choosing');
  });

  it('confirmar sin selección no hace nada', () => {
    const s = run([start, { type: 'loaded', round: round() }, { type: 'confirm' }]);
    expect(s.phase).toBe('choosing');
  });

  it('acierto con nativa suma rareza × 1,25', () => {
    const s = run([start, { type: 'loaded', round: round() }, { type: 'select', id: 1 }, { type: 'confirm' }]);
    expect(s.phase).toBe('revealed');
    expect(s.result!.correct).toBe(true);
    expect(s.score).toBe(Math.round(100 * 7 * 1.25)); // 1000 visitas → legendaria con umbrales por defecto
  });

  it('un único registro GBIF no basta', () => {
    const s = run([start, { type: 'loaded', round: round() }, { type: 'select', id: 4 }, { type: 'confirm' }]);
    expect(s.result!.correct).toBe(false);
    expect(s.score).toBe(0);
  });

  it('rendirse revela la respuesta y no puntúa', () => {
    const s = run([start, { type: 'loaded', round: round() }, { type: 'surrender' }]);
    expect(s.result).toMatchObject({ surrendered: true, pickedId: null, correct: false });
  });

  it('la pista tacha dos cartas ausentes y no se puede elegir una tachada', () => {
    let s = run([start, { type: 'loaded', round: round() }, { type: 'hint', rng: seeded(1) }]);
    expect(s.struck).toHaveLength(2);
    for (const id of s.struck) expect([3, 4, 5, 6]).toContain(id);
    s = run([{ type: 'select', id: s.struck[0] }], s);
    expect(s.selectedId).toBeNull();
    s = run([{ type: 'select', id: 1 }, { type: 'confirm' }], s);
    expect(s.score).toBe(Math.round(100 * 7 * 1.25 * 0.7));
  });

  it('relanzar gasta un uso y vuelve a cargar', () => {
    let s = run([start, { type: 'loaded', round: round() }, { type: 'reroll' }]);
    expect(s).toMatchObject({ phase: 'loading', rerolls: 1, roundNo: 1 });
    s = run([{ type: 'loaded', round: round() }, { type: 'reroll' }, { type: 'loaded', round: round() }, { type: 'reroll' }], s);
    expect(s.phase).toBe('choosing');
    expect(s.rerolls).toBe(0);
  });

  it('cinco rondas y fin', () => {
    let s = run([start]);
    for (let i = 0; i < 5; i++) s = run([{ type: 'loaded', round: round() }, { type: 'select', id: 2 }, { type: 'confirm' }, { type: 'next' }], s);
    expect(s.phase).toBe('finished');
    expect(s.history).toHaveLength(5);
  });

  it('error de red y reintento', () => {
    const s = run([start, { type: 'failed', reason: 'network' }]);
    expect(s).toMatchObject({ phase: 'error', error: 'network' });
    expect(run([{ type: 'retry' }], s).phase).toBe('loading');
  });

  it('una carga tardía tras volver al menú se ignora', () => {
    const s = run([start, { type: 'menu' }, { type: 'loaded', round: round() }]);
    expect(s.phase).toBe('menu');
  });
});
