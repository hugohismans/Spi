<!-- Affichage caché de θ (touche T ou double tap). -->
<script>
  import { describeTheta } from '../lib/theta.js';

  let { theta, attractors, count } = $props();

  const info = $derived(describeTheta(theta, attractors, count));
  const nearLabel = $derived(
    info.nearest ? (info.nearest.golden ? 'nombre d’or' : `${info.nearest.p}/${info.nearest.q}`) : '',
  );
  const sign = (x) => (x >= 0 ? '+' : '−');
</script>

<div class="hud" aria-live="off">
  <div><span class="k">θ</span> {info.turns.toFixed(7)} tour · {info.degrees.toFixed(4)}°</div>
  <div>
    <span class="k">≈</span> {info.approx.p}/{info.approx.q}
    <span class="dim">[{info.terms[0]}; {info.terms.slice(1).join(', ')}…]</span>
  </div>
  <div>
    <span class="k">→</span> {nearLabel}
    <span class="dim">{sign(info.delta)}{Math.abs(info.delta).toExponential(2)} · torsion {info.twist.toFixed(2)} tour</span>
  </div>
</div>

<style>
  .hud {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(14px, env(safe-area-inset-left));
    font: 12px/1.6 ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    color: rgba(255, 255, 255, 0.78);
    text-shadow: 0 0 6px #000, 0 0 2px #000;
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
  .k {
    display: inline-block;
    width: 1.2em;
    color: rgba(255, 255, 255, 0.45);
  }
  .dim {
    color: rgba(255, 255, 255, 0.45);
    margin-left: 0.4em;
  }
</style>
