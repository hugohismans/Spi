<!--
  Moteur de rendu de la spirale de Vogel, réutilisable (plein écran ou en petit).
  Le point i est posé à l'angle i × theta (tours) et au rayon c × √i.

  Le composant possède sa propre boucle requestAnimationFrame :
  - `onframe(dt)` est appelé au début de chaque image (pour animer theta, etc.) ;
  - sans traînée et sans changement de props, rien n'est redessiné ;
  - la boucle se met en veille quand le canvas est hors écran.
-->
<script>
  import { onMount } from 'svelte';
  import { CONFIG, GOLDEN } from '../config.js';
  import { createWebGLRenderer } from '../engine/webgl.js';
  import { createCanvas2DRenderer } from '../engine/canvas2d.js';

  const P = CONFIG.points;

  let {
    theta = GOLDEN,
    count = 2000,
    fallbackCount = undefined, // nombre de points si Canvas 2D (défaut : min(count, config))
    visible = undefined, // n'afficher que les `visible` premiers points (démos pas à pas)
    c = P.c,
    size = P.size,
    softness = P.softness,
    brightness = P.brightness,
    edgeFade = P.edgeFade,
    zoom = 1, // multiplicateur du cadrage automatique
    fit = 'cover', // 'cover' : le disque couvre l'écran ; 'contain' : il tient dedans
    fitScale = 1,
    rotation = 0, // tours
    hue = 0, // décalage de palette (tours)
    trail = 0, // 0..1
    palette = CONFIG.palette,
    onframe = null,
    backend = $bindable(null), // 'webgl' | '2d'
    class: className = '',
  } = $props();

  let host;

  onMount(() => {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    host.appendChild(canvas);

    // Canvas créé ici (et non dans le markup) : si WebGL échoue après avoir
    // obtenu un contexte, on peut repartir d'un canvas neuf pour le 2D.
    let r = createWebGLRenderer(canvas);
    let target = canvas;
    if (!r) {
      target = document.createElement('canvas');
      target.style.cssText = canvas.style.cssText;
      canvas.replaceWith(target);
      r = createCanvas2DRenderer(target);
    }
    if (!r) return () => target.remove();
    backend = r.kind;

    let w = 1;
    let h = 1;
    let dirty = true;
    let onScreen = true;
    let lastKey = '';
    let last = performance.now();
    let raf = 0;

    function measure() {
      const rect = host.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const cap = r.kind === '2d' ? Math.min(1.5, P.maxPixelRatio) : P.maxPixelRatio;
      r.resize(w, h, Math.min(window.devicePixelRatio || 1, cap));
      dirty = true;
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!onScreen) return;
      onframe?.(dt);

      const n = r.kind === '2d' ? (fallbackCount ?? Math.min(count, P.countFallback)) : count;
      const radius = c * Math.sqrt(n);
      const ref = fit === 'contain' ? Math.min(w, h) / 2 : Math.hypot(w, h) / 2;
      const z = ((fitScale * ref) / radius) * zoom;

      const key = `${theta}|${n}|${visible}|${z}|${rotation}|${hue}|${size}|${c}|${w}|${h}`;
      if (!dirty && trail <= 0 && key === lastKey) return;
      lastKey = key;
      dirty = false;

      r.render({
        theta,
        count: n,
        visible,
        c,
        size,
        softness,
        brightness,
        edgeFade,
        zoom: z,
        rotation,
        hue,
        trail,
        palette,
        dt,
      });
    }

    const ro = new ResizeObserver(measure);
    ro.observe(host);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      last = performance.now();
    });
    io.observe(host);
    measure();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      r.destroy();
      target.remove();
    };
  });
</script>

<div class="spiral {className}" bind:this={host}></div>

<style>
  .spiral {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }
</style>
