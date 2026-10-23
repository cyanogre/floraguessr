import demo from '../data/demo.json';
import { shapeForGroup } from '../api/groups';
import { emptyEvidence } from './pack';
import { shuffle, type Rng } from './random';
import type { RoundSource } from './sources';
import type { Evidence, Place, Round, Species } from './types';

interface DemoRound {
  label: string;
  place: Place;
  cards: Species[];
  valid: Record<string, boolean>;
}

/** Partida de muestra sin red: siete lugares preparados, barajados en cada partida. */
export class DemoSource implements RoundSource {
  private queue: DemoRound[] = [];

  constructor(private rng: Rng, private delayMs = 700) {}

  async next(signal: AbortSignal): Promise<Round> {
    if (!this.queue.length) this.queue = shuffle(demo as unknown as DemoRound[], this.rng);
    const r = this.queue.shift()!;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, this.delayMs);
      signal.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('Cancelado', 'AbortError'));
      }, { once: true });
    });
    const evidence: Record<number, Evidence> = {};
    for (const c of r.cards) {
      const native = r.valid[String(c.taxonId)];
      evidence[c.taxonId] = native === undefined ? emptyEvidence() : { ...emptyEvidence(), inat: 1, native };
    }
    const cards = shuffle(r.cards.map((c) => ({ ...c, shape: c.shape ?? shapeForGroup(c.group) })), this.rng);
    const answerId = Number(Object.entries(r.valid).find(([, n]) => n)?.[0] ?? Object.keys(r.valid)[0]);
    return { place: r.place, cards, evidence, answerId, sample: { label: r.label } };
  }
}
