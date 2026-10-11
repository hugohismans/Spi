/**
 * Fallback Canvas 2D (si WebGL est indisponible).
 * Moins de points, carrés au lieu de disques doux, et un nombre limité de
 * couleurs : les points sont triés par « seau » de teinte pour ne changer de
 * fillStyle que BUCKETS fois par image.
 */

const BUCKETS = 32;
const TAU = Math.PI * 2;

export function createCanvas2DRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  let size = { w: 1, h: 1, dpr: 1 };
  let cap = 0;
  let xs, ys, bk, sx, sy;
  const counts = new Int32Array(BUCKETS + 1);

  function ensure(n) {
    if (n <= cap) return;
    cap = n;
    xs = new Float32Array(n);
    ys = new Float32Array(n);
    bk = new Uint8Array(n);
    sx = new Float32Array(n);
    sy = new Float32Array(n);
  }

  function resize(w, h, dpr) {
    size = { w, h, dpr };
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /** Couleur de la palette cosinus pour t, en chaîne CSS. */
  function paletteColor(p, t) {
    const ch = (k) => {
      const v = p.a[k] + p.b[k] * Math.cos(TAU * (p.c[k] * t + p.d[k]));
      return Math.round(255 * Math.min(1, Math.max(0, v)));
    };
    return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
  }

  function render(f) {
    const W = canvas.width;
    const H = canvas.height;
    const n = Math.min(f.visible ?? f.count, f.count);
    ensure(n);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    let fade = 1;
    if (f.trail > 0) {
      fade = 1 - Math.pow(f.trail, Math.max(f.dt, 1 / 240) * 60);
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
    } else {
      ctx.fillStyle = '#000';
    }
    ctx.fillRect(0, 0, W, H);

    const scale = f.zoom * size.dpr;
    const cx = W / 2;
    const cy = H / 2;
    const s = Math.max(1, f.size * scale * 0.8);
    const p = f.palette;
    counts.fill(0);

    // Passe 1 : positions et seau de couleur
    let m = 0;
    for (let i = 0; i < n; i++) {
      const k = i + 1;
      let turn = k * f.theta;
      turn -= Math.floor(turn);
      const a = (turn + f.rotation) * TAU;
      const r = f.c * Math.sqrt(k) * scale;
      const x = cx + r * Math.cos(a);
      const y = cy - r * Math.sin(a);
      if (x < -s || y < -s || x > W + s || y > H + s) continue;
      let t = f.hue + Math.sqrt(k / f.count) * p.radiusSpan + turn * p.angleSpan;
      t -= Math.floor(t);
      const b = Math.min(BUCKETS - 1, (t * BUCKETS) | 0);
      xs[m] = x;
      ys[m] = y;
      bk[m] = b;
      counts[b + 1]++;
      m++;
    }
    // Passe 2 : tri par seau (comptage)
    for (let b = 0; b < BUCKETS; b++) counts[b + 1] += counts[b];
    const start = counts.slice();
    for (let j = 0; j < m; j++) {
      const at = start[bk[j]]++;
      sx[at] = xs[j];
      sy[at] = ys[j];
    }
    // Passe 3 : un chemin par couleur
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, f.brightness * Math.pow(fade, 0.75));
    const h = s / 2;
    for (let b = 0; b < BUCKETS; b++) {
      if (counts[b + 1] === counts[b]) continue;
      ctx.fillStyle = paletteColor(p, (b + 0.5) / BUCKETS);
      ctx.beginPath();
      for (let j = counts[b]; j < counts[b + 1]; j++) ctx.rect(sx[j] - h, sy[j] - h, s, s);
      ctx.fill();
    }
  }

  return { kind: '2d', resize, render, destroy() {} };
}
