import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Site de projet GitHub Pages : servi sous https://hugohismans.github.io/Spi/
// (nom du repo déduit du remote git). Si le repo est renommé, changer ici.
const REPO = 'Spi';

export default defineConfig({
  base: `/${REPO}/`,
  plugins: [svelte()],
});
