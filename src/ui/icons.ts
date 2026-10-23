/** Juego de iconos propio: trazo de 1,6 px, puntas redondas, rejilla de 24. */
const PATHS: Record<string, string> = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  lens: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
  reroll: '<path d="M4.5 11a7.5 7.5 0 0 1 13-4.6L19.5 8.5"/><path d="M19.5 3.5v5h-5"/><path d="M19.5 13a7.5 7.5 0 0 1-13 4.6L4.5 15.5"/><path d="M4.5 20.5v-5h5"/>',
  note: '<path d="M9 17.5V5.5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/>',
  noteOff: '<path d="M9 17.5V5.5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/><path d="M3 3l18 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  cross: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  map: '<path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z"/><path d="M9 4.5v13M15 6.5v13"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.4"/>',
  next: '<path d="M5 12h13"/><path d="M13 6l6 6-6 6"/>',
  layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/><path d="M3.5 16.5L12 21l8.5-4.5"/>',
};

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, cls = 'icon'): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
}

/** Chincheta del mapa (con relleno: es un objeto, no un icono de interfaz). */
export const PIN_SVG = `<svg viewBox="0 0 32 44" width="32" height="44" aria-hidden="true">
  <path d="M16 26v16" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="16" cy="27" rx="9" ry="3" fill="var(--red-deep)"/>
  <path d="M10 26l2-13h8l2 13z" fill="var(--red)"/>
  <ellipse cx="16" cy="12" rx="8" ry="4.5" fill="var(--red)" stroke="var(--red-deep)" stroke-width="1.2"/>
</svg>`;
