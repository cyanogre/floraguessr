import { describe, expect, it } from 'vitest';
import { circleWkt, continentFor, haversineKm } from '../../src/game/geo';

function parse(wkt: string): [number, number][] {
  const inner = wkt.match(/^POLYGON\(\((.*)\)\)$/)![1];
  return inner.split(',').map((p) => p.split(' ').map(Number) as [number, number]);
}

describe('circleWkt', () => {
  it('es un polígono cerrado de n+1 vértices en orden lon lat', () => {
    const pts = parse(circleWkt(40, -4, 75, 24));
    expect(pts).toHaveLength(25);
    expect(pts[0]).toEqual(pts[24]);
    expect(pts[0][0]).toBeGreaterThan(-4); // primer punto al este: longitud primero
  });
  it('todos los vértices quedan a ~75 km del centro', () => {
    for (const [lng, lat] of parse(circleWkt(60, 25, 75))) {
      expect(haversineKm([60, 25], [lat, lng])).toBeGreaterThan(73);
      expect(haversineKm([60, 25], [lat, lng])).toBeLessThan(77);
    }
  });
  it('gira en sentido antihorario (lo que exige GBIF)', () => {
    const pts = parse(circleWkt(0, 0, 75));
    let area = 0;
    for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
    expect(area).toBeGreaterThan(0);
  });
  it('no explota cerca del polo', () => expect(() => circleWkt(89.9, 0, 75)).not.toThrow());
});

describe('continentFor', () => {
  it.each([
    [40.4, -3.7, 'EUROPE'], [48.8, 2.3, 'EUROPE'], [-1.3, 36.8, 'AFRICA'], [30, 31, 'AFRICA'],
    [40.7, -74, 'NORTH_AMERICA'], [19.4, -99.1, 'NORTH_AMERICA'], [-23.5, -46.6, 'SOUTH_AMERICA'],
    [-33.9, 151.2, 'OCEANIA'], [-36.8, 174.7, 'OCEANIA'], [35.7, 139.7, 'ASIA'], [28.6, 77.2, 'ASIA'],
    [41, 29, 'ASIA'], [-75, 0, 'ANTARCTICA'], [55.7, 37.6, 'EUROPE'],
  ] as const)('%f,%f → %s', (lat, lng, c) => expect(continentFor(lat, lng)).toBe(c));
});
