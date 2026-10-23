/** Reglas del juego y límites de red. Todo lo ajustable vive aquí. */
export const RADIUS_KM = 75;
export const ROUNDS = 5;
export const PACK_SIZE = 6;
export const REROLLS = 2;

/** Pruebas mínimas para dar una planta por presente en el círculo. */
export const MIN_INAT_RESEARCH = 1;
export const MIN_GBIF_RECORDS = 2;

export const SCORE_BASE = 100;
export const NATIVE_BONUS = 1.25;
export const HINT_FACTOR = 0.7;

/** Radio (km) del que salen los señuelos en modo Mundial: cuanto más cerca, más difícil. */
export const DIFFICULTY = {
  facil: 2500,
  normal: 1200,
  dificil: 500,
} as const;
export type Difficulty = keyof typeof DIFFICULTY;

export const APP_UA = 'FloraGuessr/0.1 (https://github.com/cyanogre/floraguessr)';

/** Peticiones por minuto y ráfaga por servicio. iNaturalist pide ≤60/min; vamos a la mitad. */
export const RATE_LIMITS = {
  inat: { perMinute: 30, burst: 5 },
  gbif: { perMinute: 120, burst: 8 },
  wikimedia: { perMinute: 150, burst: 10 },
} as const;
export type Service = keyof typeof RATE_LIMITS;

/** Caducidad de la caché persistente, en días. */
export const CACHE_DAYS = {
  taxon: 30,
  pageviews: 30,
  summary: 30,
  place: 1,
  gbifMatch: 90,
} as const;
