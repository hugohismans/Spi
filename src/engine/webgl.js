/**
 * Rendu WebGL 1 : un point-sprite par graine.
 *
 * Précision : pour 20 000+ points, i × θ dépasse la précision d'un float32
 * (erreur visible au bord du disque). On calcule donc fract(i × θ) en double
 * précision côté CPU (20 000 multiplications : négligeable) et on n'envoie au
 * GPU que la fraction de tour, dans [0, 1). Le reste (cos/sin, couleur) est
 * fait dans le shader.
 *
 * Traînée : le tampon est conservé d'une image à l'autre et assombri par un
 * quad plein écran. Un 2e passage soustrait 1,5/255 pour effacer les résidus
 * que l'arrondi 8 bits laisse sinon indéfiniment (« fantômes »).
 */

const POINT_VS = `
precision highp float;
attribute float a_index;   // i (1..N)
attribute float a_turn;    // fract(i·θ), en tours
uniform vec2  u_half;      // demi-taille du canvas (px CSS)
uniform float u_c;
uniform float u_zoom;
uniform float u_rotation;  // tours
uniform float u_size;      // diamètre (px CSS à zoom 1)
uniform float u_dpr;
uniform float u_count;
uniform float u_hue;
uniform float u_radiusSpan;
uniform float u_angleSpan;
uniform float u_intensity;
uniform float u_edgeFade;
uniform vec3 u_pa, u_pb, u_pc, u_pd;
varying vec3 v_color;

void main() {
  float ang = (a_turn + u_rotation) * 6.28318530718;
  float r = u_c * sqrt(a_index) * u_zoom;
  gl_Position = vec4(r * vec2(cos(ang), sin(ang)) / u_half, 0.0, 1.0);

  // Taille physique ; sous 1,5 px on garde 1,5 px mais on atténue (pas de scintillement)
  float px = u_size * u_zoom * u_dpr;
  float drawn = max(px, 1.5);
  gl_PointSize = drawn;
  float cover = min(1.0, (px * px) / (drawn * drawn));

  float rn = sqrt(a_index / u_count);           // rayon normalisé 0..1
  float edge = 1.0 - smoothstep(1.0 - u_edgeFade, 1.0, rn);
  float t = u_hue + rn * u_radiusSpan + a_turn * u_angleSpan;
  vec3 col = u_pa + u_pb * cos(6.28318530718 * (u_pc * t + u_pd));
  v_color = clamp(col, 0.0, 1.0) * (u_intensity * edge * cover);
}`;

const POINT_FS = `
precision mediump float;
uniform float u_softness;
varying vec3 v_color;
void main() {
  float d = length(gl_PointCoord * 2.0 - 1.0);
  if (d > 1.0) discard;
  float a = 1.0 - smoothstep(1.0 - u_softness, 1.0, d);
  gl_FragColor = vec4(v_color * a, 1.0);
}`;

