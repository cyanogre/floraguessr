import type { SpecimenShape } from '../game/types';
import { seeded } from '../game/random';

/**
 * Dibujo de pliego (planta prensada) en tinta, para cartas sin foto. Se genera con trazos simples y
 * una semilla por especie, así cada pliego es distinto pero estable.
 */
export function specimenSvg(shape: SpecimenShape = 'leaf', seed = 1): string {
  const r = seeded(seed);
  const j = (n: number) => (r() - 0.5) * n;
  const f = (n: number) => n.toFixed(1);
  const p: string[] = [];
  const stem = (x0: number, y0: number, x1: number, y1: number, bend: number) =>
    `M${f(x0)} ${f(y0)} Q${f((x0 + x1) / 2 + bend)} ${f((y0 + y1) / 2)} ${f(x1)} ${f(y1)}`;
  const leaf = (x: number, y: number, len: number, ang: number, w = 0.32) => {
    const a = (ang * Math.PI) / 180;
    const tx = x + Math.cos(a) * len;
    const ty = y + Math.sin(a) * len;
    const nx = -Math.sin(a) * len * w;
    const ny = Math.cos(a) * len * w;
    const mx = (x + tx) / 2;
    const my = (y + ty) / 2;
    return `M${f(x)} ${f(y)} Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)} Q${f(mx - nx)} ${f(my - ny)} ${f(x)} ${f(y)} M${f(x)} ${f(y)} L${f(tx)} ${f(ty)}`;
  };

  switch (shape) {
    case 'conifer': {
      const bend = j(10);
      p.push(stem(50, 132, 50 + bend / 2, 14, bend));
      for (let y = 24; y < 124; y += 9) {
        const x = 50 + (bend * (132 - y)) / 236;
        const len = 10 + ((y - 20) / 100) * 22 + j(4);
        for (let k = -2; k <= 2; k++) {
          const a = (k < 0 ? 200 : -20) + k * 6 + j(6);
          p.push(`M${f(x)} ${f(y)} l${f(Math.cos((a * Math.PI) / 180) * len)} ${f(Math.sin((a * Math.PI) / 180) * len - k)}`);
        }
      }
      break;
    }
    case 'fern': {
      const bend = 14 + j(8);
      p.push(stem(52, 134, 46, 12, bend));
      for (let i = 0; i < 16; i++) {
        const t = i / 16;
        const y = 120 - t * 104;
        const x = 52 + bend * 0.9 * Math.sin(Math.PI * (1 - t)) * 0.5 - t * 6;
        const len = 26 * Math.sin(Math.PI * (0.15 + t * 0.85)) + 3;
        p.push(leaf(x, y, len, 200 + t * 20 + j(6), 0.22), leaf(x, y, len, -20 - t * 20 + j(6), 0.22));
      }
      break;
    }
    case 'grass': {
      for (let i = 0; i < 7; i++) {
        const x = 40 + i * 3 + j(4);
        p.push(stem(50 + j(4), 134, x + j(30), 22 + j(30), j(26)));
      }
      const hx = 52 + j(6);
      p.push(stem(50, 134, hx, 14, 8));
      for (let y = 16; y < 46; y += 4) p.push(leaf(hx - (y - 16) / 8, y, 7, 230 + j(10), 0.3), leaf(hx - (y - 16) / 8, y, 7, -50 + j(10), 0.3));
      break;
    }
    case 'palm': {
      p.push(stem(50, 134, 50, 64, j(8)));
      for (let k = 0; k < 13; k++) {
        const a = -170 + k * 13 + j(4);
        p.push(leaf(50, 64, 44 + j(8), a, 0.12));
      }
      break;
    }
    case 'cactus': {
      p.push('M40 132 V40 Q40 26 50 26 Q60 26 60 40 V132');
      p.push('M46 128 V42 M54 128 V42');
      p.push('M40 84 H30 Q24 84 24 76 V56 Q24 50 29 50 Q34 50 34 56 V74 H40');
      p.push('M60 70 H70 Q76 70 76 62 V48 Q76 42 71 42 Q66 42 66 48 V62 H60');
      for (let y = 34; y < 128; y += 9) p.push(`M38 ${y} l-3 -2 M62 ${y + 4} l3 -2`);
      break;
    }
    case 'succulent': {
      for (let ring = 0; ring < 3; ring++) {
        const n = 7 + ring * 2;
        for (let k = 0; k < n; k++) p.push(leaf(50, 96, 34 - ring * 9, (360 / n) * k + ring * 13 + j(6), 0.36));
      }
      p.push(stem(50, 134, 50, 100, 0));
      break;
    }
    case 'moss': {
      p.push('M18 126 Q50 116 82 126');
      for (let i = 0; i < 9; i++) {
        const x = 24 + i * 6.5 + j(3);
        const top = 52 + j(28);
        p.push(stem(x, 124, x + j(10), top, j(8)));
        p.push(`M${f(x + j(2) - 2)} ${f(top - 1)} q2 -9 4 0 z`);
      }
      for (let i = 0; i < 18; i++) p.push(leaf(20 + i * 3.4, 124 - r() * 6, 7, -90 + j(80), 0.35));
      break;
    }
    case 'pitcher': {
      p.push(stem(50, 134, 50, 92, 4));
      p.push('M38 92 Q34 60 40 34 Q50 26 60 34 Q66 60 62 92 Z');
      p.push('M40 34 Q50 16 64 26 Q58 34 60 34');
      p.push('M44 88 Q42 62 46 40 M56 88 Q58 62 54 40');
      p.push(leaf(50, 120, 26, 200, 0.25), leaf(50, 112, 22, -20, 0.25));
      break;
    }
    case 'lily': {
      p.push('M50 104 m-34 0 a34 14 0 1 0 68 0 a34 14 0 1 0 -68 0 M50 104 L84 100');
      for (let k = 0; k < 9; k++) p.push(leaf(50, 86, 18 + j(4), -180 + k * 22.5, 0.3));
      p.push(stem(50, 132, 50, 106, 6));
      break;
    }
    case 'orchid': {
      p.push(stem(50, 134, 56, 18, -14));
      p.push(leaf(50, 128, 34, 200, 0.28), leaf(50, 126, 30, -24, 0.28));
      for (let i = 0; i < 3; i++) {
        const cx = 56 + i * 4 - 4;
        const cy = 30 + i * 20;
        for (let k = 0; k < 5; k++) p.push(leaf(cx, cy, 11 + (k === 2 ? 4 : 0), -90 + k * 72 + j(8), 0.45));
        p.push(`M${f(cx)} ${f(cy)} m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0`);
      }
      break;
    }
    case 'flower': {
      const bend = j(14);
      p.push(stem(50, 134, 50 + bend / 3, 34, bend));
      for (let i = 0; i < 4; i++) {
        const y = 118 - i * 20;
        p.push(leaf(50 + (bend * i) / 12, y, 22 - i * 3, i % 2 ? -30 : 210, 0.34));
      }
      const cx = 50 + bend / 3;
      for (let k = 0; k < 6; k++) p.push(leaf(cx, 32, 16, k * 60 + j(10), 0.5));
      p.push(`M${f(cx)} 32 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0`);
      break;
    }
    case 'leaf':
    default: {
      const bend = j(12);
      p.push(stem(50, 134, 50 + bend / 2, 22, bend));
      for (let i = 0; i < 6; i++) {
        const y = 118 - i * 17;
        const x = 50 + (bend * (134 - y)) / 230;
        p.push(leaf(x, y, 30 - i * 3.5 + j(4), i % 2 ? -38 + j(10) : 218 + j(10), 0.38));
      }
    }
  }
  return `<svg class="specimen-draw" viewBox="0 0 100 140" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><path d="${p.join(' ')}"/></svg>`;
}
