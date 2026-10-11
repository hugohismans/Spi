# Spi

Des milliers de points en spirale (modèle de Vogel) : le point *i* est posé à l'angle *i × θ* et au rayon *c × √i*.
θ dérive lentement ; aux fractions simples les points s'alignent en rayons, entre deux ils forment des bras de galaxie, et autour du nombre d'or (≈ 137,5°) apparaît le tournesol.

En ligne : https://hugohismans.github.io/Spi/

## Développement

```sh
npm install
npm run dev      # http://localhost:5173/Spi/
npm run build    # build statique dans dist/
```

En mode dev, `window.__spi.theta = 0.4` dans la console fait sauter à un angle.

Chaque push sur `main` déploie sur GitHub Pages (`.github/workflows/deploy.yml`).

## Régler le « feeling »

Tout est dans [`src/config.js`](src/config.js) : nombre et taille des points, coefficient *c*, vitesse de dérive et force du ralentissement près des fractions, traînée, palette, son.

## Commandes cachées

| Geste / touche | Effet |
| --- | --- |
| glisser horizontalement | prendre la main sur θ (relâcher : élan puis retour à l'auto) |
| pincer / molette, `+` `−` | zoom |
| double tap, `T` | afficher θ (tours, degrés, fraction continue, fraction la plus proche) |
| `M` | couper / remettre le son |
| `←` `→` | petit élan |

## Structure

```
src/
  config.js                  tous les réglages
  lib/theta.js               dérive de θ, fractions, fraction continue
  lib/audio-engine.js        nappe Web Audio
  lib/session.js             état conservé entre les pages
  engine/webgl.js            rendu WebGL (sprites, traînée)
  engine/canvas2d.js         fallback Canvas 2D
  components/SpiralRenderer.svelte   moteur de rendu réutilisable
  components/AmbientAudio.svelte     pont entre l'état et l'audio
  components/Experience.svelte       page 1
  components/Explanation.svelte      page 2 (à venir)
  components/ThetaHud.svelte         affichage caché de θ
```
