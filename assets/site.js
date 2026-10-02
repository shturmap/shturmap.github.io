// Shturmap website behaviour. Everything here is optional: without JS, WebGL or a wide screen the page is complete.
//  - Header brand: hidden while the hero's own logo and text are on screen, slides in once they have scrolled away.
//  - Route (wide screens): a WebGL map-sheet background (grid, faint contours) with a dashed route through the
//    section numbers. A marker follows the reading line, pings on reaching a section, and the NEXT readout jumps
//    to the next one. Redraws only on scroll, resize or a running ping; reduced motion snaps the marker, no pings.
//  - Loupe (wide screens with a mouse): a 2x WebGL magnifier on the in-raid screenshot, redrawn on pointer moves.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wide = window.matchMedia('(min-width: 761px)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');

  // ---------- Header brand ----------
  var brand = document.getElementById('brand');
  var heroText = document.getElementById('hero-text');
  function showBrand(on) {
    brand.classList.toggle('in', on);
    brand.inert = !on;
    if (on) brand.removeAttribute('aria-hidden'); else brand.setAttribute('aria-hidden', 'true');
  }
  if (brand && heroText && 'IntersectionObserver' in window) {
    var headH = function () { return document.querySelector('.site-head').getBoundingClientRect().height; };
    var observer = new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      showBrand(!e.isIntersecting && e.boundingClientRect.bottom < headH() + 1);
    }, { rootMargin: '-' + Math.round(headH()) + 'px 0px 0px 0px', threshold: 0 });
    observer.observe(heroText);
  } else if (brand) {
    showBrand(true);
  }

  // ---------- The route: section anchors and a patrol line through them (no WebGL needed) ----------
  var readout = document.getElementById('readout');
  var readoutText = document.getElementById('readout-text');
  var sections = Array.prototype.slice.call(document.querySelectorAll('section[data-ref]'));
  var anchors = [], pts = [], cum = [], anchorAt = [];
  var bandMin = 0, bandMax = 0;
  var marker = { x: 0, y: 0, s: 0, dx: 0, dy: 1 };
  var lastReached = null;

  function measure() {
    anchors = sections.map(function (s) {
      var r = s.querySelector('.b-num').getBoundingClientRect();
      return { x: r.left + window.scrollX + 4, y: r.top + window.scrollY, ref: s.getAttribute('data-ref'), name: s.getAttribute('data-name'), el: s };
    });
    pts = []; anchorAt = [];
    anchors.forEach(function (a, i) {
      if (i > 0) {
        var p = anchors[i - 1], gap = a.y - p.y, h = Math.min(gap * 0.2, 160), w = 28;
        if (gap > 2 * (h + w) + 20) {
          pts.push({ x: p.x, y: p.y + h }, { x: p.x + w, y: p.y + h + w }, { x: p.x + w, y: a.y - h - w }, { x: a.x, y: a.y - h });
        }
      }
      anchorAt.push(pts.length);
      pts.push({ x: a.x, y: a.y });
    });
    cum = [0];
    bandMin = Infinity; bandMax = -Infinity;
    pts.forEach(function (p, i) {
      if (i > 0) cum.push(cum[i - 1] + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y));
      bandMin = Math.min(bandMin, p.x); bandMax = Math.max(bandMax, p.x);
    });
  }

  // The point on the route at a document height (the route only ever goes down).
  function atY(y) {
    var first = pts[0], last = pts[pts.length - 1];
    if (y <= first.y) return { x: first.x, y: first.y, s: 0, dx: 0, dy: 1 };
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      if (y <= b.y) {
        var t = (y - a.y) / Math.max(1e-6, b.y - a.y), len = Math.max(1e-6, cum[i] - cum[i - 1]);
        return { x: a.x + (b.x - a.x) * t, y: y, s: cum[i - 1] + t * len, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len };
      }
    }
    return { x: last.x, y: last.y, s: cum[cum.length - 1], dx: 0, dy: 1 };
  }

  function update(now) {
    if (pts.length < 2) return;
    var vh = window.innerHeight;
    var readY = window.scrollY + vh * 0.35;
    // Near the bottom the reading line slides down, so the last section can be reached.
    var left = root.scrollHeight - vh - window.scrollY;
    if (left < vh * 0.65) readY += vh * 0.65 - Math.max(0, left);
    var reached = -1;
    anchors.forEach(function (a, i) { if (a.y <= readY + 1) reached = i; });
    if (reduced.matches) {
      var k = anchorAt[Math.max(0, reached)];
      marker = { x: pts[k].x, y: pts[k].y, s: cum[k], dx: 0, dy: 1 };
    } else {
      marker = atY(readY);
    }
    if (lastReached !== null && reached > lastReached && !reduced.matches) {
      bg.ping = { x: anchors[reached].x, y: anchors[reached].y, t: now };
    }
    lastReached = reached;
    var next = reached + 1;
    if (next < anchors.length) {
      var a = anchors[next];
      var metres = Math.max(10, Math.round((cum[anchorAt[next]] - marker.s) * 0.05) * 10);
      readoutText.textContent = (next === anchors.length - 1 ? 'EXIT' : 'NEXT') + ' · ' + a.ref + ' ' + a.name.toUpperCase() + ' · ' + metres.toLocaleString('en-US') + ' m AHEAD';
      readout.setAttribute('data-target', String(next));
      readout.setAttribute('aria-label', 'Jump to ' + a.ref + ', ' + a.name);
    } else {
      readoutText.textContent = 'BACK TO A1 · TOP';
      readout.setAttribute('data-target', '0');
      readout.setAttribute('aria-label', 'Back to the top');
    }
  }

  readout.addEventListener('click', function () {
    var i = parseInt(readout.getAttribute('data-target') || '0', 10);
    var el = i > 0 && anchors[i] ? anchors[i].el : document.getElementById('top');
    el.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  });

  // ---------- WebGL helpers ----------
  var VS = 'attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }';

  function makeProgram(gl, vs, fs) {
    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('Shturmap: shader did not compile', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }
    var v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('Shturmap: program did not link', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function fullScreenTriangle(gl) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  function context(canvas, opts) {
    try {
      return canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    } catch (e) {
      return null;
    }
  }

  var PRECISION = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif'
  ].join('\n');

  // ---------- Background: grid, contours, route, marker, pings ----------
  var FS_BG = PRECISION + '\n' + [
    'uniform vec2 u_res; uniform float u_dpr; uniform vec2 u_scroll;',
    'uniform vec2 u_pts[24]; uniform float u_cum[24]; uniform int u_n;',
    'uniform float u_route; uniform vec3 u_marker; uniform vec2 u_dir; uniform vec3 u_ping; uniform vec2 u_band;',
    'const vec3 GROUND = vec3(0.043, 0.047, 0.043);',
    'const vec3 GRID = vec3(0.082, 0.086, 0.078);',
    'const vec3 CONTOUR = vec3(0.118, 0.122, 0.106);',
    'const vec3 AMBER = vec3(0.788, 0.678, 0.384);',
    'const vec3 SAND = vec3(0.914, 0.886, 0.784);',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    'float field(vec2 p) { vec2 q = p / 520.0; return 9.0 * (0.7 * noise(q) + 0.3 * noise(q * 2.03 + 17.0)); }',
    'void main() {',
    '  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr + u_scroll;',
    '  float aa = 1.0 / u_dpr;',
    '  vec3 col = GROUND;',
    // Contours: lines of equal height, every fifth one stronger, like an index contour.
    '  float h = field(p);',
    '  float g = max(length(vec2(field(p + vec2(1.0, 0.0)) - h, field(p + vec2(0.0, 1.0)) - h)), 1e-4);',
    '  float d = abs(fract(h + 0.5) - 0.5) / g;',
    '  float c = 1.0 - smoothstep(0.3, 0.3 + aa, d);',
    '  float major = 1.0 - step(0.5, abs(mod(floor(h + 0.5), 5.0)));',
    '  col = mix(col, CONTOUR, c * mix(0.5, 1.0, major));',
    // Grid: one device pixel every 96 CSS px.
    '  vec2 m = mod(p, 96.0) * u_dpr;',
    '  if (m.x < 1.0 || m.y < 1.0) col = GRID;',
    '  if (u_route > 0.5 && p.x > u_band.x - 90.0 && p.x < u_band.y + 90.0) {',
    '    float best = 1e9; float bestS = 0.0;',
    '    for (int i = 0; i < 23; i++) {',
    '      if (i + 1 >= u_n) break;',
    '      vec2 a = u_pts[i]; vec2 b = u_pts[i + 1]; vec2 ab = b - a;',
    '      float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);',
    '      float dd = length(p - a - ab * t);',
    '      if (dd < best) { best = dd; bestS = mix(u_cum[i], u_cum[i + 1], t); }',
    '    }',
    '    float line = 1.0 - smoothstep(0.6, 0.6 + aa, best);',
    '    float done = step(bestS, u_marker.z);',
    '    float dash = step(fract(bestS / 12.0), 0.5);',
    '    col = mix(col, AMBER, line * mix(dash * 0.4, 0.75, done));',
    // Pings: three thin rings leaving the section anchor, as in the app.
    '    if (u_ping.z >= 0.0) {',
    '      float pr = length(p - u_ping.xy);',
    '      for (int k = 0; k < 3; k++) {',
    '        float ph = (u_ping.z - float(k) * 0.35) / 1.8;',
    '        if (ph > 0.0 && ph < 1.0) {',
    '          float rad = 6.0 + 36.0 * (1.0 - (1.0 - ph) * (1.0 - ph));',
    '          float ring = 1.0 - smoothstep(0.7, 0.7 + aa, abs(pr - rad));',
    '          col = mix(col, AMBER, ring * (1.0 - ph) * 0.8);',
    '        }',
    '      }',
    '    }',
    // The marker: a sand dot with a dark keyline and a faint facing cone.
    '    vec2 q = p - u_marker.xy; float r = length(q);',
    '    float facing = dot(q / max(r, 1e-4), u_dir);',
    '    float cone = step(0.866, facing) * step(5.0, r) * (1.0 - smoothstep(8.0, 34.0, r));',
    '    col = mix(col, SAND, cone * 0.18);',
    '    col = mix(col, GROUND, 1.0 - smoothstep(6.0, 6.0 + aa, r));',
    '    col = mix(col, SAND, 1.0 - smoothstep(4.5, 4.5 + aa, r));',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var bg = { canvas: document.getElementById('bg'), gl: null, u: {}, ok: false, ping: null };

  function initBg() {
    var gl = context(bg.canvas, { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return false;
    var prog = makeProgram(gl, VS, FS_BG);
    if (!prog) return false;
    gl.useProgram(prog);
    fullScreenTriangle(gl);
    ['u_res', 'u_dpr', 'u_scroll', 'u_n', 'u_route', 'u_marker', 'u_dir', 'u_ping', 'u_band'].forEach(function (n) { bg.u[n] = gl.getUniformLocation(prog, n); });
    bg.u.u_pts = gl.getUniformLocation(prog, 'u_pts[0]');
    bg.u.u_cum = gl.getUniformLocation(prog, 'u_cum[0]');
    bg.gl = gl; bg.ok = true;
    bg.canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      bg.ok = false;
      applyModes();
    });
    return true;
  }

  var ptsBuf = new Float32Array(48), cumBuf = new Float32Array(24);

  // Draws one frame; returns true while a ping still needs frames.
  function renderBg(now) {
    var gl = bg.gl, c = bg.canvas;
    var cssW = root.clientWidth, cssH = root.clientHeight;
    // Capped at 1.5: the background is faint, and fewer pixels keep scrolling light on the GPU.
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(bg.u.u_res, w, h);
    gl.uniform1f(bg.u.u_dpr, w / cssW);
    gl.uniform2f(bg.u.u_scroll, window.scrollX, window.scrollY);
    var n = Math.min(pts.length, 24);
    for (var i = 0; i < n; i++) { ptsBuf[2 * i] = pts[i].x; ptsBuf[2 * i + 1] = pts[i].y; cumBuf[i] = cum[i]; }
    gl.uniform2fv(bg.u.u_pts, ptsBuf);
    gl.uniform1fv(bg.u.u_cum, cumBuf);
    gl.uniform1i(bg.u.u_n, n);
    gl.uniform1f(bg.u.u_route, n > 1 ? 1 : 0);
    gl.uniform3f(bg.u.u_marker, marker.x, marker.y, marker.s);
    gl.uniform2f(bg.u.u_dir, marker.dx, marker.dy);
    gl.uniform2f(bg.u.u_band, bandMin, bandMax);
    var age = -1;
    if (bg.ping) {
      age = (now - bg.ping.t) / 1000;
      if (age > 2.6) { bg.ping = null; age = -1; }
    }
    gl.uniform3f(bg.u.u_ping, bg.ping ? bg.ping.x : 0, bg.ping ? bg.ping.y : 0, age);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return bg.ping !== null;
  }

  // ---------- Loupe: 2x magnifier on the in-raid screenshot ----------
  var FS_LOUPE = PRECISION + '\n' + [
    'uniform sampler2D u_tex; uniform vec2 u_res; uniform float u_dpr; uniform vec2 u_size; uniform vec2 u_pt; uniform float u_half; uniform float u_zoom;',
    'const vec3 AMBER = vec3(0.788, 0.678, 0.384);',
    'const vec3 GROUND = vec3(0.043, 0.047, 0.043);',
    'void main() {',
    '  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_dpr;',
    '  vec2 q = p - u_pt; vec2 a = abs(q);',
    '  if (a.x > u_half || a.y > u_half) { gl_FragColor = vec4(0.0); return; }',
    '  vec2 uv = (u_pt + q / u_zoom) / u_size;',
    '  vec3 col = texture2D(u_tex, clamp(uv, 0.0, 1.0)).rgb;',
    '  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) col = GROUND;',
    '  float edge = u_half - max(a.x, a.y);',
    '  if (edge < 1.0) col = AMBER; else if (edge < 3.0) col = GROUND;',
    '  bool tickX = a.y < 0.6 && a.x > 6.0 && a.x < 14.0;',
    '  bool tickY = a.x < 0.6 && a.y > 6.0 && a.y < 14.0;',
    '  if (tickX || tickY) col = AMBER;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var lp = { canvas: document.getElementById('loupe'), box: document.getElementById('raid-box'), img: document.getElementById('raid-img'), gl: null, u: {}, ok: false, at: null };

  function initLoupe() {
    var gl = context(lp.canvas, { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return false;
    var prog = makeProgram(gl, VS, FS_LOUPE);
    if (!prog) return false;
    gl.useProgram(prog);
    fullScreenTriangle(gl);
    ['u_tex', 'u_res', 'u_dpr', 'u_size', 'u_pt', 'u_half', 'u_zoom'].forEach(function (n) { lp.u[n] = gl.getUniformLocation(prog, n); });
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lp.img);
    } catch (e) {
      console.warn('Shturmap: loupe texture refused', e);
      return false;
    }
    gl.uniform1i(lp.u.u_tex, 0);
    lp.gl = gl; lp.ok = true;
    return true;
  }

  function renderLoupe() {
    var gl = lp.gl, c = lp.canvas, box = lp.box.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(box.width * dpr)), h = Math.max(1, Math.round(box.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!lp.at) return;
    gl.uniform2f(lp.u.u_res, w, h);
    gl.uniform1f(lp.u.u_dpr, w / box.width);
    gl.uniform2f(lp.u.u_size, box.width, box.height);
    gl.uniform2f(lp.u.u_pt, lp.at.x, lp.at.y);
    gl.uniform1f(lp.u.u_half, Math.min(130, box.width / 6));
    gl.uniform1f(lp.u.u_zoom, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loupeActive() { return lp.ok && fine.matches && wide.matches; }

  lp.box.addEventListener('pointermove', function (e) {
    if (!loupeActive()) return;
    var r = lp.box.getBoundingClientRect();
    lp.at = { x: e.clientX - r.left, y: e.clientY - r.top };
    requestLoupe();
  });
  lp.box.addEventListener('pointerleave', function () {
    if (!lp.at) return;
    lp.at = null;
    requestLoupe();
  });

  // ---------- Scheduling: draw only on scroll, resize, pointer or a running ping ----------
  var pending = false, loupeDirty = false;
  function requestLoupe() { loupeDirty = true; request(); }
  function request() {
    if (!pending) { pending = true; requestAnimationFrame(frame); }
  }
  function frame(now) {
    pending = false;
    update(now);
    var more = false;
    if (bg.ok && wide.matches) more = renderBg(now);
    if (loupeDirty && lp.ok) { loupeDirty = false; renderLoupe(); }
    if (more) { pending = true; requestAnimationFrame(frame); }
  }

  function applyModes() {
    root.classList.toggle('gl-on', bg.ok && wide.matches);
    root.classList.toggle('route-on', wide.matches);
    root.classList.toggle('loupe-on', loupeActive());
    if (!loupeActive()) lp.at = null;
  }

  function relayout() { measure(); request(); }

  // ---------- Start ----------
  measure();
  initBg();
  function startLoupe() {
    initLoupe();
    applyModes();
    requestLoupe();
  }
  if (lp.img.complete && lp.img.naturalWidth) startLoupe(); else lp.img.addEventListener('load', startLoupe);
  applyModes();
  [reduced, wide, fine].forEach(function (mq) {
    var onChange = function () { applyModes(); relayout(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  });
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', relayout);
  window.addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.body);
  request();
})();
