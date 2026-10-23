export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Falta ${sel}`);
  return el;
};

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const nf = new Intl.NumberFormat('es-ES');
export const nf2 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

export function coords(lat: number, lng: number): string {
  const f = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${f.format(Math.abs(lat))}° ${lat >= 0 ? 'N' : 'S'} · ${f.format(Math.abs(lng))}° ${lng >= 0 ? 'E' : 'O'}`;
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function store<T>(key: string, fallback: T): { get(): T; set(v: T): void } {
  return {
    get() {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : (JSON.parse(raw) as T);
      } catch {
        return fallback;
      }
    },
    set(v) {
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* sin almacenamiento: no pasa nada */
      }
    },
  };
}
