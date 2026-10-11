<!--
  Nappe sonore : composant sans rendu visuel qui relie l'état de l'expérience
  (θ, énergie du geste, mute) au moteur Web Audio partagé.
  Le parent appelle `start()` depuis un geste utilisateur (exigence des navigateurs).
-->
<script>
  import { onMount } from 'svelte';
  import { CONFIG } from '../config.js';
  import { getAudioEngine } from '../lib/audio-engine.js';

  let { theta, energy = 0, muted = false } = $props();

  const engine = getAudioEngine(CONFIG.audio);

  /** Démarre (ou reprend) le son. Renvoie true si le contexte tourne. */
  export function start() {
    return engine.start();
  }

  $effect(() => engine.setTheta(theta));
  $effect(() => engine.setEnergy(energy));
  $effect(() => engine.setMuted(muted));

  onMount(() => {
    if (engine.started) engine.resume();
    return () => engine.pause();
  });
</script>
