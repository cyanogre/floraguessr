import { RATE_LIMITS, type Service } from '../config';
import { RateQueue, isAbort } from './queue';

export class HttpError extends Error {
  constructor(public readonly status: number, url: string) {
    super(`HTTP ${status} en ${url}`);
  }
}

export interface FetchOptions {
  service: Service;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  retries?: number;
}

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

const queues = new Map<Service, RateQueue>();
let transport: Transport = (url, init) => fetch(url, init);
let sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Cancelado', 'AbortError'));
    }, { once: true });
  });

export function queueFor(service: Service): RateQueue {
  let q = queues.get(service);
  if (!q) {
    const { perMinute, burst } = RATE_LIMITS[service];
    q = new RateQueue(perMinute, burst);
    queues.set(service, q);
  }
  return q;
}

/** Solo para tests. */
export function __setTransport(t: Transport, s?: typeof sleep): void {
  transport = t;
  if (s) sleep = s;
  queues.clear();
}

/** Espera tras el intento `attempt` (0, 1, 2…): Retry-After si lo hay; si no, 2^n s con algo de azar. */
export function backoffMs(attempt: number, retryAfter: string | null, rnd = Math.random()): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) return Math.min(60_000, secs * 1000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(60_000, Math.max(0, date - Date.now()));
  }
  return Math.min(30_000, 1000 * 2 ** attempt) + Math.floor(rnd * 400);
}

/** GET JSON pasando por la cola del servicio, con reintentos ante 429, 5xx y fallos de red. */
export async function getJson<T>(url: string, opts: FetchOptions): Promise<T> {
  const retries = opts.retries ?? 3;
  const q = queueFor(opts.service);
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await q.schedule(
        () => transport(url, { signal: opts.signal, headers: opts.headers }),
        opts.signal,
      );
    } catch (e) {
      if (isAbort(e) || attempt >= retries) throw e;
      await sleep(backoffMs(attempt, null), opts.signal);
      continue;
    }
    if (res.ok) return (await res.json()) as T;
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt >= retries) throw new HttpError(res.status, url);
    const wait = backoffMs(attempt, res.headers.get('Retry-After'));
    if (res.status === 429) q.pause(wait);
    await sleep(wait, opts.signal);
  }
}