const QUAD_VS = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const QUAD_FS = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }`;

const RESIDUE = 1.5 / 255;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {};
  const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nu; i++) {
    const name = gl.getActiveUniform(p, i).name;
    loc[name] = gl.getUniformLocation(p, name);
  }
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) {
    const name = gl.getActiveAttrib(p, i).name;
    loc[name] = gl.getAttribLocation(p, name);
  }
  return { p, loc };
}

/** Renvoie un renderer WebGL, ou null si WebGL est indisponible. */
export function createWebGLRenderer(canvas) {
  const attrs = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true, // nécessaire pour la traînée
    powerPreference: 'high-performance',
  };
  const gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
  if (!gl) return null;

  let points, quad, indexBuf, turnBuf, quadBuf;
  let capacity = 0;
  let turns = new Float32Array(0);
  let lost = false;
  let size = { w: 1, h: 1, dpr: 1 };

  function init() {
    points = program(gl, POINT_VS, POINT_FS);
    quad = program(gl, QUAD_VS, QUAD_FS);
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    indexBuf = gl.createBuffer();
    turnBuf = gl.createBuffer();
    const n = capacity;
    capacity = 0;
    ensure(n);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Alloue les tampons pour n points (indices statiques, angles dynamiques). */
  function ensure(n) {
    if (n <= capacity) return;
    capacity = n;
    const idx = new Float32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i + 1;
    gl.bindBuffer(gl.ARRAY_BUFFER, indexBuf);
    gl.bufferData(gl.ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    turns = new Float32Array(n);
    gl.bindBuffer(gl.ARRAY_BUFFER, turnBuf);
    gl.bufferData(gl.ARRAY_BUFFER, turns.byteLength, gl.DYNAMIC_DRAW);
  }

  try {
    init();
  } catch (err) {
    console.warn('WebGL indisponible :', err);
    return null;
  }

  const onLost = (e) => {
    e.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    lost = false;
    init();
    resize(size.w, size.h, size.dpr);
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  function resize(w, h, dpr) {
    size = { w, h, dpr };
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    if (lost) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function drawQuad(r, g, b, a) {
    gl.uniform4f(quad.loc.u_color, r, g, b, a);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** f : { theta, count, visible, c, size, zoom, rotation, hue, trail, dt, palette, ... } */
  function render(f) {
    if (lost) return;
    ensure(f.count);
    const n = Math.min(f.visible ?? f.count, f.count);

    // 1. Fond : effacement, ou fondu de l'image précédente (traînée)
    let fade = 1;
    if (f.trail > 0) {
      fade = 1 - Math.pow(f.trail, Math.max(f.dt, 1 / 240) * 60);
      gl.useProgram(quad.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(quad.loc.a_pos);
      gl.vertexAttribPointer(quad.loc.a_pos, 2, gl.FLOAT, false, 0, 0);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
      drawQuad(0, 0, 0, fade);
      gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
      gl.blendFunc(gl.ONE, gl.ONE);
      drawQuad(RESIDUE, RESIDUE, RESIDUE, 0);
      gl.blendEquation(gl.FUNC_ADD);
      gl.disableVertexAttribArray(quad.loc.a_pos);
    } else {
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    if (n <= 0) return;

    // 2. Angles en double précision → float32
    const th = f.theta;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) * th;
      turns[i] = t - Math.floor(t);
    }

    // 3. Points (fusion additive)
    const { loc } = points;
    gl.useProgram(points.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, indexBuf);
    gl.enableVertexAttribArray(loc.a_index);
    gl.vertexAttribPointer(loc.a_index, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, turnBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, turns.subarray(0, n));
    gl.enableVertexAttribArray(loc.a_turn);
    gl.vertexAttribPointer(loc.a_turn, 1, gl.FLOAT, false, 0, 0);

    const p = f.palette;
    gl.uniform2f(loc.u_half, size.w / 2, size.h / 2);
    gl.uniform1f(loc.u_c, f.c);
    gl.uniform1f(loc.u_zoom, f.zoom);
    gl.uniform1f(loc.u_rotation, f.rotation);
    gl.uniform1f(loc.u_size, f.size);
    gl.uniform1f(loc.u_dpr, size.dpr);
    gl.uniform1f(loc.u_count, f.count);
    gl.uniform1f(loc.u_hue, f.hue);
    gl.uniform1f(loc.u_radiusSpan, p.radiusSpan);
    gl.uniform1f(loc.u_angleSpan, p.angleSpan);
    // Avec traînée, chaque image n'ajoute qu'une partie de la lumière,
    // pour que la luminosité d'un point immobile reste comparable.
    gl.uniform1f(loc.u_intensity, f.brightness * Math.pow(fade, 0.75));
    gl.uniform1f(loc.u_edgeFade, f.edgeFade);
    gl.uniform1f(loc.u_softness, f.softness);
    gl.uniform3fv(loc.u_pa, p.a);
    gl.uniform3fv(loc.u_pb, p.b);
    gl.uniform3fv(loc.u_pc, p.c);
    gl.uniform3fv(loc.u_pd, p.d);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disableVertexAttribArray(loc.a_index);
    gl.disableVertexAttribArray(loc.a_turn);
  }

  function destroy() {
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  return { kind: 'webgl', resize, render, destroy };
}
