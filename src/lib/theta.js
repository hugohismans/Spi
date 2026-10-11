/**
 * Dérive de θ et outils d'affichage.
 *
 * Idée : près d'une fraction p/q (ou du nombre d'or), l'aspect du motif dépend
 * de la torsion N × |θ − p/q| (en tours, au bord du disque). Pour que les
 * motifs se forment à un rythme régulier, on fait varier θ à une vitesse
 * proportionnelle à la distance à l'attracteur le plus proche : la torsion est
 * alors divisée/multipliée par un facteur constant chaque seconde.
 * Un petit plancher (« pause ») permet de franchir la fraction.
 */
import { GOLDEN } from '../config.js';

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Fractions irréductibles p/q (q ≤ maxDenominator) dans [min, max], plus le nombre d'or. */
export function buildAttractors(drift) {
  const list = [];
  for (let q = 1; q <= drift.maxDenominator; q++) {
    for (let p = 0; p <= q; p++) {
      if (gcd(p, q) !== 1) continue;
      const value = p / q;
      if (value < drift.min - 1e-12 || value > drift.max + 1e-12) continue;
      list.push({ value, p, q, weight: Math.pow(q / 2, drift.denominatorWeight), pause: 1 });
    }
  }
  if (GOLDEN >= drift.min && GOLDEN <= drift.max) {
    list.push({ value: GOLDEN, p: null, q: null, golden: true, ...drift.golden });
  }
  return list.sort((a, b) => a.value - b.value);
}

/**
 * Vitesse de dérive locale (tours/s, positive) et taux logarithmique (1/s).
 * pauseBoost > 1 rend les fractions moins « collantes » (mode manuel).
 */
export function driftSpeed(theta, attractors, drift, count, pauseBoost = 1) {
  const floor = (drift.pause / count) * pauseBoost;
  let speed = Infinity;
  let rate = 0;
  for (const a of attractors) {
    const k = drift.logRate * a.weight;
    const v = k * (Math.abs(theta - a.value) + floor * a.pause);
    if (v < speed) {
      speed = v;
      rate = k;
    }
  }
  return speed < drift.maxSpeed ? { speed, rate } : { speed: drift.maxSpeed, rate: 0 };
}

/**
 * Avance θ de `driftSeconds` secondes de dérive (signé), avec rebond sur [min, max].
 * Renvoie le nouveau θ et `flipped` si un nombre impair de rebonds a eu lieu.
 */
export function advanceTheta(theta, driftSeconds, attractors, drift, count, pauseBoost = 1) {
  let remaining = Math.abs(driftSeconds);
  let sign = Math.sign(driftSeconds);
  let flipped = false;
  for (let guard = 0; remaining > 1e-9 && guard < 600; guard++) {
    const { speed, rate } = driftSpeed(theta, attractors, drift, count, pauseBoost);
    // Pas limité pour que la distance à la fraction ne change pas de plus de ~20 %
    const h = Math.min(remaining, rate > 0 ? 0.2 / rate : 0.1);
    theta += sign * speed * h;
    remaining -= h;
    if (theta > drift.max) {
      theta = 2 * drift.max - theta;
      sign = -sign;
      flipped = !flipped;
    } else if (theta < drift.min) {
      theta = 2 * drift.min - theta;
      sign = -sign;
      flipped = !flipped;
    }
  }
  return { theta, flipped };
}

/** Développement en fraction continue [a0; a1, a2, …] et réduites p/q. */
export function continuedFraction(x, maxTerms = 12, maxDen = 1e6) {
  const terms = [];
  const convergents = [];
  let [p0, q0, p1, q1] = [0, 1, 1, 0];
  let r = x;
  for (let k = 0; k < maxTerms; k++) {
    const a = Math.floor(r);
    const p = a * p1 + p0;
    const q = a * q1 + q0;
    if (q > maxDen) break;
    terms.push(a);
    convergents.push({ p, q });
    [p0, q0, p1, q1] = [p1, q1, p, q];
    const frac = r - a;
    if (frac < 1e-10) break;
    r = 1 / frac;
  }
  return { terms, convergents };
}

/** Tout ce qu'affiche le HUD caché. */
export function describeTheta(theta, attractors, count) {
  const { terms, convergents } = continuedFraction(theta, 9, 5000);
  // Réduite la plus simple qui « explique » le motif à cette échelle (erreur < 1/N)
  const approx = convergents.find((c) => Math.abs(theta - c.p / c.q) < 1 / count) ?? convergents.at(-1);
  let nearest = null;
  for (const a of attractors) {
    if (!nearest || Math.abs(theta - a.value) < Math.abs(theta - nearest.value)) nearest = a;
  }
  return {
    turns: theta,
    degrees: theta * 360,
    terms,
    approx,
    nearest,
    delta: nearest ? theta - nearest.value : 0,
    // Torsion au bord du disque, en tours : < ~0,2 → rayons droits / motif net
    twist: nearest ? count * (theta - nearest.value) : 0,
  };
}
