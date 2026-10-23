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

import { parsePageviews } from '../../src/api/wikipedia';

describe('parsePageviews', () => {
  it('pasa la media diaria a visitas anuales y sigue redirecciones', () => {
    const r = parsePageviews(['Jack_pine', 'Quercus_robur', 'No_existe', 'Sin_datos'], {
      query: {
        normalized: [
          { from: 'Jack_pine', to: 'Jack pine' },
          { from: 'Quercus_robur', to: 'Quercus robur' },
          { from: 'No_existe', to: 'No existe' },
          { from: 'Sin_datos', to: 'Sin datos' },
        ],
        redirects: [{ from: 'Jack pine', to: 'Pinus banksiana' }],
        pages: [
          { title: 'Pinus banksiana', pageviews: { '2026-10-01': 100, '2026-10-02': 300, '2026-10-03': null } },
          { title: 'Quercus robur', pageviews: { '2026-10-01': 10 } },
          { title: 'No existe', missing: true },
          { title: 'Sin datos', pageviews: { '2026-10-01': null } },
        ],
      },
    });
    expect(r.get('Jack_pine')).toBe(200 * 365);
    expect(r.get('Quercus_robur')).toBe(3650);
    expect(r.get('No_existe')).toBeNull();
    expect(r.get('Sin_datos')).toBeNull();
  });
});
