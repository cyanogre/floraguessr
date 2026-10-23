import { REROLLS, ROUNDS, RADIUS_KM, type Difficulty } from '../config';
import { AudioEngine } from '../audio/engine';
import { shapeForGroup } from '../api/groups';
import { isAbort } from '../api/queue';
import * as wiki from '../api/wikipedia';
import { DemoSource } from '../game/demo';
import { initialState, reduce, type GameEvent, type GameState, type Mode, type RoundResult } from '../game/machine';
import { isPresent } from '../game/scoring';
import { DEFAULT_THRESHOLDS, tierFor, tiersFrom, type Tier, type TierId } from '../game/rarity';
import { BalancedSource, NoRoundError, RoundPipeline, ZonalSource, type RoundSource } from '../game/sources';
import type { Round, Species } from '../game/types';
import { t } from '../i18n/es';
import { displayName, handHtml, plate, stamp, usablePhoto, verdictFor, verdictHtml } from './cards';
import { $, coords, esc, nf, nf2, reducedMotion, store, wait } from './dom';
import { drawFern } from './fern';
import { icon } from './icons';
import { FieldMap } from './map';

interface Options {
  demo: boolean;
}

const best = store<number>('fg-best', 0);
const prefs = store<{ mode: Mode; difficulty: Difficulty; music: boolean }>('fg-prefs', { mode: 'mundial', difficulty: 'normal', music: true });

