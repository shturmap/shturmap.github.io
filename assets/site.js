// Shturmap website behaviour. Everything here is optional: without JS or on a narrow screen the page is complete.
//  - Logo: the hero's logo moves up into the header as it scrolls away, and back down on the way up.
//  - Route (wide screens): a dashed route through the section numbers. A marker like the app's player marker follows
//    it as you scroll, pings on reaching a section, and the NEXT readout jumps to the next one.
//  - Loupe (wide screens with a mouse): a 2x magnifier on the in-raid screenshot, which is rendered at 2x.
// Reduced motion: the logo swaps instead of moving, the marker snaps to sections, no pings.
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
    if (reduced.matches) p = p >= 0.5 ? 1 : 0;
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
  var lastReached = null, lastText = '';

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
    svg.setAttribute('width', String(sheet.clientWidth));
    svg.setAttribute('height', String(sheet.scrollHeight));
    var d = pts.map(function (p, k) { return (k ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    ahead.setAttribute('d', d);
    done.setAttribute('d', d);
  }

  // The point on the route at a height in the sheet (the route only ever goes down).
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
    return { x: last.x, y: last.y, s: total, dx: 0, dy: 1 };
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

  function updateRoute() {
    if (pts.length < 2) return;
    var sheetTop = sheet.getBoundingClientRect().top, vh = window.innerHeight;
    // The reading line is a third of the way down the window; near the end it slides down so the last section counts.
    var readY = vh * 0.35 - sheetTop;
    var left = root.scrollHeight - vh - window.scrollY;
    if (left < vh * 0.65) readY += vh * 0.65 - Math.max(0, left);
    var reached = -1;
    anchors.forEach(function (a, i) { if (a.y <= readY + 1) reached = i; });
    var m;
    if (reduced.matches) {
      var k = anchorAt[Math.max(0, reached)];
      m = { x: pts[k].x, y: pts[k].y, s: cum[k], dx: 0, dy: 1 };
    } else {
      m = atY(readY);
    }
    var angle = Math.atan2(m.dy, m.dx) * 180 / Math.PI;
    markerEl.setAttribute('transform', 'translate(' + m.x.toFixed(1) + ' ' + m.y.toFixed(1) + ') rotate(' + angle.toFixed(1) + ')');
    done.setAttribute('stroke-dasharray', m.s.toFixed(1) + ' ' + (total + 1).toFixed(1));
    if (lastReached !== null && reached > lastReached && !reduced.matches) ping(anchors[reached]);
    lastReached = reached;

    var next = reached + 1, text, target, label;
    if (next < anchors.length) {
      var a = anchors[next];
      var metres = Math.max(10, Math.round((cum[anchorAt[next]] - m.s) * 0.05) * 10);
      text = (next === anchors.length - 1 ? 'EXIT' : 'NEXT') + ' · ' + a.ref + ' ' + a.name.toUpperCase() + ' · ' + metres.toLocaleString('en-US') + ' m AHEAD';
      target = next;
      label = 'Jump to ' + a.ref + ', ' + a.name;
    } else {
      text = 'BACK TO TOP';
      target = 0;
      label = 'Back to the top';
    }
    if (text !== lastText) {
      lastText = text;
      readoutText.textContent = text;
      readout.setAttribute('data-target', String(target));
      readout.setAttribute('aria-label', label);
    }
  }

  readout.addEventListener('click', function () {
    var i = parseInt(readout.getAttribute('data-target') || '0', 10);
    var el = i > 0 && anchors[i] ? anchors[i].el : document.getElementById('top');
    el.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  });

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

  // ---------- Scheduling: everything follows scroll and resize, one frame at a time ----------
  var pending = false;
  function frame() {
    pending = false;
    moveLogo();
    if (wide.matches) updateRoute();
  }
  function request() {
    if (!pending) { pending = true; window.requestAnimationFrame(frame); }
  }
  function applyModes() {
    root.classList.toggle('route-on', wide.matches);
    root.classList.toggle('loupe-on', loupeOn());
    if (!loupeOn()) hideLens();
  }
  function relayout() { measure(); request(); }

  applyModes();
  measure();
  [reduced, wide, fine].forEach(function (mq) {
    var onChange = function () { applyModes(); relayout(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  });
  window.addEventListener('scroll', function () { hideLens(); request(); }, { passive: true });
  window.addEventListener('resize', relayout);
  window.addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.body);
  request();
})();
