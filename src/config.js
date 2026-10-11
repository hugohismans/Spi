/**
 * Tous les réglages du « feeling » au même endroit.
 *
 * Unités : θ en tours (1 = 360°), temps en secondes, tailles en px CSS.
 * Rappel du modèle : le point i est posé à l'angle i × θ et au rayon c × √i.
 */

/** Nombre d'or « côté petit angle » : 2 − φ ≈ 0,381966 tour ≈ 137,5°. */
export const GOLDEN = (3 - Math.sqrt(5)) / 2;

export const CONFIG = {
  points: {
    count: 20000, // nombre de points (téléphones, écrans moyens)
    countLarge: 40000, // si le petit côté de l'écran ≥ largeScreenMin
    largeScreenMin: 820,
    countFallback: 4000, // si WebGL est indisponible (Canvas 2D, bien plus lent)
    c: 3, // rayon du point i = c × √i (px CSS à zoom 1)
    size: 2.6, // diamètre d'un point (px CSS à zoom 1). Le rapport size / c fixe la « densité »
    softness: 0.6, // 0 = disque net, 1 = halo très doux
    brightness: 0.9, // intensité lumineuse de chaque point (fusion additive)
    edgeFade: 0.06, // fondu du bord du disque (fraction du rayon total)
    maxPixelRatio: 2, // plafond de densité de pixels (perf mobile)
  },

  view: {
    // Le disque est cadré pour couvrir l'écran : 1 = il touche pile les coins.
    fitScale: 1.04,
    minZoom: 0.2,
    maxZoom: 12,
    wheelSensitivity: 0.0015, // zoom molette
    rotationSpeed: 0.004, // rotation globale très lente (tours / s)
  },

  drift: {
    start: GOLDEN - 6e-5, // on démarre juste avant le tournesol
    min: 1 / 6, // θ rebondit entre min et max (θ et 1 − θ donnent des images miroirs)
    max: 1 / 2,
    maxSpeed: 0.003, // vitesse plafond loin de toute fraction (tours / s)
    // Près d'une fraction p/q, la vitesse est proportionnelle à la distance :
    // la distance est divisée par e^logRate chaque seconde (approche « logarithmique »).
    // Plus petit = ralentissement plus fort, les motifs se forment plus lentement.
    logRate: 0.15,
    // « Temps d'arrêt » pile sur la fraction, en tours de torsion au bord du disque.
    // Plus petit = on reste plus longtemps sur les rayons droits.
    pause: 0.15,
    maxDenominator: 13, // fractions p/q prises en compte (q ≤ ...)
    // Les grands dénominateurs ralentissent moins : vitesse × (q/2)^denominatorWeight.
    denominatorWeight: 0.6,
    golden: {
      weight: 0.5, // < 1 : on s'attarde plus longtemps autour du nombre d'or
      pause: 0.5, // multiplicateur du temps d'arrêt (plus petit = plus long)
    },
  },

  interaction: {
    dragSecondsPerPx: 0.25, // 1 px glissé = autant de secondes de dérive automatique
    dragPause: 8, // en manuel, les fractions « collent » moins (× drift.pause)
    inertiaTime: 1.2, // constante de temps du retour à l'animation auto après un lancer (s)
    maxFlick: 80, // vitesse max d'un lancer (× vitesse auto)
    doubleTapMs: 320,
  },

  trail: {
    amount: 0.55, // 0 = pas de traînée ; 0,9 = longues traînées (max conseillé 0,95)
  },

  palette: {
    speed: 0.012, // rotation de la palette (tours de teinte / s)
    radiusSpan: 1.5, // nombre de cycles de couleurs du centre au bord
    angleSpan: 1, // cycles de couleurs sur un tour (garder un entier)
    // Palette cosinus (Inigo Quilez) : couleur(t) = a + b · cos(2π (c·t + d))
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67],
  },

  audio: {
    volume: 0.22, // volume général (0 – 1)
    fadeIn: 5, // montée du son au démarrage (s)
    baseFrequency: 110, // La2 ; les voix « follow » jouent baseFrequency × (1 + θ)
    detuneCents: 7, // chaque voix = 2 oscillateurs légèrement désaccordés (battements doux)
    glide: 0.15, // lissage des changements de hauteur (constante de temps, s)
    // octave : décalage en octaves ; follow : la hauteur suit l'intervalle (1 + θ)
    // θ = 1/2 → quinte, 1/3 → quarte, 1/4 → tierce majeure, nombre d'or → intervalle « le plus irrationnel »
    voices: [
      { type: 'sine', octave: -1, follow: false, gain: 0.32 },
      { type: 'triangle', octave: 0, follow: false, gain: 0.2 },
      { type: 'sawtooth', octave: 0, follow: true, gain: 0.07 },
      { type: 'sawtooth', octave: 1, follow: true, gain: 0.03 },
      { type: 'sine', octave: 2, follow: true, gain: 0.025 },
    ],
    breathing: { rateMin: 0.02, rateMax: 0.07, depth: 0.35 }, // respiration lente de chaque voix
    filter: {
      cutoff: 750, // Hz, filtre passe-bas
      q: 3,
      lfoRate: 0.035, // ondulation lente du filtre (Hz)
      lfoDepth: 350, // Hz
      energyBoost: 1600, // Hz ajoutés quand on manipule θ vite
    },
    echo: { time: 0.43, feedback: 0.45, wet: 0.35, tone: 1600 },
  },

  ui: {
    helpDelay: 30, // le bouton « Qu'est-ce que je regarde ? » apparaît après (s)
    hudKey: 't', // touche qui affiche θ (ou double tap)
  },

  // prefers-reduced-motion : animation ralentie, sans traînée.
  reducedMotion: {
    driftFactor: 0.35,
    rotationFactor: 0.25,
    paletteFactor: 0.3,
    trail: 0,
  },
};
