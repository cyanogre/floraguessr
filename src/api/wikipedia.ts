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

/** Días que da la API de acción de Wikipedia (máximo 60); se pasan a ritmo anual. */
export const PV_DAYS = 60;

interface PvResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; pageviews?: Record<string, number | null> }[];
  };
}

/**
 * Convierte la respuesta de prop=pageviews en visitas anuales estimadas por título pedido,
 * siguiendo normalizaciones y redirecciones. null si el artículo no existe o no hay datos.
 */
export function parsePageviews(titles: string[], data: PvResponse): Map<string, number | null> {
  const q = data.query ?? {};
  const hop = new Map<string, string>();
  for (const n of [...(q.normalized ?? []), ...(q.redirects ?? [])]) hop.set(n.from, n.to);
  const byTitle = new Map<string, number | null>();
  for (const p of q.pages ?? []) {
    if (p.missing || !p.pageviews) {
      byTitle.set(p.title, null);
      continue;
    }
    const days = Object.values(p.pageviews).filter((v): v is number => typeof v === 'number');
    byTitle.set(p.title, days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 365) : null);
  }
  const out = new Map<string, number | null>();
  for (const t of titles) {
    let cur = t.replace(/_/g, ' ');
    for (let i = 0; i < 3 && hop.has(cur); i++) cur = hop.get(cur)!;
    out.set(t, byTitle.get(cur) ?? null);
  }
  return out;
}

/**
 * Visitas anuales (estimadas con los últimos 60 días) de varios artículos de la Wikipedia en
 * inglés en una sola llamada. Usa la API de acción con origin=*, que admite peticiones desde
 * el navegador.
 */
export async function annualViewsBatch(titles: string[], signal?: AbortSignal): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const missing: string[] = [];
  for (const t of titles) {
    const hit = await cache.peek<number | null>(`wiki:pv:${t}`);
    if (hit !== undefined) out.set(t, hit);
    else missing.push(t);
  }
  for (let i = 0; i < missing.length; i += 50) {
    const chunk = missing.slice(i, i + 50);
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=pageviews&pvipdays=${PV_DAYS}&titles=${encodeURIComponent(chunk.join('|'))}`;
    const parsed = parsePageviews(chunk, await getJson<PvResponse>(url, opts(signal)));
    for (const [t, v] of parsed) {
      out.set(t, v);
      await cache.put(`wiki:pv:${t}`, CACHE_DAYS.pageviews, v);
    }
  }
  return out;
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
