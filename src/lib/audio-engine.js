/**
 * Nappe ambiante générée en Web Audio (aucun fichier).
 *
 *   voix (2 oscillateurs désaccordés chacune, « respiration » lente)
 *     → filtre passe-bas (ondulation lente + énergie du geste)
 *     → sec + deux échos panoramisés (gauche / droite)
 *     → volume général
 *
 * Les voix « follow » jouent baseFrequency × (1 + θ) : quand θ est une fraction
 * simple p/q, l'intervalle (q + p)/q est consonant (quinte, quarte, tierce…) ;
 * près d'une fraction on entend des battements qui ralentissent ; autour du
 * nombre d'or l'intervalle est le plus « irrationnel » possible.
 *
 * Un seul moteur pour toute l'application : le contexte audio, une fois
 * débloqué par un geste, survit au passage par la page explicative.
 */

let shared = null;

export function getAudioEngine(cfg) {
  shared ??= new AmbientEngine(cfg);
  return shared;
}

class AmbientEngine {
  constructor(cfg) {
    this.cfg = cfg;
    this.ctx = null;
    this.theta = 0.38;
    this.energy = 0;
    this.muted = false;
    this.active = false; // la page d'expérience est affichée
    this.lastUpdate = 0;
    this.onVisibility = () => this.#syncRunning();
  }

  get started() {
    return this.ctx !== null;
  }

  /** À appeler dans un gestionnaire de geste (click, keydown) la première fois. */
  async start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.#build();
      document.addEventListener('visibilitychange', this.onVisibility);
    }
    this.active = true;
    await this.#syncRunning();
    this.#applyVolume(this.cfg.fadeIn);
    return this.ctx.state === 'running';
  }

  /** Reprise silencieuse après retour sur la page (contexte déjà débloqué). */
  resume() {
    if (!this.ctx) return;
    this.active = true;
    this.#syncRunning();
    this.#applyVolume(1.5);
  }

  /** Fondu de sortie puis mise en veille (changement de page). */
  pause() {
    if (!this.ctx) return;
    this.active = false;
    this.#applyVolume(0.4);
    setTimeout(() => this.#syncRunning(), 600);
  }

  setMuted(m) {
    this.muted = m;
    this.#applyVolume(0.6);
  }

  setTheta(theta) {
    this.theta = theta;
    this.#update();
  }

  /** 0..1 : intensité du geste en cours (ouvre le filtre). */
  setEnergy(e) {
    this.energy = e;
    this.#update();
  }

  async #syncRunning() {
    if (!this.ctx) return;
    const want = this.active && document.visibilityState === 'visible';
    try {
      if (want && this.ctx.state !== 'running') await this.ctx.resume();
      else if (!want && this.ctx.state === 'running') await this.ctx.suspend();
    } catch {
      /* certains navigateurs refusent hors geste : on réessaiera au prochain */
    }
  }

  #applyVolume(time) {
    if (!this.ctx) return;
    const g = this.nodes.master.gain;
    const target = this.active && !this.muted ? this.cfg.volume : 0;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + Math.max(0.01, time));
  }

  #update() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastUpdate < 0.05) return; // ~20 mises à jour / s suffisent
    this.lastUpdate = now;
    const { baseFrequency, glide, filter } = this.cfg;
    const ratio = 1 + this.theta;
    for (const v of this.nodes.voices) {
      const f = baseFrequency * Math.pow(2, v.octave) * (v.follow ? ratio : 1);
      for (const o of v.oscs) o.frequency.setTargetAtTime(f, now, glide);
    }
    const cutoff = filter.cutoff + filter.energyBoost * this.energy;
    this.nodes.filter.frequency.setTargetAtTime(cutoff, now, 0.3);
  }

  #build() {
    const ctx = this.ctx;
    const { voices, detuneCents, filter: fc, echo, breathing } = this.cfg;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = fc.cutoff;
    filter.Q.value = fc.q;

    // Ondulation lente du filtre
    const lfo = ctx.createOscillator();
    lfo.frequency.value = fc.lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = fc.lfoDepth;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    // Son direct
    const dry = ctx.createGain();
    dry.gain.value = 1 - echo.wet * 0.5;
    filter.connect(dry).connect(master);

    // Deux échos à rétroaction, un à gauche, un à droite (temps légèrement différents)
    for (const side of [-1, 1]) {
      const delay = ctx.createDelay(2);
      delay.delayTime.value = echo.time * (1 + side * 0.17);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = echo.tone;
      const fb = ctx.createGain();
      fb.gain.value = echo.feedback;
      const wet = ctx.createGain();
      wet.gain.value = echo.wet;
      filter.connect(delay);
      delay.connect(tone);
      tone.connect(fb).connect(delay);
      let out = wet;
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = side * 0.7;
        wet.connect(pan);
        out = pan;
      }
      tone.connect(wet);
      out.connect(master);
    }

    // Voix
    const ratio = 1 + this.theta;
    const built = voices.map((v) => {
      const gain = ctx.createGain();
      gain.gain.value = v.gain;
      // Respiration : chaque voix a sa propre ondulation très lente de volume
      const breath = ctx.createOscillator();
      breath.frequency.value = breathing.rateMin + Math.random() * (breathing.rateMax - breathing.rateMin);
      const breathGain = ctx.createGain();
      breathGain.gain.value = v.gain * breathing.depth;
      breath.connect(breathGain).connect(gain.gain);
      breath.start();

      const f = this.cfg.baseFrequency * Math.pow(2, v.octave) * (v.follow ? ratio : 1);
      const oscs = [-1, 1].map((s) => {
        const o = ctx.createOscillator();
        o.type = v.type;
        o.frequency.value = f;
        o.detune.value = s * detuneCents;
        const half = ctx.createGain();
        half.gain.value = 0.5;
        o.connect(half).connect(gain);
        o.start();
        return o;
      });
      gain.connect(filter);
      return { ...v, oscs };
    });

    this.nodes = { master, filter, voices: built };
  }
}
