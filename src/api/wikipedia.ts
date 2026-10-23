import { APP_UA, CACHE_DAYS } from '../config';
import { cache } from './cache';
import { getJson, HttpError } from './http';

/** Wikimedia pide identificar la app; en navegador va en Api-User-Agent (User-Agent no se puede fijar). */
const headers = { 'Api-User-Agent': APP_UA };
const opts = (signal?: AbortSignal) => ({ service: 'wikimedia' as const, signal, headers });

/** Ventana de 12 meses completos que termina el mes anterior al actual. */
export function lastYearRange(now = new Date()): [string, string] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1));
  const fmt = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return [fmt(start), fmt(last)];
}

/** Visitas anuales al artículo en la Wikipedia en inglés (la base común para medir rareza). */
export async function annualViews(title: string, signal?: AbortSignal): Promise<number | null> {
  return cache.get(`wiki:views:${title}`, CACHE_DAYS.pageviews, async () => {
    const [a, b] = lastYearRange();
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title)}/monthly/${a}/${b}`;
    try {
      const d = await getJson<{ items: { views: number }[] }>(url, opts(signal));
      return d.items.reduce((s, i) => s + i.views, 0);
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
  });
}

export interface Summary {
  extract: string;
  url: string;
  lang: string;
}

/** Resumen del artículo en el idioma de la interfaz; si no existe, en inglés. */
export async function summary(titles: { local?: string; en?: string }, lang: string, signal?: AbortSignal): Promise<Summary | null> {
  const tries: [string, string][] = [];
  if (titles.local) tries.push([lang, titles.local]);
  if (titles.en && !(lang === 'en' && titles.local === titles.en)) tries.push(['en', titles.en]);
  for (const [l, t] of tries) {
    const s = await cache.get(`wiki:sum:${l}:${t}`, CACHE_DAYS.summary, async () => {
      try {
        const d = await getJson<{ extract?: string; content_urls?: { desktop?: { page?: string } } }>(
          `https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`,
          opts(signal),
        );
        return d.extract ? { extract: d.extract, url: d.content_urls?.desktop?.page ?? '', lang: l } : null;
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
      }
    });
    if (s) return s;
  }
  return null;
}
