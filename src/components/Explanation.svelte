<!--
  Page 2 : l'explication. Pour l'instant une ébauche (étape suivante du projet) ;
  la petite démo vérifie déjà que le moteur de rendu se réutilise en petit.
-->
<script>
  import { GOLDEN } from '../config.js';
  import SpiralRenderer from './SpiralRenderer.svelte';
</script>

<main class="explain">
  <div class="demo">
    <SpiralRenderer theta={GOLDEN} count={600} size={4.5} fit="contain" fitScale={0.92} />
  </div>
  <h1>Qu’est-ce que je regarde&nbsp;?</h1>
  <p>Une seule règle&nbsp;: tourne d’un angle, pose un point, recommence.</p>
  <p class="soon">L’explication complète arrive bientôt.</p>
  <a class="back" href="#/">← Retour à la spirale</a>
</main>

<style>
  .explain {
    min-height: 100dvh;
    max-width: 640px;
    margin: 0 auto;
    padding: 48px 16px;
    box-sizing: border-box;
    color: rgba(255, 255, 255, 0.86);
    text-align: center;
  }
  .demo {
    width: min(70vw, 280px);
    aspect-ratio: 1;
    margin: 0 auto 32px;
    border-radius: 50%;
    overflow: hidden;
  }
  h1 {
    font-weight: 300;
    font-size: 26px;
    letter-spacing: 0.02em;
  }
  p {
    font-size: 17px;
    line-height: 1.6;
    font-weight: 300;
  }
  .soon {
    color: rgba(255, 255, 255, 0.45);
    font-size: 14px;
  }
  .back {
    display: inline-block;
    margin-top: 24px;
    padding: 10px 18px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.75);
    text-decoration: none;
  }
  .back:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.45);
  }
</style>
