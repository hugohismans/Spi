<!--
  Routage par hash : GitHub Pages ne sait pas servir des routes côté client,
  mais #/explication fonctionne au rechargement et en lien direct.
-->
<script>
  import Experience from './components/Experience.svelte';
  import Explanation from './components/Explanation.svelte';

  const readRoute = () => location.hash.replace(/^#/, '') || '/';
  let route = $state(readRoute());

  $effect(() => {
    const onHash = () => {
      route = readRoute();
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });
</script>

{#if route.startsWith('/explication')}
  <Explanation />
{:else}
  <Experience />
{/if}
