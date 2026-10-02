// Shturmap website behaviour. Everything here is optional: without JS, WebGL or a wide screen the page is complete.
//  - Logo: the hero's logo moves up into the header as it scrolls away, and back down on the way up.
//  - Route (wide screens): a dashed route through the section numbers. A marker like the app's player marker eases
//    along it after the scroll, faces the way it travels (it turns around when you scroll up), pings when it reaches
//    a section, and the NEXT readout jumps to the next one.
//  - Contours (wide screens, WebGL): terrain lines behind the page that drift and reshape very slowly, and scroll at half
//    speed. 30 frames a second at most, paused in hidden tabs.
//  - Loupe (wide screens with a mouse): a 2x magnifier on the in-raid screenshot, which is rendered at 2x.
// Reduced motion keeps what moves only with your own scrolling (the logo, the marker without easing) and drops what
// moves by itself: the contour drift and parallax, the pings, the marker's easing, smooth scrolling.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wide = window.matchMedia('(min-width: 761px)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var SVG = 'http://www.w3.org/2000/svg';

  // ---------- The logo moves into the header ----------
  var head = document.querySelector('.site-head');
  var brand = document.getElementById('brand');
  var heroLogo = document.getElementById('hero-logo');
  var flyer = heroLogo.cloneNode(false);
  flyer.removeAttribute('id');
  flyer.className = 'flyer';
  flyer.alt = '';
  flyer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(flyer);
  var flight = -1;

  function moveLogo() {
    var from = heroLogo.getBoundingClientRect(), to = brand.getBoundingClientRect();
    // 0 while the hero logo is below the header, 1 once it has risen its own height (and a margin) under it.
    var p = Math.min(1, Math.max(0, (head.getBoundingClientRect().bottom - from.top) / (from.height + 48)));
    var state = p <= 0 ? 0 : p >= 1 ? 2 : 1;
    if (state !== flight) {
      flight = state;
      brand.classList.toggle('in', state === 2);
      heroLogo.classList.toggle('away', state !== 0);
      flyer.style.display = state === 1 ? 'block' : 'none';
    }
    if (state === 1) {
      var e = p * p * (3 - 2 * p);
      var scale = (from.width + (to.width - from.width) * e) / from.width;
      flyer.style.width = from.width + 'px';
      flyer.style.transform = 'translate(' + (from.left + (to.left - from.left) * e) + 'px,' +
        (from.top + (to.top - from.top) * e) + 'px) scale(' + scale + ')';
    }
  }

  // ---------- The route through the section numbers ----------
  var sheet = document.querySelector('.sh');
  var svg = document.getElementById('route');
  var ahead = svg.querySelector('.route-ahead'), done = svg.querySelector('.route-done');
  var markerEl = svg.querySelector('.marker'), pingEl = svg.querySelector('.ping');
  var readout = document.getElementById('readout'), readoutText = document.getElementById('readout-text');
  var sections = Array.prototype.slice.call(document.querySelectorAll('section[data-ref]'));
  var anchors = [], pts = [], cum = [], anchorAt = [], total = 0;
  var travelled = null, lastReached = null, lastText = '';
  // The marker faces the way it last travelled (1 down the route, -1 back up) and turns smoothly toward it.
  var facing = 1, heading = null;
  function wrap180(deg) { return deg - 360 * Math.round(deg / 360); }

  // Anchors sit on each section number; between two, the route steps out at 45 degrees and back, like a patrol path.
  function measure() {
    var origin = sheet.getBoundingClientRect();
    anchors = sections.map(function (s) {
      var r = s.querySelector('.b-num').getBoundingClientRect();
      return { x: r.left - origin.left + 4, y: r.top - origin.top, ref: s.getAttribute('data-ref'), name: s.getAttribute('data-name'), el: s };
    });
    pts = []; anchorAt = [];
    anchors.forEach(function (a, i) {
      if (i > 0) {
        var p = anchors[i - 1], gap = a.y - p.y, h = Math.min(gap * 0.2, 160), w = 28;
        if (gap > 2 * (h + w) + 20) pts.push({ x: p.x, y: p.y + h }, { x: p.x + w, y: p.y + h + w }, { x: p.x + w, y: a.y - h - w }, { x: a.x, y: a.y - h });
      }
      anchorAt.push(pts.length);
      pts.push({ x: a.x, y: a.y });
    });
    cum = [0];
    for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    total = cum[cum.length - 1] || 0;
    if (travelled !== null) travelled = Math.min(travelled, total);
    svg.setAttribute('width', String(sheet.clientWidth));
    svg.setAttribute('height', String(sheet.scrollHeight));
    var d = pts.map(function (p, k) { return (k ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    ahead.setAttribute('d', d);
    done.setAttribute('d', d);
  }

  // How far along the route a height in the sheet is (the route only ever goes down).
  function distanceAtY(y) {
    if (y <= pts[0].y) return 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      if (y <= b.y) return cum[i - 1] + (y - a.y) / Math.max(1e-6, b.y - a.y) * (cum[i] - cum[i - 1]);
    }
    return total;
  }

  // The point and heading at a distance along the route.
  function pointAt(s) {
    for (var i = 1; i < pts.length; i++) {
      if (s <= cum[i] || i === pts.length - 1) {
        var a = pts[i - 1], b = pts[i], len = Math.max(1e-6, cum[i] - cum[i - 1]);
        var t = Math.min(1, Math.max(0, (s - cum[i - 1]) / len));
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len };
      }
    }
    return { x: pts[0].x, y: pts[0].y, dx: 0, dy: 1 };
  }

  function ping(a) {
    var g = document.createElementNS(SVG, 'g');
    g.setAttribute('class', 'ping');
    g.setAttribute('transform', 'translate(' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ')');
    for (var k = 0; k < 3; k++) {
      var c = document.createElementNS(SVG, 'circle');
      c.setAttribute('r', '40');
      g.appendChild(c);
    }
    pingEl.replaceWith(g);
    pingEl = g;
  }

  // Moves the marker toward the reading line's spot on the route; returns true while it is still travelling or turning.
  function updateRoute(dt) {
    if (pts.length < 2) return false;
    var vh = window.innerHeight;
    // The reading line is a third of the way down the window; near the end it slides down so the last section counts.
    var readY = vh * 0.35 - sheet.getBoundingClientRect().top;
    var left = root.scrollHeight - vh - window.scrollY;
    if (left < vh * 0.65) readY += vh * 0.65 - Math.max(0, left);
    var target = distanceAtY(readY);
    var before = travelled === null ? target : travelled;
    // Reduced motion: the marker sits exactly where the scroll puts it, without easing after it.
    if (travelled === null || reduced.matches) travelled = target;
    else travelled += (target - travelled) * (1 - Math.exp(-dt / 220));
    var moving = Math.abs(target - travelled) > 0.3;
    if (!moving) travelled = target;
    // Scrolling up turns the marker around; it keeps facing that way until the scroll goes down again.
    var way = reduced.matches ? travelled - before : target - before;
    if (Math.abs(way) > 1) facing = way > 0 ? 1 : -1;

    var m = pointAt(travelled);
    var want = Math.atan2(m.dy, m.dx) * 180 / Math.PI + (facing < 0 ? 180 : 0);
    if (heading === null || reduced.matches) heading = want;
    else heading += wrap180(want - heading) * (1 - Math.exp(-dt / 110));
    var turning = Math.abs(wrap180(want - heading)) > 0.5;
    if (!turning) heading = want;
    heading = wrap180(heading);
    markerEl.setAttribute('transform', 'translate(' + m.x.toFixed(1) + ' ' + m.y.toFixed(1) + ') rotate(' + heading.toFixed(1) + ')');
    done.setAttribute('stroke-dasharray', travelled.toFixed(1) + ' ' + (total + 1).toFixed(1));

    var reached = 0;
    anchorAt.forEach(function (k, i) { if (cum[k] <= travelled + 0.5) reached = i; });
    if (lastReached !== null && reached > lastReached && !reduced.matches) ping(anchors[reached]);
    lastReached = reached;

    var next = reached + 1, text, jump, label;
    if (next < anchors.length) {
      var a = anchors[next];
      var metres = Math.max(10, Math.round((cum[anchorAt[next]] - travelled) * 0.05) * 10);
      text = (next === anchors.length - 1 ? 'EXIT' : 'NEXT') + ' · ' + a.ref + ' ' + a.name.toUpperCase() + ' · ' + metres.toLocaleString('en-US') + ' m AHEAD';
      jump = next;
      label = 'Jump to ' + a.ref + ', ' + a.name;
    } else {
      text = 'BACK TO TOP';
      jump = 0;
      label = 'Back to the top';
    }
    if (text !== lastText) {
      lastText = text;
      readoutText.textContent = text;
      readout.setAttribute('data-target', String(jump));
      readout.setAttribute('aria-label', label);
    }
    return moving || turning;
  }

  readout.addEventListener('click', function () {
    var i = parseInt(readout.getAttribute('data-target') || '0', 10);
    var el = i > 0 && anchors[i] ? anchors[i].el : document.getElementById('top');
    el.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  });

  // ---------- Contours: drifting terrain lines behind the page ----------
  var FS_CONTOURS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 u_res; uniform float u_scale; uniform vec2 u_scroll; uniform float u_time;',
    'const vec3 GROUND = vec3(0.043, 0.047, 0.043);',
    'const vec3 LINE = vec3(0.118, 0.122, 0.108);',
    'const vec3 INDEX = vec3(0.180, 0.184, 0.161);',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',
    // Two layers drifting in different directions (about 5 px a second), so the terrain slowly reshapes as it moves.
    'float height(vec2 p) {',
    '  vec2 q = p / 560.0;',
    '  return 14.0 * (0.65 * noise(q + vec2(0.009, 0.0055) * u_time) + 0.35 * noise(q * 1.9 + vec2(5.2, 1.3) + vec2(-0.017, 0.0105) * u_time));',
    '}',
    'void main() {',
    '  vec2 s = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) / u_scale;',
    '  vec2 p = s + u_scroll;',
    '  float h = height(p);',
    '  float g = max(length(vec2(height(p + vec2(1.0, 0.0)) - h, height(p + vec2(0.0, 1.0)) - h)), 1e-4);',
    // Distance to the nearest contour in CSS pixels; every fifth line is an index contour, a step brighter.
    '  float d = abs(fract(h + 0.5) - 0.5) / g;',
    '  float line = 1.0 - smoothstep(0.4, 0.4 + 1.0 / u_scale, d);',
    '  float index = 1.0 - step(0.5, abs(mod(floor(h + 0.5), 5.0)));',
    '  gl_FragColor = vec4(mix(GROUND, mix(LINE, INDEX, index), line), 1.0);',
    '}'
  ].join('\n');

  var bg = { canvas: document.getElementById('bg'), gl: null, u: {}, ok: false, start: 0, drawn: 0 };

  function initContours() {
    var gl;
    try {
      gl = bg.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch (e) {
      gl = null;
    }
    if (!gl) return false;
    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('Shturmap: contour shader did not compile', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }
    var vs = compile(gl.VERTEX_SHADER, 'attribute vec2 a_pos; void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }');
    var fs = compile(gl.FRAGMENT_SHADER, FS_CONTOURS);
    if (!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Shturmap: contour shader did not link', gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    ['u_res', 'u_scale', 'u_scroll', 'u_time'].forEach(function (n) { bg.u[n] = gl.getUniformLocation(prog, n); });
    bg.canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      bg.ok = false;
      applyModes();
    });
    bg.gl = gl;
    bg.ok = true;
    return true;
  }

  function drawContours(now) {
    var gl = bg.gl, c = bg.canvas;
    var cssW = root.clientWidth, cssH = window.innerHeight;
    // Capped at 1.5: the lines are faint, and fewer pixels keep the GPU idle most of the time.
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.max(1, Math.round(cssW * dpr)), h = Math.max(1, Math.round(cssH * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(bg.u.u_res, w, h);
    gl.uniform1f(bg.u.u_scale, w / cssW);
    // Half the page's scroll puts the terrain behind it; reduced motion keeps it fixed to the page instead.
    var depth = reduced.matches ? 1 : 0.5;
    gl.uniform2f(bg.u.u_scroll, window.scrollX * depth, window.scrollY * depth);
    gl.uniform1f(bg.u.u_time, reduced.matches ? 0 : (now - bg.start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    bg.drawn = now;
  }

  function contoursOn() { return bg.ok && wide.matches; }
  function drifting() { return contoursOn() && !reduced.matches && !document.hidden; }

  // ---------- Loupe on the in-raid screenshot ----------
  var box = document.getElementById('raid-box'), img = document.getElementById('raid-img'), lens = document.getElementById('loupe');
  var ZOOM = 2;
  function loupeOn() { return wide.matches && fine.matches; }
  function hideLens() { lens.style.display = 'none'; }
  box.addEventListener('pointermove', function (e) {
    if (!loupeOn() || e.pointerType !== 'mouse') return hideLens();
    var b = box.getBoundingClientRect(), r = img.getBoundingClientRect();
    lens.style.display = 'block';
    var half = lens.offsetWidth / 2;
    var x = e.clientX - r.left, y = e.clientY - r.top;
    lens.style.transform = 'translate(' + (e.clientX - b.left - half) + 'px,' + (e.clientY - b.top - half) + 'px)';
    lens.style.backgroundImage = 'url("' + (img.currentSrc || img.src) + '")';
    lens.style.backgroundSize = (r.width * ZOOM) + 'px ' + (r.height * ZOOM) + 'px';
    lens.style.backgroundPosition = (half - x * ZOOM) + 'px ' + (half - y * ZOOM) + 'px';
  });
  box.addEventListener('pointerleave', hideLens);

  // ---------- One frame loop: runs while scrolling, while the marker travels, and at 30 fps for the contours ----------
  var pending = false, scrolled = true, travelling = false, lastFrame = 0;
  function frame(now) {
    pending = false;
    var dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
    lastFrame = now;
    if (scrolled || travelling) {
      moveLogo();
      travelling = wide.matches && updateRoute(dt);
    }
    if (contoursOn() && (scrolled || (drifting() && now - bg.drawn >= 33))) drawContours(now);
    scrolled = false;
    if (travelling || drifting()) schedule();
    else lastFrame = 0;
  }
  function schedule() {
    if (!pending) { pending = true; window.requestAnimationFrame(frame); }
  }
  function request() { scrolled = true; schedule(); }

  function applyModes() {
    root.classList.toggle('route-on', wide.matches);
    root.classList.toggle('gl-on', contoursOn());
    root.classList.toggle('loupe-on', loupeOn());
    if (!loupeOn()) hideLens();
  }
  function relayout() { measure(); request(); }

  bg.start = window.performance ? performance.now() : 0;
  initContours();
  applyModes();
  measure();
  [reduced, wide, fine].forEach(function (mq) {
    var onChange = function () { applyModes(); relayout(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  });
  window.addEventListener('scroll', function () { hideLens(); request(); }, { passive: true });
  window.addEventListener('resize', relayout);
  window.addEventListener('load', relayout);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) request(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.body);
  request();
})();