export class App {
  private state: GameState = initialState();
  private tiers: Tier[] = tiersFrom(DEFAULT_THRESHOLDS);
  private pipeline: RoundPipeline | null = null;
  private map!: FieldMap;
  private audio = new AudioEngine();
  private pool: { species: Species[]; thresholds: Record<TierId, number> } | null = null;
  private sheetTab = 0;
  private loadingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private opts: Options) {
    const p = prefs.get();
    this.state = { ...this.state, mode: p.mode, difficulty: p.difficulty };
    this.audio.enabled = p.music;
  }

  mount(): void {
    this.map = new FieldMap($('#map'), { satellite: !this.opts.demo });
    this.renderMenu();
    this.renderStatic();
    this.bind();
    this.render(initialState());
  }

  // ---------- Flujo ----------

  private dispatch(e: GameEvent): void {
    const prev = this.state;
    this.state = reduce(prev, e, this.tiers);
    if (this.state !== prev) this.render(prev);
  }

  private async start(): Promise<void> {
    const { mode, difficulty } = this.state;
    prefs.set({ mode, difficulty, music: this.audio.enabled });
    this.audio.start();
    let source: RoundSource;
    if (this.opts.demo) {
      source = new DemoSource(Math.random);
      this.tiers = tiersFrom(DEFAULT_THRESHOLDS);
    } else if (mode === 'equilibrado') {
      try {
        const pool = await this.loadPool();
        source = new BalancedSource(pool.species, Math.random);
        this.tiers = tiersFrom(pool.thresholds);
      } catch {
        this.dispatch({ type: 'start', mode, difficulty });
        this.dispatch({ type: 'failed', reason: 'network' });
        return;
      }
    } else {
      source = new ZonalSource(difficulty, Math.random);
      this.tiers = tiersFrom(DEFAULT_THRESHOLDS);
    }
    this.pipeline?.cancel();
    this.pipeline = new RoundPipeline(source);
    this.dispatch({ type: 'start', mode, difficulty });
    void this.loadRound();
  }

  private async loadPool() {
    if (this.pool) return this.pool;
    const res = await fetch(new URL('./data/equilibrado.json', document.baseURI));
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { thresholds: Record<TierId, number>; species: Species[] };
    data.species.forEach((s) => (s.shape = shapeForGroup(s.group)));
    this.pool = data;
    return data;
  }

  private async loadRound(): Promise<void> {
    const pipe = this.pipeline;
    if (!pipe) return;
    try {
      const round = await pipe.take();
      if (pipe !== this.pipeline || this.state.phase !== 'loading') return;
      this.dispatch({ type: 'loaded', round });
      // Precarga la siguiente mientras se juega esta (también sirve para «Otro sobre»).
      if (this.state.roundNo < ROUNDS || this.state.rerolls > 0) pipe.prefetch();
    } catch (e) {
      if (isAbort(e) || pipe !== this.pipeline) return;
      pipe.discard();
      this.dispatch({ type: 'failed', reason: e instanceof NoRoundError ? 'noPlace' : 'network' });
    }
  }

  private toMenu(): void {
    this.pipeline?.cancel();
    this.pipeline = null;
    this.closeDialog('#sheet');
    this.dispatch({ type: 'menu' });
  }

  // ---------- Eventos ----------

  private bind(): void {
    $('#btn-menu').addEventListener('click', () => {
      const p = this.state.phase;
      const untouched = this.state.history.length === 0 && this.state.rerolls === REROLLS && p === 'loading';
      if (p === 'finished' || p === 'error' || untouched) this.toMenu();
      else this.openExit();
    });
    $('#btn-hint').addEventListener('click', () => {
      this.audio.sfx('tick');
      this.dispatch({ type: 'hint', rng: Math.random });
    });
    $('#btn-surrender').addEventListener('click', () => this.dispatch({ type: 'surrender' }));
    $('#btn-reroll').addEventListener('click', () => {
      this.audio.sfx('tick');
      this.dispatch({ type: 'reroll' });
      void this.loadRound();
    });
    $('#btn-music').addEventListener('click', () => {
      this.audio.start();
      this.audio.toggle();
      prefs.set({ ...prefs.get(), music: this.audio.enabled });
      this.renderStatic();
    });
    $('#btn-layer').addEventListener('click', () => {
      this.map.toggleSatellite();
    });
    $('#hand-cards').addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('.card');
      if (!btn || this.state.phase !== 'choosing') return;
      const id = Number(btn.dataset.id);
      if (this.state.selectedId === id) this.dispatch({ type: 'confirm' });
      else {
        this.audio.sfx('pick');
        this.dispatch({ type: 'select', id });
      }
    });
    $('#btn-confirm').addEventListener('click', () => this.dispatch({ type: 'confirm' }));
    document.addEventListener('keydown', (ev) => {
      if (this.state.phase !== 'choosing' || document.querySelector('dialog[open]')) return;
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      const n = Number(ev.key);
      if (n >= 1 && n <= 6) {
        const card = this.state.round?.cards[n - 1];
        if (!card) return;
        ev.preventDefault();
        this.dispatch({ type: 'select', id: card.taxonId });
        document.querySelector<HTMLButtonElement>(`.card[data-id="${card.taxonId}"]`)?.focus();
      }
    });
    $('#sheet').addEventListener('close', () => {
      this.audio.duck(false);
      if (this.state.phase === 'revealed') this.showSheetbar(true);
    });
    window.addEventListener('resize', () => this.map.refresh());
  }

  // ---------- Pintado ----------

  private render(prev: GameState): void {
    const s = this.state;
    const app = $('#app');
    app.dataset.phase = s.phase;
    $('#menu').hidden = s.phase !== 'menu';
    $('#loader').hidden = s.phase !== 'loading';
    $('#end').hidden = s.phase !== 'finished';
    $('#error').hidden = s.phase !== 'error';
    $('#hand').hidden = !(s.phase === 'choosing' || s.phase === 'revealed');

    if (s.phase === 'menu' && prev.phase !== 'menu') {
      this.map.reset();
      this.showSheetbar(false);
      this.renderMenu();
    }
    this.renderHud();
    this.renderSlip(prev);

    if (s.phase === 'loading' && prev.phase !== 'loading') {
      this.showSheetbar(false);
      this.closeDialog('#sheet');
      $('#packet-no').textContent = `N.º ${String(s.roundNo).padStart(2, '0')}`;
      $('#hand-cards').innerHTML = '';
    }
    if (s.round && s.round !== prev.round) this.enterRound(s.round);
    if (s.phase === 'choosing') this.updateHand();
    if (s.phase === 'revealed' && prev.phase !== 'revealed') void this.reveal(s.result!);
    if (s.phase === 'finished' && prev.phase !== 'finished') this.renderEnd();
    if (s.phase === 'error') this.renderError();
  }

  private renderStatic(): void {
    $('#btn-menu').innerHTML = `${icon('back')}<span>${t.hud.menu}</span>`;
    $('#btn-hint').innerHTML = `${icon('lens')}<span>${t.hud.hint}</span>`;
    $('#btn-hint').title = t.hud.hintTitle;
    $('#btn-surrender').innerHTML = `${icon('flag')}<span>${t.hud.surrender}</span>`;
    const on = this.audio.enabled;
    const music = $('#btn-music');
    music.innerHTML = `${icon(on ? 'note' : 'noteOff')}<span class="sr-only">${on ? t.hud.musicOn : t.hud.musicOff}</span>`;
    music.setAttribute('aria-pressed', String(on));
    music.title = on ? t.hud.musicOn : t.hud.musicOff;
    const layer = $('#btn-layer');
    layer.hidden = !this.map.hasSatellite;
    layer.innerHTML = `${icon('layers')}<span class="sr-only">${t.hud.layer}</span>`;
    layer.title = t.hud.layer;
    const menuMusic = document.querySelector('#menu-music');
    if (menuMusic) {
      menuMusic.setAttribute('aria-pressed', String(on));
      menuMusic.innerHTML = `${icon(on ? 'note' : 'noteOff')}<span>${t.music}</span>`;
    }
  }

  private renderHud(): void {
    const s = this.state;
    $('#hud-round').innerHTML = s.roundNo
      ? `<span class="hud-long">${t.hud.round(s.roundNo, ROUNDS)}</span><span class="hud-short" aria-hidden="true">${s.roundNo}/${ROUNDS}</span>`
      : '';
    $('#hud-marks').innerHTML = Array.from({ length: ROUNDS }, (_, i) => {
      const r = s.history[i];
      const cls = r ? (r.correct ? 'is-ok' : 'is-miss') : i + 1 === s.roundNo ? 'is-now' : '';
      return `<li class="${cls}"></li>`;
    }).join('');
    $('#hud-score').innerHTML = `<b>${nf.format(s.score)}</b> <span class="hud-pts">${t.hud.points}</span>`;
    const choosing = s.phase === 'choosing';
    const hint = $<HTMLButtonElement>('#btn-hint');
    hint.disabled = !choosing || s.hintUsed;
    $<HTMLButtonElement>('#btn-surrender').disabled = !choosing;
    const reroll = $<HTMLButtonElement>('#btn-reroll');
    reroll.disabled = !choosing || s.rerolls < 1;
    reroll.innerHTML = `${icon('reroll')}<span>${t.hud.reroll}</span><b class="tool-count">${s.rerolls}</b>`;
    reroll.title = t.hud.rerollTitle(s.rerolls);
    reroll.setAttribute('aria-label', `${t.hud.reroll} (${s.rerolls}/${REROLLS})`);
  }

  private renderSlip(prev: GameState): void {
    const s = this.state;
    const slip = $('#slip');
    if (this.loadingTimer) {
      clearInterval(this.loadingTimer);
      this.loadingTimer = null;
    }
    if (s.phase === 'loading') {
      let i = 0;
      slip.innerHTML = `<p class="slip-main">${t.slip.loading[0]}</p>`;
      this.loadingTimer = setInterval(() => {
        i = (i + 1) % t.slip.loading.length;
        slip.innerHTML = `<p class="slip-main">${t.slip.loading[i]}</p>`;
      }, 2200);
      return;
    }
    if (s.phase === 'choosing') {
      const place = s.round!.place;
      const where = s.round!.sample?.label ? `${s.round!.sample.label}, ${place.country}` : place.country ?? t.continents[place.continent];
      const sub = s.hintUsed && !prev.hintUsed ? t.slip.hinted : s.selectedId != null ? t.slip.confirmSub : t.slip.chooseSub;
      slip.innerHTML = `<p class="slip-place">${esc(where)} · ${coords(place.lat, place.lng)}</p><p class="slip-main">${t.slip.choose}</p><p class="slip-sub">${sub}</p>`;
      return;
    }
    slip.innerHTML = '';
  }

  private enterRound(round: Round): void {
    this.sheetTab = 0;
    const hand = $('#hand-cards');
    hand.innerHTML = handHtml(round, this.tiers);
    hand.classList.remove('is-revealed');
    hand.classList.toggle('deal', !reducedMotion());
    this.audio.setPlace(round.place.continent, round.place.lat, round.place.lng);
    this.audio.sfx('open');
    requestAnimationFrame(() => {
      const handH = $('#hand').getBoundingClientRect().height;
      const top = $('#hud').getBoundingClientRect().bottom + $('#slip').getBoundingClientRect().height + 16;
      this.map.showPlace(round.place, { top, bottom: handH + 16 }, !reducedMotion());
    });
  }

  private updateHand(): void {
    const s = this.state;
    for (const btn of document.querySelectorAll<HTMLButtonElement>('#hand-cards .card')) {
      const id = Number(btn.dataset.id);
      const struck = s.struck.includes(id);
      btn.setAttribute('aria-pressed', String(s.selectedId === id));
      btn.classList.toggle('is-struck', struck);
      btn.disabled = struck;
    }
    const confirm = $<HTMLButtonElement>('#btn-confirm');
    const sel = s.round?.cards.find((c) => c.taxonId === s.selectedId);
    confirm.hidden = !sel;
    if (sel) confirm.innerHTML = `${icon('check')}<span>${esc(t.confirm(displayName(sel).main))}</span>`;
  }

  private async reveal(result: RoundResult): Promise<void> {
    const round = result.round;
    $<HTMLButtonElement>('#btn-confirm').hidden = true;
    const hand = $('#hand-cards');
    hand.classList.add('is-revealed');
    for (const btn of hand.querySelectorAll<HTMLButtonElement>('.card')) {
      const id = Number(btn.dataset.id);
      const v = verdictFor(round, id);
      btn.disabled = false;
      btn.dataset.verdict = v;
      btn.querySelector('.card-verdict')!.innerHTML = verdictHtml(v);
      btn.setAttribute('aria-label', `${btn.querySelector('.card-name')?.textContent}: ${t.verdict[v]}`);
    }
    hand.onclick = null;
    for (const c of round.cards) if (isPresent(round.evidence[c.taxonId])) this.map.showRecords(round.evidence[c.taxonId].points);
    this.audio.sfx(result.correct ? 'ok' : 'no');
    await wait(reducedMotion() ? 0 : 900);
    if (this.state.result !== result) return;
    this.sheetTab = 0;
    this.openSheet();
  }

  // ---------- Ficha ----------

  private sheetEntries(r: RoundResult): { kind: 'mine' | 'answer'; card: Species }[] {
    const find = (id: number) => r.round.cards.find((c) => c.taxonId === id)!;
    const out: { kind: 'mine' | 'answer'; card: Species }[] = [];
    if (r.pickedId != null) out.push({ kind: 'mine', card: find(r.pickedId) });
    if (!r.correct) out.push({ kind: 'answer', card: find(r.round.answerId) });
    return out;
  }

  private openSheet(): void {
    const r = this.state.result;
    if (!r) return;
    this.showSheetbar(false);
    const dlg = $<HTMLDialogElement>('#sheet');
    dlg.innerHTML = this.sheetHtml(r);
    this.bindSheet(dlg, r);
    if (!dlg.open) dlg.showModal();
    this.audio.duck(true);
    void this.loadExtract(dlg, this.sheetEntries(r)[this.sheetTab].card, r.round);
  }

  private sheetHtml(r: RoundResult): string {
    const entries = this.sheetEntries(r);
    const { kind, card } = entries[Math.min(this.sheetTab, entries.length - 1)];
    const round = r.round;
    const ev = round.evidence[card.taxonId];
    const present = isPresent(ev);
    const tier = tierFor(card.views, this.tiers);
    const n = displayName(card);
    const last = this.state.roundNo >= ROUNDS;
    const photo = usablePhoto(card);
    const others = round.cards.filter((c) => c.taxonId !== card.taxonId && isPresent(round.evidence[c.taxonId]));
    const kicker = kind === 'mine' ? t.sheet.mine : r.surrendered ? t.sheet.surrendered : t.sheet.answer;
    const verdict = kind === 'answer' && r.surrendered ? 'answer' : present ? 'yes' : 'no';
    const place = round.place;
    const placeName = round.sample?.label ? `${round.sample.label}, ${place.country}` : place.country ?? t.continents[place.continent];
    const records = round.sample
      ? t.sheet.sampleRecords
      : present
        ? t.sheet.recordsValue(ev.inat, ev.gbif)
        : t.sheet.absent;
    const origin = present ? (ev.native ? t.sheet.native : t.sheet.introduced) : '—';
    const tabs =
      entries.length > 1
        ? `<div class="sheet-tabs" role="tablist">${entries
            .map((e, i) => `<button type="button" role="tab" class="sheet-tab" data-tab="${i}" aria-selected="${i === this.sheetTab}">${e.kind === 'mine' ? t.sheet.mine : r.surrendered ? t.verdict.answer : t.sheet.answer}</button>`)
            .join('')}</div>`
        : '';
    const factors = r.score.factors
      .map((f) => `${nf2.format(f.value)} <small>(${f.key === 'rarity' ? t.factor.rarity(t.tiers[tier.id]) : t.factor[f.key]})</small>`)
      .join(' × ');
    const score =
      kind === 'mine'
        ? `<p class="sheet-score ${r.correct ? 'is-ok' : 'is-miss'}"><b>${r.correct ? t.sheet.points(nf.format(r.score.points)) : t.sheet.zero}</b>${r.correct ? `<span>${factors}</span>` : ''}</p>`
        : '';
    const inatUrl = `https://www.inaturalist.org/taxa/${card.taxonId}`;
    return `<article class="specimen">
  <button class="sheet-close" type="button" data-act="map" aria-label="${t.sheet.showMap}">${icon('cross')}</button>
  <figure class="specimen-mount">
    <div class="specimen-plate${photo ? '' : ' is-drawing'}">${plate(card)}</div>
    <figcaption>${
      photo
        ? `${t.sheet.photo}: ${esc(photo.attribution || 'iNaturalist')} · <a href="${inatUrl}" target="_blank" rel="noopener">iNaturalist</a>`
        : round.sample
          ? t.sheet.sampleDrawing
          : t.sheet.noPhoto
    }</figcaption>
  </figure>
  <div class="specimen-label">
    ${tabs}
    ${tabs ? '' : `<p class="sheet-kicker">${esc(kicker)}</p>`}
    <div class="sheet-verdict verdict-${verdict}">${icon(verdict === 'no' ? 'cross' : 'check')}<span>${esc(t.verdict[verdict])}</span></div>
    <header class="sheet-head">
      <p class="sheet-herb">${t.sheet.herbarium} · N.º ${String(this.state.roundNo).padStart(3, '0')}</p>
      <h2 id="sheet-title" class="${n.italic ? 'is-sci' : ''}">${esc(n.main)}</h2>
      ${n.sub ? `<p class="sheet-sci">${esc(n.sub)}</p>` : ''}
      ${stamp(tier, 'stamp stamp-lg')}
    </header>
    <dl class="sheet-facts">
      <div><dt>${t.sheet.group}</dt><dd>${esc(card.group)}</dd></div>
      <div><dt>${t.sheet.locality}</dt><dd>${esc(placeName)}<br><span class="mono">${coords(place.lat, place.lng)}</span></dd></div>
      <div><dt>${t.sheet.radius}</dt><dd>${RADIUS_KM} km</dd></div>
      <div><dt>${t.sheet.records}</dt><dd>${esc(records)}</dd></div>
      <div><dt>${t.sheet.origin}</dt><dd>${esc(origin)}</dd></div>
      ${card.iucn ? `<div><dt>${t.sheet.iucn}</dt><dd><span class="iucn iucn-${card.iucn}">${card.iucn}</span></dd></div>` : ''}
      <div><dt>${t.sheet.views}</dt><dd>${card.views == null ? t.sheet.noViews : t.sheet.viewsValue(nf.format(card.views))}</dd></div>
    </dl>
    <div class="sheet-text" data-extract>${
      card.note
        ? `<p>${esc(card.note)}</p><p class="sheet-source">${t.sheet.sampleNote}</p>`
        : `<p class="sheet-wait">${t.sheet.loadingText}</p>`
    }</div>
    ${others.length && kind === 'answer' ? `<p class="sheet-others">${t.sheet.alsoHere} ${others.map((o) => esc(displayName(o).main)).join(', ')}.</p>` : ''}
    ${score}
    <div class="sheet-actions">
      <button type="button" class="btn btn-primary" data-act="next">${last ? t.sheet.finish : t.sheet.next}${icon('next')}</button>
      <button type="button" class="btn" data-act="map">${icon('map')}${t.sheet.showMap}</button>
      <span class="sheet-links">
        <a href="${inatUrl}" target="_blank" rel="noopener">${t.sheet.inaturalist}${icon('external', 'icon icon-sm')}</a>
        ${card.wikiTitle ? `<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(card.wikiTitle)}" target="_blank" rel="noopener" data-wiki>${t.sheet.wikipedia}${icon('external', 'icon icon-sm')}</a>` : ''}
      </span>
    </div>
  </div>
