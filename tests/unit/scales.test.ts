import { describe, expect, it } from 'vitest';
import { degreeToMidi, midiToHz, scaleFor } from '../../src/audio/scales';

describe('scaleFor', () => {
  it.each([
    ['EUROPE', 40, -3, 'dorian'], ['AFRICA', 0, 20, 'egyptian'], ['NORTH_AMERICA', 40, -100, 'blues'],
    ['SOUTH_AMERICA', -15, -70, 'andean'], ['OCEANIA', -30, 150, 'majorPenta'], ['ANTARCTICA', -80, 0, 'wholeTone'],
    ['ASIA', 30, 45, 'hijaz'], ['ASIA', 20, 78, 'yaman'], ['ASIA', 5, 110, 'pelog'], ['ASIA', 36, 139, 'hirajoshi'],
    ['ASIA', 35, 110, 'gong'],
  ] as const)('%s (%f,%f) → %s', (c, lat, lng, id) => expect(scaleFor(c, lat, lng).id).toBe(id));

  it('las escalas con bordón son las esperadas', () => {
    expect(scaleFor('OCEANIA', 0, 0).drone).toBe(true);
    expect(scaleFor('EUROPE', 0, 0).drone).toBe(false);
  });
});

describe('degreeToMidi', () => {
  const s = scaleFor('EUROPE', 0, 0);
  it('grado 0 = tónica', () => expect(degreeToMidi(s, 0)).toBe(50));
  it('sube de octava al dar la vuelta', () => expect(degreeToMidi(s, 7)).toBe(62));
  it('baja con grados negativos', () => expect(degreeToMidi(s, -1)).toBe(50 - 12 + 10));
  it('la4 = 440 Hz', () => expect(midiToHz(69)).toBe(440));
});
