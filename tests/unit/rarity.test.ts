import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, thresholdsFromViews, tierFor, tiersFrom } from '../../src/game/rarity';

describe('tiers', () => {
  const tiers = tiersFrom(DEFAULT_THRESHOLDS);
  it('menos visitas = más rara', () => {
    expect(tierFor(500_000, tiers).id).toBe('comun');
    expect(tierFor(150_000, tiers).id).toBe('pocoComun');
    expect(tierFor(50_000, tiers).id).toBe('rara');
    expect(tierFor(20_000, tiers).id).toBe('epica');
    expect(tierFor(10, tiers).id).toBe('legendaria');
  });
  it('los límites son inclusivos', () => expect(tierFor(300_000, tiers).id).toBe('comun'));
  it('sin dato de visitas cuenta como común', () => expect(tierFor(null, tiers).id).toBe('comun'));
});

describe('thresholdsFromViews', () => {
  const views = Array.from({ length: 1000 }, (_, i) => (i + 1) * 10); // 10 … 10 000
  const th = thresholdsFromViews(views);
  const tiers = tiersFrom(th);
  const share = (id: string) => views.filter((v) => tierFor(v, tiers).id === id).length / views.length;

  it('reparte según los porcentajes objetivo', () => {
    expect(share('comun')).toBeCloseTo(0.5, 2);
    expect(share('pocoComun')).toBeCloseTo(0.25, 2);
    expect(share('rara')).toBeCloseTo(0.15, 2);
    expect(share('epica')).toBeCloseTo(0.07, 2);
    expect(share('legendaria')).toBeCloseTo(0.03, 2);
  });
  it('umbrales estrictamente decrecientes', () => {
    expect(th.comun).toBeGreaterThan(th.pocoComun);
    expect(th.pocoComun).toBeGreaterThan(th.rara);
    expect(th.rara).toBeGreaterThan(th.epica);
    expect(th.legendaria).toBe(0);
  });
  it('con pocos datos usa los umbrales por defecto', () => expect(thresholdsFromViews([1, 2, 3])).toEqual(DEFAULT_THRESHOLDS));
  it('soporta empates masivos', () => {
    const t = thresholdsFromViews(Array(100).fill(50));
    expect(t.comun).toBeGreaterThan(t.pocoComun);
    expect(t.epica).toBeGreaterThanOrEqual(0);
  });
});
