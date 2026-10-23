import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateQueue, isAbort } from '../../src/api/queue';
import { __setTransport, backoffMs, getJson, HttpError } from '../../src/api/http';
import { Cache } from '../../src/api/cache';

describe('RateQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('deja pasar la ráfaga y luego respeta el ritmo', async () => {
    const q = new RateQueue(30, 3); // una cada 2 s
    const done: number[] = [];
    for (let i = 0; i < 5; i++) q.schedule(async () => done.push(i));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toEqual([0, 1, 2]);
    await vi.advanceTimersByTimeAsync(1999);
    expect(done).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(2000);
    expect(done).toHaveLength(5);
  });

  it('nunca supera 30 por minuto en un minuto completo', async () => {
    const q = new RateQueue(30, 5);
    let n = 0;
    for (let i = 0; i < 100; i++) q.schedule(async () => n++);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(n).toBeLessThanOrEqual(5 + 30);
    expect(n).toBeGreaterThanOrEqual(30);
  });

  it('pause() detiene la cola', async () => {
    const q = new RateQueue(600, 5);
    q.pause(5000);
    let ran = false;
    q.schedule(async () => (ran = true));
    await vi.advanceTimersByTimeAsync(4900);
    expect(ran).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(ran).toBe(true);
  });

  it('cancelar saca la tarea de la cola', async () => {
    const q = new RateQueue(60, 1);
    q.schedule(async () => 1);
    const ctrl = new AbortController();
    const ran = vi.fn();
    const p = q.schedule(async () => ran(), ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toSatisfy(isAbort);
    await vi.advanceTimersByTimeAsync(5000);
    expect(ran).not.toHaveBeenCalled();
    expect(q.size).toBe(0);
  });
});

describe('backoffMs', () => {
  it('usa Retry-After en segundos', () => expect(backoffMs(0, '7')).toBe(7000));
  it('crece exponencialmente', () => {
    expect(backoffMs(0, null, 0)).toBe(1000);
    expect(backoffMs(3, null, 0)).toBe(8000);
  });
  it('tiene techo', () => expect(backoffMs(20, null, 0)).toBe(30_000));
});

describe('getJson', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const noWait = () => Promise.resolve();

  it('reintenta tras 429 y devuelve el JSON', async () => {
    const t = vi.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0' } })).mockResolvedValueOnce(ok({ a: 1 }));
    __setTransport(t, noWait);
    await expect(getJson('https://x/a', { service: 'inat' })).resolves.toEqual({ a: 1 });
    expect(t).toHaveBeenCalledTimes(2);
  });

  it('no reintenta un 404', async () => {
    const t = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    __setTransport(t, noWait);
    await expect(getJson('https://x/b', { service: 'gbif' })).rejects.toBeInstanceOf(HttpError);
    expect(t).toHaveBeenCalledTimes(1);
  });

  it('se rinde tras los reintentos', async () => {
    const t = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    __setTransport(t, noWait);
    await expect(getJson('https://x/c', { service: 'gbif', retries: 2 })).rejects.toMatchObject({ status: 503 });
    expect(t).toHaveBeenCalledTimes(3);
  });

  it('envía las cabeceras', async () => {
    const t = vi.fn().mockResolvedValue(ok({}));
    __setTransport(t, noWait);
    await getJson('https://x/d', { service: 'wikimedia', headers: { 'Api-User-Agent': 'FG' } });
    expect(t.mock.calls[0][1].headers).toEqual({ 'Api-User-Agent': 'FG' });
  });
});

describe('Cache', () => {
  it('carga una vez aunque se pida a la vez', async () => {
    const c = new Cache(null);
    const load = vi.fn(async () => 42);
    const [a, b] = await Promise.all([c.get('k', 1, load), c.get('k', 1, load)]);
    expect([a, b]).toEqual([42, 42]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('caduca', async () => {
    let now = 0;
    const c = new Cache(null, () => now);
    const load = vi.fn(async () => now);
    await c.get('k', 1, load);
    now = 2 * 86_400_000;
    await c.get('k', 1, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('persiste en IndexedDB entre instancias', async () => {
    const a = new Cache();
    await a.get('persist', 1, async () => 'hoja');
    const b = new Cache();
    const load = vi.fn(async () => 'otra');
    expect(await b.get('persist', 1, load)).toBe('hoja');
    expect(load).not.toHaveBeenCalled();
  });

  it('no guarda errores', async () => {
    const c = new Cache(null);
    await expect(c.get('e', 1, async () => { throw new Error('x'); })).rejects.toThrow();
    await expect(c.get('e', 1, async () => 1)).resolves.toBe(1);
  });
});
