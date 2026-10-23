import { isPresent } from '../game/scoring';
import { tierFor, type Tier } from '../game/rarity';
import type { Round, Species } from '../game/types';
import { t } from '../i18n/es';
import { esc } from './dom';
import { icon } from './icons';
import { specimenSvg } from './specimen';

/** Solo mostramos fotos con licencia conocida y abierta. */
export function usablePhoto(s: Species): Species['photo'] {
  const p = s.photo;
  return p && p.license && p.license !== 'all-rights-reserved' ? p : null;
}

export function displayName(s: Species): { main: string; italic: boolean; sub: string } {
  return s.name ? { main: s.name, italic: false, sub: s.sci } : { main: s.sci, italic: true, sub: '' };
}

export function stamp(tier: Tier, cls = 'stamp'): string {
  return `<span class="${cls} tier-${tier.id}" title="${esc(t.tiers[tier.id])}"><span>${esc(t.tiers[tier.id])}</span></span>`;
}

export function plate(s: Species, alt = true): string {
  const photo = usablePhoto(s);
  if (photo) {
    return `<img src="${esc(photo.url)}" alt="${alt ? esc(s.name || s.sci) : ''}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
  }
  return specimenSvg(s.shape, s.taxonId);
}

/** Mano de fichas de herbario. Cada ficha es un botón; el número es su atajo de teclado. */
export function handHtml(round: Round, tiers: Tier[]): string {
  return round.cards
    .map((s, i) => {
      const tier = tierFor(s.views, tiers);
      const n = displayName(s);
      const tilt = ((s.taxonId % 7) - 3) * 0.45;
      return `<li style="--tilt:${tilt}deg;--i:${i}">
  <button class="card" type="button" data-id="${s.taxonId}" aria-pressed="false" aria-describedby="card-${s.taxonId}-tier">
    <span class="card-plate">${plate(s)}</span>
    <span class="card-label">
      <span class="card-no">N.º ${String(i + 1).padStart(2, '0')}</span>
      <span class="card-name${n.italic ? ' is-sci' : ''}">${esc(n.main)}</span>
      ${n.sub ? `<span class="card-sci">${esc(n.sub)}</span>` : ''}
      <span class="card-group">${esc(s.group)}</span>
    </span>
    <span id="card-${s.taxonId}-tier" class="card-tier">${stamp(tier)}</span>
    <span class="card-verdict" aria-hidden="true"></span>
    <kbd class="card-key" aria-hidden="true">${i + 1}</kbd>
  </button>
</li>`;
    })
    .join('');
}

/** Marca cada ficha tras revelar: sello de «vive aquí» o «no consta». */
export function verdictFor(round: Round, id: number): 'yes' | 'no' {
  return isPresent(round.evidence[id]) ? 'yes' : 'no';
}

export function verdictHtml(v: 'yes' | 'no'): string {
  return `${icon(v === 'yes' ? 'check' : 'cross')}<span>${esc(t.verdict[v])}</span>`;
}
