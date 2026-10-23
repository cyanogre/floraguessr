import { describe, expect, it } from 'vitest';
import { assemblePack, chooseAnswer, pickBalanced, pickDecoyCandidates, pickGood, type ZoneCount } from '../../src/game/pack';
import { seeded } from '../../src/game/random';
import { ev, sp } from './fixtures';

const zc = (id: number, over = {}): ZoneCount => ({ species: sp(id, over), count: 3 });

describe('pickGood', () => {
  it('prefiere las nativas', () => {
    const local = [zc(1), zc(2), zc(3), zc(4)];
    const good = pickGood(local, new Set([3]), seeded(1));
    expect(good.map((g) => g.species.taxonId)).toEqual([3]);
  });
  it('sin nativas usa cualquiera con foto', () => {
    const local = [zc(1, { photo: null }), zc(2), zc(3)];
    const ids = pickGood(local, new Set(), seeded(2)).map((g) => g.species.taxonId);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain(1);
  });
  it('descarta fotos con todos los derechos reservados', () => {
    const local = [zc(1, { photo: { url: 'x', attribution: '', license: 'all-rights-reserved' } }), zc(2)];
    expect(pickGood(local, new Set(), seeded(3)).map((g) => g.species.taxonId)).toEqual([2]);
  });
});

describe('pickDecoyCandidates', () => {
  it('excluye las especies del recuento local y los duplicados', () => {
    const local = [zc(1), zc(2)];
    const wide = [zc(1), zc(3), zc(3), zc(4), zc(5, { wikiTitle: undefined })];
    const ids = pickDecoyCandidates(local, wide, seeded(4)).map((s) => s.taxonId).sort();
    expect(ids).toEqual([3, 4]);
  });
});

describe('assemblePack', () => {
  const good = [sp(1), sp(2)];
  const cands = [3, 4, 5, 6, 7, 8].map((i) => sp(i));
  it('monta 6 cartas sin señuelos presentes', () => {
    const pack = assemblePack(good, cands, new Set([3, 4]), seeded(5))!;
    expect(pack).toHaveLength(6);
    const ids = pack.map((c) => c.taxonId);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
    expect(ids).toEqual(expect.arrayContaining([1, 2, 5, 6, 7, 8]));
  });
  it('null si no quedan señuelos suficientes', () => {
    expect(assemblePack(good, cands, new Set([3, 4, 5, 6]), seeded(6))).toBeNull();
  });
  it('null sin válidas', () => expect(assemblePack([], cands, new Set(), seeded(7))).toBeNull());
});

describe('pickBalanced', () => {
  it('no repite grupo', () => {
    const pool = Array.from({ length: 60 }, (_, i) => sp(i, { group: `G${i % 10}` }));
    const pack = pickBalanced(pool, seeded(8));
    expect(pack).toHaveLength(6);
    expect(new Set(pack.map((p) => p.group)).size).toBe(6);
  });
});

describe('chooseAnswer', () => {
  it('elige la válida nativa con más pruebas', () => {
    const cards = [sp(1), sp(2), sp(3)];
    expect(chooseAnswer(cards, { 1: ev(9), 2: ev(1, 0, true), 3: ev(0) })).toBe(2);
  });
  it('null si ninguna vive allí', () => expect(chooseAnswer([sp(1)], { 1: ev(0, 1) })).toBeNull());
});
