/* Карта ограничений ThuggerVPN («Ночной радар»): MapLibre GL + векторная подложка OpenFreeMap.
   Если подложка не загрузилась, карта работает на своей подложке (только регионы).
   Данные: /karta/data.json (события 30 дней, регионы, города, зоны). */
(function () {
  var T = window.KM_T, root = document.getElementById('km'), EN = root.getAttribute('data-lang') === 'en';
  var D = null, map = null, styleOk = false, ready = false;
  var S = { days: 7, kind: 'all', zones: true, day: null, route: null, playing: null };
  var sheet = document.getElementById('km-sheet'), C = document.getElementById('km-c');
  var KINDS = ['slow', 'outage', 'whitelist', 'service', 'policy'];
  var KCOL = { slow: '#f6c177', outage: '#ff5079', whitelist: '#b9a4ff', service: '#7dd3fc', policy: '#9aa2b3' };
  var RAMP_D = ['#3a2d6e', '#6a3fd8', '#b24ad6', '#ff5079'], RAMP_L = ['#d9ccff', '#a98bf8', '#7c3aed', '#4a1a99'];
  var cityMk = [], meMk = null;

  function dark() { var t = document.documentElement.getAttribute('data-theme'); return t ? t !== 'light' : !(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches); }
  function ramp() { return dark() ? RAMP_D : RAMP_L; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lv(n) { return n < 1 ? -1 : n < 2 ? 0 : n < 4 ? 1 : n < 7 ? 2 : 3; }
  function col(n) { var i = lv(n); return i < 0 ? 'transparent' : ramp()[i]; }
  function pl(n) { if (EN) return n === 1 ? 'event' : 'events'; var a = n % 100, b = n % 10; if (a > 10 && a < 20) return 'событий'; if (b === 1) return 'событие'; if (b > 1 && b < 5) return 'события'; return 'событий'; }
  function dd(s) { return s.slice(8, 10) + '.' + s.slice(5, 7); }
  function gc(p) { try { goatcounter.count({ path: 'karta/' + p, title: 'karta ' + p, event: true }); } catch (e) { } }
  function ico(n) { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ({ bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>' })[n] + '</svg>'; }

  // --- фильтры ---
  function evOk(e) {
    if (S.kind !== 'all' && e.k !== S.kind) return false;
    if (S.day !== null) return e.a === S.day;
    return e.a < S.days;
  }
  function list() { return D.events.filter(evOk).sort(function (a, b) { return a.a - b.a; }); }
  function regEvents(name) { return D.events.filter(function (e) { return evOk(e) && e.r.indexOf(name) >= 0; }); }
  function natEvents() { return D.events.filter(function (e) { return evOk(e) && !e.r.length; }); }
  function rname(p) { return EN && p.en ? p.en : p.n; }
  var REN = null;
  function regLabel(n) { if (!EN) return n; if (!REN) { REN = {}; D.regions.features.forEach(function (f) { REN[f.properties.n] = f.properties.en || f.properties.n; }); } return REN[n] || n; }
  var TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  var CEN = { 'Москва': 'Moscow', 'Санкт-Петербург': 'St Petersburg', 'Нижний Новгород': 'Nizhny Novgorod', 'Ростов-на-Дону': 'Rostov-on-Don' };
  function cname(n) { if (!EN) return n; if (CEN[n]) return CEN[n]; return n.split('').map(function (ch) { var l = ch.toLowerCase(), t = TR[l]; if (t === undefined) return ch; return ch !== l ? t.charAt(0).toUpperCase() + t.slice(1) : t; }).join(''); }

  // --- нижняя карточка / боковая карточка ---
  function open(h) { C.innerHTML = h; sheet.classList.add('on'); sheet.classList.remove('min'); C.scrollTop = 0; }
  function close() { sheet.classList.remove('on'); }
  sheet.querySelector('.km-x').onclick = close;
  sheet.querySelector('.km-h').onclick = function () { sheet.classList.toggle('min'); };
  function links() { return '<div class="km-links"><a href="' + KM_PRE + '/status/">' + T.status + '</a><a href="' + KM_PRE + '/check/">' + T.check + '</a></div>'; }
  function evHtml(e) {
    var reg = e.r.length ? e.r.slice(0, 2).map(regLabel).join(', ') + (e.r.length > 2 ? ' +' + (e.r.length - 2) : '') : T.nat;
    return '<div class="km-ev"><div class="km-ev-h"><i style="background:' + KCOL[e.k] + '"></i><span style="color:' + KCOL[e.k] + '">' + esc(T.k[e.k]) + '</span><small>' + dd(e.d) + '</small></div><b>' + esc(EN ? e.te : e.t) + '</b><small>' + esc(EN ? e.me : e.m) + '</small>' +
      (e.u ? '<br><a href="' + esc(e.u) + '" target="_blank" rel="noopener nofollow">' + T.src + ': ' + esc(e.s || 'link') + '</a>' : '') + '<small class="km-ev-r">' + esc(reg) + '</small></div>';
  }
  function bars7(name) {
    var h = '';
    for (var a = 6; a >= 0; a--) {
      var n = D.events.filter(function (e) { return e.a === a && e.r.indexOf(name) >= 0 && (S.kind === 'all' || e.k === S.kind); }).length;
      h += '<span style="height:' + (n ? Math.min(100, 20 + n * 30) : 8) + '%;background:' + (n ? col(Math.max(n, 2) * 2) : 'var(--line2)') + '"></span>';
    }
    return '<div class="km-b7" aria-hidden="true">' + h + '</div><div class="km-b7l"><span>' + T.d7ago + '</span><span>' + T.today + '</span></div>';
  }
  function level(n) { return n >= 7 ? [T.high, 'hi'] : n >= 2 ? [T.mid, 'md'] : [T.low, 'lo']; }
  function showRegion(p) {
    var L = regEvents(p.n), N = natEvents(), lvl = level(L.length);
    var h = '<div class="km-rh"><h2>' + esc(rname(p)) + '</h2>' + (L.length ? '<span class="km-lvl ' + lvl[1] + '">' + lvl[0] + '</span>' : '') + '</div>' +
      '<p class="km-sub">' + L.length + ' ' + pl(L.length) + ' · ' + periodLabel() + '</p>' + bars7(p.n) +
      (L.length ? L.map(evHtml).join('') : '<p>' + T.none + '</p>');
    if (N.length) h += '<h3>' + T.nat + '</h3>' + N.map(evHtml).join('');
    open(h + links()); gc('region');
  }
  function showCity(c) {
    var L = c.e.map(function (i) { return D.events[i]; }).filter(evOk).sort(function (a, b) { return a.a - b.a; });
    open('<h2>' + esc(cname(c.n)) + '</h2><p class="km-sub">' + L.length + ' ' + pl(L.length) + ' · ' + periodLabel() + '</p>' + L.map(evHtml).join('') + links()); gc('city');
  }
  function showZone(z) {
    var src = (z.s || []).map(function (s) { return '<a href="' + esc(s.u) + '" target="_blank" rel="noopener nofollow">' + esc(s.t) + '</a>'; }).join(' · ');
    open('<h2>' + esc(EN ? z.te : z.t) + '</h2><p class="km-sub">' + T.zone + (z.since ? ' · ' + (EN ? 'since ' : 'с ') + esc(z.since) : '') + '</p><p>' + esc(EN ? z.me : z.m) + '</p>' + (src ? '<p class="km-src">' + T.src + ': ' + src + '</p>' : '') + links()); gc('zone');
  }
  function periodLabel() {
    if (S.day !== null) return S.day === 0 ? T.today.toLowerCase() : dd(dayIso(S.day));
    return S.days === 1 ? T.today.toLowerCase() : S.days === 7 ? T.p7 : T.p30;
  }
  function dayIso(a) { var d = new Date(D.updated.slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - a); return d.toISOString().slice(0, 10); }

  // --- лента и счётчики ---
  function renderFeed() {
    var L = list(), f = document.getElementById('km-feed');
    var regs = {}; L.forEach(function (e) { e.r.forEach(function (r) { regs[r] = 1; }); });
    document.getElementById('km-n-ev').textContent = L.length;
    document.getElementById('km-n-reg').textContent = Object.keys(regs).length;
    document.getElementById('km-n-today').textContent = D.events.filter(function (e) { return e.a === 0 && (S.kind === 'all' || e.k === S.kind); }).length;
    f.innerHTML = L.length ? L.slice(0, 40).map(function (e, i) { return '<button type="button" class="km-fi" data-i="' + D.events.indexOf(e) + '">' + evHtml(e) + '</button>'; }).join('') : '<p class="km-sub">' + T.none + '</p>';
    f.querySelectorAll('.km-fi').forEach(function (b) {
      b.onclick = function (ev) {
        if (ev.target.closest('a')) return;
        var e = D.events[+b.getAttribute('data-i')];
        if (e.r.length) { var ft = D.regions.features.filter(function (x) { return x.properties.n === e.r[0]; })[0]; if (ft) { flyToFeature(ft); showRegion(ft.properties); return; } }
        open(evHtml(e) + links());
      };
    });
    // счётчики на фильтрах типов
    document.querySelectorAll('[data-k]').forEach(function (b) {
      var k = b.getAttribute('data-k'), n = D.events.filter(function (e) { return (k === 'all' || e.k === k) && (S.day !== null ? e.a === S.day : e.a < S.days); }).length;
      var s = b.querySelector('.n'); if (s) s.textContent = n;
    });
  }
  function renderTimeline() {
    var box = document.getElementById('km-tl'), h = '', mx = 1, cnt = [];
    for (var a = 29; a >= 0; a--) { var n = D.events.filter(function (e) { return e.a === a && (S.kind === 'all' || e.k === S.kind); }).length; cnt.push([a, n]); mx = Math.max(mx, n); }
    cnt.forEach(function (x) {
      var a = x[0], n = x[1], on = S.day !== null ? a === S.day : a < S.days;
      h += '<button type="button" class="km-tb' + (on ? ' on' : '') + (S.day === a ? ' cur' : '') + '" data-a="' + a + '" aria-label="' + dd(dayIso(a)) + ': ' + n + ' ' + pl(n) + '"><span style="height:' + (n ? 14 + n / mx * 86 : 6) + '%"></span></button>';
    });
    box.innerHTML = h;
    box.querySelectorAll('.km-tb').forEach(function (b) {
      b.onclick = function () { stopPlay(); var a = +b.getAttribute('data-a'); S.day = S.day === a ? null : a; refresh(); if (S.day !== null) { gc('day'); } };
    });
    var lab = document.getElementById('km-tl-l');
    lab.innerHTML = '<span>' + dd(dayIso(29)) + '</span><span>' + dd(dayIso(20)) + '</span><span>' + dd(dayIso(10)) + '</span><b>' + (S.day !== null ? dd(dayIso(S.day)) : T.today) + '</b>';
  }

  // --- слои карты ---
  function regionsData() {
    var cnt = {};
    D.events.forEach(function (e) { if (evOk(e)) e.r.forEach(function (r) { cnt[r] = (cnt[r] || 0) + 1; }); });
    return { type: 'FeatureCollection', features: D.regions.features.map(function (f, i) { return { type: 'Feature', id: i, properties: { n: f.properties.n, en: f.properties.en, c: cnt[f.properties.n] || 0, col: col(cnt[f.properties.n] || 0) }, geometry: f.geometry }; }) };
  }
  function circlePoly(lon, lat, r) {
    var pts = [], k = r / 6371000;
    for (var i = 0; i <= 64; i++) { var t = i / 64 * 2 * Math.PI, la = lat + k * Math.sin(t) * 180 / Math.PI, lo = lon + k * Math.cos(t) * 180 / Math.PI / Math.cos(lat * Math.PI / 180); pts.push([lo, la]); }
    return [pts];
  }
  function zonesData() {
    return { type: 'FeatureCollection', features: S.zones ? D.zones.map(function (z, i) { return { type: 'Feature', id: i, properties: { i: i, gps: z.kind === 'gps' ? 1 : 0 }, geometry: { type: 'Polygon', coordinates: circlePoly(z.lon, z.lat, z.r) } }; }) : [] };
  }
  function addLayers() {
    if (!D || !map.isStyleLoaded()) return;
    var dk = dark(), before = firstSymbol();
    if (!map.getSource('reg')) map.addSource('reg', { type: 'geojson', data: regionsData() });
    if (!map.getLayer('reg-fill')) map.addLayer({ id: 'reg-fill', type: 'fill', source: 'reg', paint: { 'fill-color': ['get', 'col'], 'fill-opacity': ['case', ['>', ['get', 'c'], 0], dk ? 0.62 : 0.55, 0], 'fill-antialias': true } }, before);
    if (!map.getLayer('reg-hover')) map.addLayer({ id: 'reg-hover', type: 'fill', source: 'reg', paint: { 'fill-color': dk ? '#ffffff' : '#7c3aed', 'fill-opacity': ['case', ['boolean', ['feature-state', 'h'], false], 0.12, 0] } }, before);
    if (!map.getLayer('reg-line')) map.addLayer({ id: 'reg-line', type: 'line', source: 'reg', paint: { 'line-color': dk ? '#8b5cf6' : '#7c3aed', 'line-opacity': dk ? 0.35 : 0.3, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 7, 1.2] } }, before);
    if (!map.getSource('zon')) map.addSource('zon', { type: 'geojson', data: zonesData() });
    if (!map.getLayer('zon-fill')) map.addLayer({ id: 'zon-fill', type: 'fill', source: 'zon', minzoom: 7, paint: { 'fill-color': ['case', ['==', ['get', 'gps'], 1], '#8b5cf6', '#ff5079'], 'fill-opacity': 0.14 } });
    if (!map.getLayer('zon-line')) map.addLayer({ id: 'zon-line', type: 'line', source: 'zon', minzoom: 7, paint: { 'line-color': ['case', ['==', ['get', 'gps'], 1], '#a78bfa', '#ff5079'], 'line-width': 2, 'line-dasharray': [2, 2] } });
    if (!map.getSource('rt')) map.addSource('rt', { type: 'geojson', data: S.route || { type: 'FeatureCollection', features: [] } });
    if (!map.getLayer('rt-case')) map.addLayer({ id: 'rt-case', type: 'line', source: 'rt', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': dk ? '#0a0b10' : '#ffffff', 'line-width': 11 } });
    if (!map.getLayer('rt-line')) map.addLayer({ id: 'rt-line', type: 'line', source: 'rt', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'c'], 'line-width': 6 } });
    ready = true;
  }
  function tryAdd() { if (!D || ready) return; if (map.isStyleLoaded()) { addLayers(); refreshMap(); } else setTimeout(tryAdd, 200); }
  function firstSymbol() {
    var ls = map.getStyle().layers || [];
    for (var i = 0; i < ls.length; i++) if (ls[i].type === 'symbol') return ls[i].id;
    return undefined;
  }
  function refreshMap() {
    if (!ready) return;
    var s = map.getSource('reg'); if (s) s.setData(regionsData());
    var z = map.getSource('zon'); if (z) z.setData(zonesData());
    drawCities();
  }
  function drawCities() {
    cityMk.forEach(function (m) { m.remove(); }); cityMk = [];
    D.cities.forEach(function (c) {
      var L = c.e.map(function (i) { return D.events[i]; }).filter(evOk);
      if (!L.length) return;
      var fresh = L.some(function (e) { return e.a === 0; }), n = L.length;
      var el = document.createElement('button');
      el.type = 'button'; el.className = 'km-city' + (fresh ? ' fresh' : '') + (n >= 7 ? ' hot' : '');
      el.style.setProperty('--s', (12 + Math.min(14, n * 1.6)) + 'px');
      el.setAttribute('aria-label', cname(c.n) + ': ' + n + ' ' + pl(n));
      el.innerHTML = '<i></i><span>' + esc(cname(c.n)) + ' <b>' + n + '</b></span>';
      el.onclick = function (ev) { ev.stopPropagation(); showCity(c); };
      var mk = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([c.lon, c.lat]).addTo(map);
      mk._n = n; cityMk.push(mk);
    });
    declutter();
  }
  function declutter() {
    var placed = [];
    cityMk.slice().sort(function (a, b) { return b._n - a._n; }).forEach(function (m) {
      var p = map.project(m.getLngLat()), el = m.getElement(), w = el.textContent.length * 7.2 + 14;
      var box = [p.x, p.y - 9, p.x + w, p.y + 9];
      var hit = placed.some(function (q) { return !(box[2] < q[0] || box[0] > q[2] || box[3] < q[1] || box[1] > q[3]); });
      el.classList.toggle('nl', hit);
      if (!hit) placed.push(box);
    });
  }
  function flyToFeature(f) {
    var b = [999, 999, -999, -999];
    (function walk(a) { if (typeof a[0] === 'number') { b[0] = Math.min(b[0], a[0]); b[1] = Math.min(b[1], a[1]); b[2] = Math.max(b[2], a[0]); b[3] = Math.max(b[3], a[1]); } else a.forEach(walk); })(f.geometry.coordinates);
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad(), maxZoom: 8, duration: 900 });
  }
  function wide() { return innerWidth >= 1000; }
  function pad() { return wide() ? { top: 80, bottom: 120, left: 40, right: 420 } : { top: 110, bottom: Math.round(innerHeight * 0.5), left: 24, right: 24 }; }

  function refresh() { renderFeed(); renderTimeline(); refreshMap(); syncButtons(); }
  function syncButtons() {
    document.querySelectorAll('[data-d]').forEach(function (b) { b.setAttribute('aria-pressed', S.day === null && +b.getAttribute('data-d') === S.days); });
    document.querySelectorAll('[data-k]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-k') === S.kind); });
    document.getElementById('km-zones').setAttribute('aria-pressed', S.zones);
  }

  // --- проигрывание 30 дней ---
  function stopPlay() { if (S.playing) { clearInterval(S.playing); S.playing = null; document.getElementById('km-play').setAttribute('aria-pressed', 'false'); } }
  document.getElementById('km-play').onclick = function () {
    if (S.playing) { stopPlay(); S.day = null; refresh(); return; }
    var a = 29; S.day = a; refresh();
    this.setAttribute('aria-pressed', 'true'); gc('play');
    S.playing = setInterval(function () { a--; if (a < 0) { stopPlay(); S.day = null; refresh(); return; } S.day = a; refresh(); }, 650);
  };

  // --- кнопки ---
  document.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { stopPlay(); S.day = null; S.days = +b.getAttribute('data-d'); refresh(); gc('period-' + S.days); }; });
  document.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () { S.kind = b.getAttribute('data-k'); refresh(); gc('kind-' + S.kind); }; });
  document.getElementById('km-zones').onclick = function () { S.zones = !S.zones; refresh(); if (S.zones && map.getZoom() < 7) map.flyTo({ center: [37.62, 55.75], zoom: 10 }); };
  document.getElementById('km-feed-b').onclick = function () { open('<h2>' + T.feed + '</h2>' + document.getElementById('km-feed').innerHTML); C.querySelectorAll('.km-fi').forEach(function (b) { b.onclick = function (ev) { if (ev.target.closest('a')) return; var e = D.events[+b.getAttribute('data-i')]; var ft = e.r.length && D.regions.features.filter(function (x) { return x.properties.n === e.r[0]; })[0]; if (ft) { flyToFeature(ft); showRegion(ft.properties); } }; }); gc('feed'); };

  // --- геометрия: регион по точке ---
  function inRing(pt, ring) { var x = pt[0], y = pt[1], ins = false; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins; } return ins; }
  function inPoly(pt, polys) { for (var p = 0; p < polys.length; p++) { if (inRing(pt, polys[p][0])) { var hole = false; for (var h = 1; h < polys[p].length; h++) if (inRing(pt, polys[p][h])) hole = true; if (!hole) return true; } } return false; }
  var RB = [];
  function prepRegions() {
    D.regions.features.forEach(function (f) {
      var polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates, b = [999, 999, -999, -999];
      polys.forEach(function (p) { p[0].forEach(function (c) { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); }); });
      RB.push({ f: f, polys: polys, b: b });
    });
    RB.sort(function (x, y) { return (x.b[2] - x.b[0]) * (x.b[3] - x.b[1]) - (y.b[2] - y.b[0]) * (y.b[3] - y.b[1]); });
  }
  function regionAt(lon, lat) {
    if (lon < 0) lon += 360;
    for (var i = 0; i < RB.length; i++) { var r = RB[i]; if (lon < r.b[0] || lon > r.b[2] || lat < r.b[1] || lat > r.b[3]) continue; if (inPoly([lon, lat], r.polys)) return r.f; }
    return null;
  }
  function km(a, b) { var R = 6371, dLa = (b[1] - a[1]) * Math.PI / 180, dLo = (b[0] - a[0]) * Math.PI / 180, x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R * Math.asin(Math.sqrt(x)); }

  // --- где я ---
  document.getElementById('km-me').onclick = function () {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (p) {
      var ll = [p.coords.longitude, p.coords.latitude];
      if (meMk) meMk.remove();
      var el = document.createElement('div'); el.className = 'km-me';
      meMk = new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map);
      map.flyTo({ center: ll, zoom: 10, padding: pad() });
      var f = regionAt(ll[0], ll[1]);
      if (f) showRegion(f.properties);
      gc('locate');
    }, function () { }, { enableHighAccuracy: false, timeout: 10000 });
  };

  // --- маршрут ---
  var SEG = ['#34d399', '#f6c177', '#f08a5d', '#ff5079'];
  function seg(n) { if (EN) return n === 1 ? 'segment with restrictions' : 'segments with restrictions'; var a = n % 100, b = n % 10; return (a > 10 && a < 20 || b > 4 || b === 0 ? 'участков' : b === 1 ? 'участок' : 'участка') + ' с ограничениями'; }
  function segCol(n) { return n < 1 ? SEG[0] : n < 2 ? SEG[1] : n < 4 ? SEG[2] : SEG[3]; }
  function routeForm(a, b) {
    open('<h2>' + T.route + '</h2><form class="km-form" id="km-rf"><label><span>' + T.from + '</span><input id="km-a" value="' + esc(a || '') + '" required autocomplete="off"></label><label><span>' + T.to + '</span><input id="km-bb" value="' + esc(b || '') + '" required autocomplete="off"></label>' +
      '<button class="km-go" type="submit">' + T.go + '</button></form><p class="km-sub">' + T.tips + '</p><div id="km-rr"></div>');
    document.getElementById('km-rf').onsubmit = function (ev) { ev.preventDefault(); runRoute(document.getElementById('km-a').value, document.getElementById('km-bb').value); };
  }
  document.getElementById('km-route').onclick = function () { routeForm(); gc('route-open'); };
  function geocode(q) {
    return fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ru&accept-language=' + (EN ? 'en' : 'ru') + '&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.length) throw new Error(T.nf + q); return [parseFloat(j[0].lon), parseFloat(j[0].lat)]; });
  }
  function runRoute(a, b) {
    var out = document.getElementById('km-rr'); out.innerHTML = '<p class="km-sub">' + T.searching + '</p>';
    var A;
    geocode(a).then(function (x) { A = x; return new Promise(function (res) { setTimeout(res, 1100); }); })
      .then(function () { return geocode(b); })
      .then(function (B) { return fetch('https://router.project-osrm.org/route/v1/driving/' + A[0] + ',' + A[1] + ';' + B[0] + ',' + B[1] + '?overview=full&geometries=geojson').then(function (r) { return r.json(); }); })
      .then(function (j) {
        if (!j.routes || !j.routes.length) throw new Error(T.rerr);
        analyze(j.routes[0].geometry.coordinates, out, a, b); gc('route');
        try { history.replaceState(null, '', '?from=' + encodeURIComponent(a) + '&to=' + encodeURIComponent(b)); } catch (e) { }
      })
      .catch(function (e) { out.innerHTML = '<p>' + esc(e.message || T.rerr) + '</p>'; });
  }
  function analyze(coords, out, a, b) {
    var segs = [], dist = 0, last = coords[0], cur = null, pts = [];
    for (var i = 0; i < coords.length; i++) {
      var c = coords[i]; dist += km(last, c); last = c;
      if (i === 0 || i === coords.length - 1 || km(pts[pts.length - 1], c) > 3) {
        pts.push(c);
        var f = regionAt(c[0], c[1]), name = f ? f.properties.n : '';
        if (!cur || cur.n !== name) { if (cur) cur.pts.push(c); cur = { n: name, p: f ? f.properties : null, s: dist, e: dist, pts: [] }; segs.push(cur); }
        cur.e = dist;
      }
      if (cur) cur.pts.push(c);
    }
    var feats = [], hits = [], seen = {};
    segs.forEach(function (s) {
      var ev = s.n ? regEvents(s.n) : [], n = ev.length;
      if (s.pts.length > 1) feats.push({ type: 'Feature', properties: { c: segCol(n) }, geometry: { type: 'LineString', coordinates: s.pts } });
      if (!s.n) return;
      var last = hits[hits.length - 1];
      if (last && last.key === s.n) { last.e = s.e; return; }
      if (seen[s.n] && s.e - s.s < 5) return;
      seen[s.n] = 1;
      hits.push({ key: s.n, s: s.s, e: s.e, label: rname(s.p), n: n, ev: ev });
    });
    var risky = hits.filter(function (h) { return h.n; }).length;
    S.route = { type: 'FeatureCollection', features: feats };
    if (map.getSource('rt')) map.getSource('rt').setData(S.route);
    var bb = [999, 999, -999, -999]; coords.forEach(function (c) { bb[0] = Math.min(bb[0], c[0]); bb[1] = Math.min(bb[1], c[1]); bb[2] = Math.max(bb[2], c[0]); bb[3] = Math.max(bb[3], c[1]); });
    map.fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: pad(), duration: 900 });
    var near = [];
    D.zones.forEach(function (z) { for (var i = 0; i < pts.length; i++) if (km(pts[i], [z.lon, z.lat]) * 1000 < z.r + 2000) { near.push('<div class="km-step"><i style="background:#8b5cf6"></i><div><b>' + esc(EN ? z.te : z.t) + '</b><small>' + esc(EN ? z.me : z.m) + '</small></div></div>'); break; } });
    var total = Math.max(1, dist), bar = hits.map(function (h) { return '<span style="flex:' + Math.max(1, h.e - h.s).toFixed(0) + ';background:' + segCol(h.n) + '"></span>'; }).join('');
    var head = '<div class="km-rsum"><b>' + Math.round(dist) + ' ' + T.km + ' · ' + (risky ? risky + ' ' + seg(risky) : T.norisk) + '</b>' + (risky ? '<span class="km-lvl ' + (risky > 2 ? 'hi' : 'md') + '">' + (risky > 2 ? T.riskhi : T.riskmd) + '</span>' : '') + '</div><div class="km-rbar">' + bar + '</div>';
    var h = head + hits.map(function (s) {
      return '<div class="km-step"><i style="background:' + segCol(s.n) + '"></i><div><div class="km-step-h"><b>' + esc(s.label) + '</b><small>' + (s.e - s.s < 1 ? '' : Math.round(s.s) + '-' + Math.round(s.e) + ' ' + T.km) + '</small></div>' +
        '<small>' + (s.n ? s.n + ' ' + pl(s.n) + ': ' + esc(EN ? s.ev[0].te : s.ev[0].t) : T.noev) + '</small></div></div>';
    }).join('') + near.join('');
    if (!risky && !near.length) h += '<p>' + T.clean + '</p>';
    h += '<a class="km-go" href="' + T.bot + '" data-goatcounter-click="bot/karta-route/" rel="nofollow" target="_blank">' + T.prep + '</a>';
    out.innerHTML = h + '<p class="km-sub">' + T.note + '</p>';
  }

  // --- старт ---
  var hdr = document.querySelector('header'); if (hdr) root.style.setProperty('--hdr', hdr.offsetHeight + 'px');
  var BLANK = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': dark() ? '#0d0e15' : '#eef0f7' } }] };
  function styleUrl() { return 'https://tiles.openfreemap.org/styles/' + (dark() ? 'dark' : 'positron'); }
  map = new maplibregl.Map({
    container: 'km-map', style: styleUrl(), center: [70, 60], zoom: 2.4, minZoom: 1.5, maxZoom: 16, attributionControl: false,
    dragRotate: false, pitchWithRotate: false, touchPitch: false
  });
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.touchZoomRotate.disableRotation();
  var fb = setTimeout(function () { if (!styleOk) { map.setStyle(BLANK); } }, 7000);
  map.on('error', function (e) { if (!styleOk && e && e.error && /style|Failed to fetch|NetworkError/i.test(String(e.error.message || e.error))) { clearTimeout(fb); styleOk = true; map.setStyle(BLANK); } });
  map.on('style.load', function () { styleOk = true; clearTimeout(fb); ready = false; tryAdd(); });
  map.on('moveend', function () { if (cityMk.length) declutter(); });
  var hov = null;
  map.on('mousemove', 'reg-fill', function (e) { if (!e.features.length) return; if (hov !== null) map.setFeatureState({ source: 'reg', id: hov }, { h: false }); hov = e.features[0].id; map.setFeatureState({ source: 'reg', id: hov }, { h: true }); map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'reg-fill', function () { if (hov !== null) map.setFeatureState({ source: 'reg', id: hov }, { h: false }); hov = null; map.getCanvas().style.cursor = ''; });
  map.on('click', function (e) {
    if (!ready) return;
    var z = map.getLayer('zon-fill') && map.queryRenderedFeatures(e.point, { layers: ['zon-fill'] });
    if (z && z.length) { showZone(D.zones[z[z.length - 1].properties.i]); return; }
    var r = map.queryRenderedFeatures(e.point, { layers: ['reg-fill'] });
    if (r.length) showRegion(r[0].properties);
  });
  // смена темы сайта: перекрашиваем подложку и шкалу
  new MutationObserver(function () { if (!D) return; styleOk = false; map.setStyle(styleUrl()); fb = setTimeout(function () { if (!styleOk) map.setStyle(BLANK); }, 7000); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  fetch(KM_PRE.replace('/en', '') + '/karta/data.json?v=' + Date.now().toString().slice(0, 7)).then(function (r) { return r.json(); }).then(function (d) {
    D = d; prepRegions();
    var ld = document.querySelector('.km-load'); if (ld) ld.remove();
    document.getElementById('km-upd').textContent = dd(D.updated.slice(0, 10));
    tryAdd();
    map.fitBounds(wide() ? [[28, 42], [176, 72]] : [[30, 44], [100, 68]], { padding: wide() ? { top: 150, bottom: 120, left: 30, right: 30 } : { top: 170, bottom: 80, left: 8, right: 8 }, duration: 0 });
    refresh();
    var q = new URLSearchParams(location.search);
    if (q.get('from') && q.get('to')) { routeForm(q.get('from'), q.get('to')); runRoute(q.get('from'), q.get('to')); }
    else if (q.get('route') !== null) routeForm();
  });
})();
