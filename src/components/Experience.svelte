<!--
  Page 1 : l'expérience plein écran.

  - θ dérive seule, lentement (voir lib/theta.js) ;
  - glisser horizontalement prend la main sur θ, relâcher la rend (avec élan) ;
  - pinch / molette : zoom ;
  - double tap ou touche T : affiche θ ; touche M : mute ; flèches : petit élan.
-->
<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { CONFIG } from '../config.js';
  import { buildAttractors, advanceTheta } from '../lib/theta.js';
  import { session, loadMuted, saveMuted } from '../lib/session.js';
  import { getAudioEngine } from '../lib/audio-engine.js';
  import SpiralRenderer from './SpiralRenderer.svelte';
  import AmbientAudio from './AmbientAudio.svelte';
  import ThetaHud from './ThetaHud.svelte';

  const { drift, interaction: ix, view, palette, points, reducedMotion: rm } = CONFIG;
  const attractors = buildAttractors(drift);

  // Plus de points sur grand écran (le disque y est plus grand en pixels)
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const count = shortSide >= points.largeScreenMin ? points.countLarge : points.count;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let theta = $state(session.theta);
  let zoom = $state(session.zoom);
  let rotation = $state(session.rotation);
  let hue = $state(session.hue);
  let reduced = $state(motionQuery.matches);
  let backend = $state(null);
  // Son déjà débloqué lors d'une visite précédente (retour de la page 2) ?
  let started = $state(getAudioEngine(CONFIG.audio).started);
  let muted = $state(loadMuted());
  let hud = $state(false);
  let showHelp = $state(session.elapsed >= CONFIG.ui.helpDelay);
  let energy = $state(0);
  let audio;
  let stage;

  // Nombre de points réellement dessinés (le fallback 2D en dessine moins)
  const drawnCount = $derived(backend === '2d' ? Math.min(count, points.countFallback) : count);
  const trail = $derived(reduced ? rm.trail : CONFIG.trail.amount);
  const autoRate = $derived(reduced ? rm.driftFactor : 1);

  // u : vitesse de dérive signée, en « secondes de dérive auto par seconde ».
  // +1 = dérive automatique normale vers l'avant.
  let u = session.autoDir;
  let dragging = false;
  let dragVel = 0;

  /** Avance θ « vers l'avant » de ds secondes de dérive ; gère les rebonds. */
  function move(ds, pauseBoost = 1) {
    const r = advanceTheta(theta, ds * session.orientation, attractors, drift, drawnCount, pauseBoost);
    theta = r.theta;
    if (r.flipped) session.orientation = -session.orientation;
  }

  /** Appelé par le moteur de rendu au début de chaque image. */
  function onframe(dt) {
    session.elapsed += dt;
    if (!showHelp && session.elapsed >= CONFIG.ui.helpDelay) showHelp = true;

    if (!dragging) {
      // Retour progressif à la dérive automatique (inertie après un lancer)
      const target = session.autoDir * autoRate;
      u += (target - u) * (1 - Math.exp(-dt / ix.inertiaTime));
      // Lancé vite, θ « colle » moins aux fractions
      const boost = 1 + (ix.dragPause - 1) * Math.min(1, Math.max(0, (Math.abs(u) - 2) / 8));
      move(u * dt, boost);
    }
    const speed = dragging ? Math.abs(dragVel) : Math.abs(u - session.autoDir * autoRate);
    energy += (Math.min(1, speed / 25) - energy) * Math.min(1, dt * 3);

    const rf = reduced ? rm.rotationFactor : 1;
    const pf = reduced ? rm.paletteFactor : 1;
    rotation = (rotation + view.rotationSpeed * rf * dt) % 1;
    hue = (hue + palette.speed * pf * dt) % 1;
  }

  // ——— Gestes ———
  const pointers = new Map();
  let lastX = 0;
  let lastT = 0;
  let travel = 0;
  let downT = 0;
  let pinchDist = 0;
  let pinchZoom = 1;
  let lastTap = { t: -1e9, x: 0, y: 0 };

  const clampZoom = (z) => Math.min(view.maxZoom, Math.max(view.minZoom, z));
  const pinchSpan = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };

  function onpointerdown(e) {
    stage.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      dragVel = 0;
      travel = 0;
      lastX = e.clientX;
      lastT = downT = e.timeStamp;
    } else if (pointers.size === 2) {
      pinchDist = pinchSpan();
      pinchZoom = zoom;
      travel = Infinity; // un pinch n'est jamais un tap
    }
  }

  function onpointermove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    travel += Math.hypot(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size >= 2) {
      zoom = clampZoom((pinchZoom * pinchSpan()) / pinchDist);
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dts = Math.max(1, e.timeStamp - lastT) / 1000;
    const ds = dx * ix.dragSecondsPerPx;
    move(ds, ix.dragPause);
    // Vitesse lissée sur ~50 ms (pour l'élan au relâcher)
    const k = Math.min(1, dts / 0.05);
    dragVel += (ds / dts - dragVel) * k;
    lastX = e.clientX;
    lastT = e.timeStamp;
  }

  function onpointerup(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 1) {
      // Fin de pinch : le doigt restant reprend le contrôle de θ, sans à-coup
      const [p] = pointers.values();
      lastX = p.x;
      lastT = e.timeStamp;
      dragVel = 0;
      return;
    }
    if (pointers.size > 0) return;
    if (dragging) {
      dragging = false;
      // Doigt immobile avant de lâcher → pas d'élan
      const held = e.timeStamp - lastT > 90;
      u = held || e.type === 'pointercancel' ? 0 : Math.max(-ix.maxFlick, Math.min(ix.maxFlick, dragVel));
      if (Math.abs(u) > 1) session.autoDir = Math.sign(u);
    }
    if (e.type === 'pointerup' && travel < 12 && e.timeStamp - downT < 350) tap(e);
  }

  function tap(e) {
    const dt = e.timeStamp - lastTap.t;
    if (dt < ix.doubleTapMs && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
      hud = !hud;
      lastTap.t = -1e9;
    } else {
      lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    }
  }

  // Le son doit démarrer dans un « vrai » geste : click et keydown sont fiables partout.
  async function startAudio() {
    if (started) return;
    started = true;
    await audio.start();
  }

  function toggleMute() {
    muted = !muted;
    saveMuted(muted);
  }

  function onkeydown(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === CONFIG.ui.hudKey) hud = !hud;
    else if (key === 'm') toggleMute();
    else if (key === 'arrowright') u = Math.min(ix.maxFlick, u + 10);
    else if (key === 'arrowleft') u = Math.max(-ix.maxFlick, u - 10);
    else if (key === '+' || key === '=') zoom = clampZoom(zoom * 1.15);
    else if (key === '-') zoom = clampZoom(zoom / 1.15);
    else if (key !== ' ' && key !== 'enter') return;
    startAudio();
  }

  onMount(() => {
    // Mode dev uniquement : window.__spi.theta = 0.4 dans la console pour sauter à un angle
    if (import.meta.env.DEV) {
      window.__spi = {
        get theta() { return theta; },
        set theta(t) { theta = t; },
      };
    }

    const onWheel = (e) => {
      e.preventDefault();
      zoom = clampZoom(zoom * Math.exp(-e.deltaY * view.wheelSensitivity));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    const onMotion = () => (reduced = motionQuery.matches);
    motionQuery.addEventListener('change', onMotion);

    return () => {
      stage.removeEventListener('wheel', onWheel);
      motionQuery.removeEventListener('change', onMotion);
      Object.assign(session, { theta, zoom, rotation, hue });
    };
  });
</script>

<svelte:window {onkeydown} />

<main class="experience">
  <!-- Le clavier est géré sur window (T, M, flèches, +/−) : rien à ajouter ici. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <div
    class="stage"
    bind:this={stage}
    role="application"
    aria-label="Spirale de points animée. Glisser horizontalement pour changer l’angle, pincer pour zoomer."
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    onclick={startAudio}
  >
    <SpiralRenderer
      {theta}
      {count}
      fallbackCount={drawnCount}
      {zoom}
      {rotation}
      {hue}
      {trail}
      fitScale={view.fitScale}
      {onframe}
      bind:backend
    />
  </div>

  {#if hud}
    <ThetaHud {theta} {attractors} count={drawnCount} />
  {/if}

  {#if !started}
    <p class="start" out:fade={{ duration: 1200 }}>toucher pour commencer</p>
  {:else}
    <button
      class="mute"
      in:fade={{ duration: 1500, delay: 1500 }}
      onclick={toggleMute}
      aria-pressed={muted}
      aria-label={muted ? 'Activer le son' : 'Couper le son'}
      title={muted ? 'Activer le son (M)' : 'Couper le son (M)'}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {#if muted}
          <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" />
        {:else}
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" />
        {/if}
      </svg>
    </button>
  {/if}

  {#if showHelp}
    <a class="help" href="#/explication" in:fade={{ duration: 2500 }}>Qu’est-ce que je regarde&nbsp;?</a>
  {/if}

  <AmbientAudio bind:this={audio} {theta} {energy} {muted} />
</main>

<style>
  .experience {
    position: fixed;
    inset: 0;
    background: #000;
    overflow: hidden;
  }
  .stage {
    position: absolute;
    inset: 0;
    touch-action: none; /* pas de scroll ni de zoom navigateur : on gère tout */
    cursor: grab;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .stage:active {
    cursor: grabbing;
  }
  .start {
    position: absolute;
    left: 0;
    right: 0;
    bottom: max(9vh, calc(env(safe-area-inset-bottom) + 24px));
    margin: 0;
    text-align: center;
    font-size: 13px;
    font-weight: 300;
    letter-spacing: 0.28em;
    color: rgba(255, 255, 255, 0.55);
    text-shadow: 0 0 12px #000, 0 0 3px #000;
    pointer-events: none;
    animation: breathe 4s ease-in-out infinite;
  }
  @keyframes breathe {
    50% {
      opacity: 0.35;
    }
  }
  .mute,
  .help {
    position: absolute;
    bottom: max(14px, calc(env(safe-area-inset-bottom) + 8px));
    color: rgba(255, 255, 255, 0.5);
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 999px;
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    transition:
      color 0.3s,
      border-color 0.3s;
  }
  .mute:hover,
  .help:hover,
  .mute:focus-visible,
  .help:focus-visible {
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.35);
  }
  .mute {
    right: max(14px, env(safe-area-inset-right));
    width: 40px;
    height: 40px;
    padding: 0;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .help {
    left: max(14px, env(safe-area-inset-left));
    height: 40px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    font-size: 13px;
    font-weight: 300;
    letter-spacing: 0.04em;
    text-decoration: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .start {
      animation: none;
    }
  }
</style>
