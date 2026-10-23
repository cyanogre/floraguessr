/**
 * Cola con cubo de fichas: como mucho `burst` peticiones seguidas y después `perMinute` al minuto.
 * Las tareas salen en orden de llegada; un 429 pausa toda la cola del servicio.
 */
export class RateQueue {
  private tokens: number;
  private last: number;
  private pausedUntil = 0;
  private pending: { run: () => void; signal?: AbortSignal; onAbort?: () => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly refillPerMs: number;

  constructor(
    perMinute: number,
    private readonly burst: number,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.refillPerMs = perMinute / 60_000;
    this.tokens = burst;
    this.last = now();
  }

  get size(): number {
    return this.pending.length;
  }

  schedule<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise<T>((resolve, reject) => {
      const entry: (typeof this.pending)[number] = {
        signal,
        run: () => {
          if (entry.onAbort) signal?.removeEventListener('abort', entry.onAbort);
          task().then(resolve, reject);
        },
      };
      if (signal) {
        entry.onAbort = () => {
          const i = this.pending.indexOf(entry);
          if (i >= 0) this.pending.splice(i, 1);
          reject(abortError());
        };
        signal.addEventListener('abort', entry.onAbort, { once: true });
      }
      this.pending.push(entry);
      this.drain();
    });
  }

  /** Detiene la salida de peticiones durante `ms` (p. ej. tras un 429 con Retry-After). */
  pause(ms: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, this.now() + ms);
    this.tokens = 0;
    this.drain();
  }

  private refill(): void {
    const t = this.now();
    this.tokens = Math.min(this.burst, this.tokens + (t - this.last) * this.refillPerMs);
    this.last = t;
  }

  private drain(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.refill();
    const t = this.now();
    while (this.pending.length && t >= this.pausedUntil && this.tokens >= 1) {
      this.tokens -= 1;
      this.pending.shift()!.run();
    }
    if (!this.pending.length) return;
    const waitPause = Math.max(0, this.pausedUntil - t);
    const waitToken = this.tokens >= 1 ? 0 : (1 - this.tokens) / this.refillPerMs;
    this.timer = setTimeout(() => this.drain(), Math.ceil(Math.max(waitPause, waitToken)));
  }
}

export function abortError(): DOMException {
  return new DOMException('Cancelado', 'AbortError');
}

export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
