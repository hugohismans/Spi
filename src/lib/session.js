/**
 * État conservé entre les pages (sans rechargement) : quand on revient de la
 * page explicative, l'expérience reprend là où on l'avait laissée.
 */
import { CONFIG } from '../config.js';

export const session = {
  theta: CONFIG.drift.start,
  orientation: 1, // ±1 : sens « vers l'avant » ; s'inverse à chaque rebond
  autoDir: 1, // sens de la dérive automatique (+1 = vers l'avant)
  zoom: 1,
  rotation: 0,
  hue: 0,
  elapsed: 0, // secondes passées sur l'expérience
};

const MUTE_KEY = 'spi.muted';

export function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(m) {
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* stockage indisponible : tant pis */
  }
}