</article>`;
  }

  private bindSheet(dlg: HTMLDialogElement, r: RoundResult): void {
    dlg.querySelectorAll<HTMLButtonElement>('[data-act="next"]').forEach((b) =>
      b.addEventListener('click', () => {
        this.closeDialog('#sheet');
        this.next();
      }),
    );
    dlg.querySelectorAll<HTMLButtonElement>('[data-act="map"]').forEach((b) => b.addEventListener('click', () => dlg.close()));
    dlg.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        this.sheetTab = Number(b.dataset.tab);
        dlg.innerHTML = this.sheetHtml(r);
        this.bindSheet(dlg, r);
        dlg.querySelector<HTMLButtonElement>(`[data-tab="${this.sheetTab}"]`)?.focus();
        void this.loadExtract(dlg, this.sheetEntries(r)[this.sheetTab].card, r.round);
      }),
    );
  }

  private async loadExtract(dlg: HTMLDialogElement, card: Species, round: Round): Promise<void> {
    if (card.note || round.sample) return;
    const box = dlg.querySelector<HTMLElement>('[data-extract]');
    if (!box) return;
    const s = await wiki.summary({ local: card.sci.replace(/ /g, '_'), en: card.wikiTitle }, 'es').catch(() => null);
    if (!box.isConnected) return;
    if (!s) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = `<p>${esc(s.extract)}</p><p class="sheet-source">${t.sheet.text}: <a href="${esc(s.url)}" target="_blank" rel="noopener">Wikipedia</a> (CC BY-SA 4.0)</p>`;
  }

  private showSheetbar(on: boolean): void {
    const bar = $('#sheetbar');
    bar.hidden = !on;
    if (!on) return;
    const r = this.state.result!;
    const last = this.state.roundNo >= ROUNDS;
    bar.innerHTML = `<span class="sheetbar-sum ${r.correct ? 'is-ok' : 'is-miss'}">${icon(r.correct ? 'check' : r.surrendered ? 'flag' : 'cross')}${
      r.correct ? t.sheet.points(nf.format(r.score.points)) : r.surrendered ? t.sheet.surrendered : t.verdict.no
    }</span>
      <button type="button" class="btn" data-act="sheet">${t.sheet.showSheet}</button>
      <button type="button" class="btn btn-primary" data-act="next">${last ? t.sheet.finish : t.sheet.next}${icon('next')}</button>`;
    bar.querySelector('[data-act="sheet"]')!.addEventListener('click', () => this.openSheet());
    bar.querySelector('[data-act="next"]')!.addEventListener('click', () => this.next());
  }

  private next(): void {
    this.showSheetbar(false);
    this.audio.sfx('tick');
    this.dispatch({ type: 'next' });
    if (this.state.phase === 'loading') void this.loadRound();
  }

  // ---------- Portada, fin, error y diálogos ----------

  private renderMenu(): void {
    const s = this.state;
    const top = best.get();
    const radio = (name: string, value: string, checked: boolean, title: string, desc: string) =>
      `<label class="choice choice-${name}"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span class="choice-title">${esc(title)}</span><span class="choice-desc">${esc(desc)}</span></label>`;
    $('#menu').innerHTML = `
  <div class="menu-inner">
    <figure class="menu-plate">
      <canvas id="fern" aria-hidden="true"></canvas>
      <figcaption>${t.plateCaption}</figcaption>
    </figure>
    <div class="menu-body">
      <p class="eyebrow">${t.eyebrow}</p>
      <h1 id="menu-title">${t.appName}</h1>
      <p class="lede">${t.lede}</p>
      ${
        this.opts.demo
          ? `<p class="demo-note">${t.demoNote}</p>`
          : `<fieldset class="choices">
        <legend>${t.modeLegend}</legend>
        ${radio('mode', 'mundial', s.mode === 'mundial', t.modes.mundial[0], t.modes.mundial[1])}
        ${radio('mode', 'equilibrado', s.mode === 'equilibrado', t.modes.equilibrado[0], t.modes.equilibrado[1])}
      </fieldset>
      <fieldset class="choices choices-row" id="difficulty" ${s.mode === 'mundial' ? '' : 'hidden'}>
        <legend>${t.difficultyLegend}</legend>
        ${(['facil', 'normal', 'dificil'] as const).map((d) => radio('difficulty', d, s.difficulty === d, t.difficulty[d][0], t.difficulty[d][1])).join('')}
      </fieldset>`
      }
      <div class="menu-actions">
        <button id="btn-play" class="btn btn-primary btn-lg" type="button">${t.play}${icon('next')}</button>
        <button id="menu-music" class="btn" type="button"></button>
        <button id="btn-credits" class="btn btn-link" type="button">${icon('info')}${t.credits}</button>
      </div>
      ${top ? `<p class="menu-best">${t.best(nf.format(top))}</p>` : ''}
    </div>
  </div>`;
    this.renderStatic();
    const menu = $('#menu');
    menu.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach((i) =>
      i.addEventListener('change', () => {
        this.state = { ...this.state, mode: i.value as Mode };
        $('#difficulty').hidden = i.value !== 'mundial';
      }),
    );
    menu.querySelectorAll<HTMLInputElement>('input[name="difficulty"]').forEach((i) =>
      i.addEventListener('change', () => (this.state = { ...this.state, difficulty: i.value as Difficulty })),
    );
    $('#btn-play').addEventListener('click', () => void this.start());
    $('#menu-music').addEventListener('click', () => {
      this.audio.toggle();
      prefs.set({ ...prefs.get(), music: this.audio.enabled });
      this.renderStatic();
    });
    $('#btn-credits').addEventListener('click', () => this.openCredits());
    requestAnimationFrame(() => {
      const c = document.querySelector<HTMLCanvasElement>('#fern');
      if (c) drawFern(c, getComputedStyle(document.documentElement).getPropertyValue('--ink').trim());
    });
  }

  private renderEnd(): void {
    const s = this.state;
    const prevBest = best.get();
    const record = s.score > prevBest;
    if (record) best.set(s.score);
    const rows = s.history
      .map((r, i) => {
        const pick = r.round.cards.find((c) => c.taxonId === r.pickedId);
        const p = r.round.place;
        const where = r.round.sample?.label ?? p.country ?? t.continents[p.continent];
        return `<tr><td class="mono">${String(i + 1).padStart(2, '0')}</td><td>${esc(where)}</td><td>${pick ? esc(displayName(pick).main) : `<em>${t.end.surrendered}</em>`}</td><td class="${r.correct ? 'is-ok' : 'is-miss'}">${icon(r.correct ? 'check' : 'cross', 'icon icon-sm')}<span class="sr-only">${r.correct ? t.verdict.yes : t.verdict.no}</span></td><td class="num">${nf.format(r.score.points)}</td></tr>`;
      })
      .join('');
    $('#end').innerHTML = `<div class="end-inner">
      <p class="eyebrow">${t.end.sub(s.history.length)}</p>
      <h2 id="end-title">${t.end.title}</h2>
      <p class="end-score"><b>${nf.format(s.score)}</b> ${t.hud.points}${record && s.score > 0 ? `<span class="stamp stamp-record"><span>${t.end.record}</span></span>` : ''}</p>
      <div class="table-wrap"><table class="ledger">
        <thead><tr><th scope="col">${t.end.col.n}</th><th scope="col">${t.end.col.place}</th><th scope="col">${t.end.col.pick}</th><th scope="col"><span class="sr-only">${t.end.col.result}</span></th><th scope="col" class="num">${t.end.col.pts}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="menu-actions">
        <button type="button" class="btn btn-primary" id="btn-again">${t.end.again}${icon('next')}</button>
        <button type="button" class="btn" id="btn-tomenu">${t.end.menu}</button>
      </div>
    </div>`;
    $('#btn-again').addEventListener('click', () => void this.start());
    $('#btn-tomenu').addEventListener('click', () => this.toMenu());
    $<HTMLButtonElement>('#btn-again').focus();
  }

  private renderError(): void {
    const [title, body] = t.error[this.state.error ?? 'network'];
    $('#error').innerHTML = `<div class="error-inner">
      <svg class="error-draw" viewBox="0 0 100 60" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M10 50 Q30 20 50 30 T90 14"/><path d="M48 31l-6 -10M48 31l8 -9M70 22l-4 -9M70 22l7 -6"/><path d="M8 54h84" stroke-dasharray="2 4"/></svg>
      <h2>${esc(title)}</h2><p>${esc(body)}</p>
      <div class="menu-actions"><button type="button" class="btn btn-primary" id="btn-retry">${t.error.retry}</button><button type="button" class="btn" id="btn-err-menu">${t.error.menu}</button></div>
    </div>`;
    $('#btn-retry').addEventListener('click', () => {
      if (!this.pipeline) {
        void this.start();
        return;
      }
      this.dispatch({ type: 'retry' });
      void this.loadRound();
    });
    $('#btn-err-menu').addEventListener('click', () => this.toMenu());
    $<HTMLButtonElement>('#btn-retry').focus();
  }

  private openExit(): void {
    const dlg = $<HTMLDialogElement>('#exit');
    dlg.innerHTML = `<form method="dialog" class="note">
      <h2 id="exit-title">${t.exit.title}</h2><p>${t.exit.body}</p>
      <div class="menu-actions"><button class="btn" value="stay" autofocus>${t.exit.stay}</button><button class="btn btn-danger" value="leave">${t.exit.leave}</button></div>
    </form>`;
    dlg.onclose = () => {
      if (dlg.returnValue === 'leave') this.toMenu();
    };
    dlg.returnValue = '';
    dlg.showModal();
  }

  private openCredits(): void {
    const dlg = $<HTMLDialogElement>('#credits');
    dlg.innerHTML = `<form method="dialog" class="note">
      <h2 id="credits-title">${t.credits}</h2>
      <dl class="credits">${t.creditsBody.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="menu-actions"><button class="btn" autofocus>${t.close}</button></div>
    </form>`;
    dlg.showModal();
  }

  private closeDialog(sel: string): void {
    const d = document.querySelector<HTMLDialogElement>(sel);
    if (d?.open) d.close();
  }
}
