import { describe, expect, it } from 'vitest';
import { lastYearRange } from '../../src/api/wikipedia';
import { wikiTitleFrom, photoFrom } from '../../src/api/inat';

describe('lastYearRange', () => {
  it('12 meses completos acabando el mes anterior', () => {
    expect(lastYearRange(new Date(Date.UTC(2026, 9, 23)))).toEqual(['2025100100', '2026090100']);
    expect(lastYearRange(new Date(Date.UTC(2026, 0, 5)))).toEqual(['2025010100', '2025120100']);
  });
});

describe('iNaturalist helpers', () => {
  it('extrae el título de Wikipedia', () => {
    expect(wikiTitleFrom('http://en.wikipedia.org/wiki/Quercus_robur')).toBe('Quercus_robur');
    expect(wikiTitleFrom('https://en.wikipedia.org/wiki/Jack_pine#Range')).toBe('Jack_pine');
    expect(wikiTitleFrom(null)).toBeUndefined();
  });
  it('foto sin licencia = todos los derechos reservados', () => {
    expect(photoFrom({ url: 'https://a/square.jpg', attribution: '(c) X', license_code: null })).toEqual({
      url: 'https://a/medium.jpg', attribution: '(c) X', license: 'all-rights-reserved',
    });
    expect(photoFrom(null)).toBeNull();
  });
});
