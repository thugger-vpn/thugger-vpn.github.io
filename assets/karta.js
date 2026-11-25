/* Карта-навигатор ThuggerVPN: регионы, города, зоны, маршрут. Данные: /karta/data.json */
(function () {
  var T = window.KM_T, EN = document.getElementById('km').getAttribute('data-lang') === 'en';
  var days = 7, D = null, map, regLayer, cityLayer, zoneLayer, routeLayer, meMarker;
  var sheet = document.getElementById('km-sheet'), C = document.getElementById('km-c');
  var COL = ['transparent', '#f6c177', '#f08a5d', '#e84855'];
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lv(n) { return n < 1 ? 0 : n < 2 ? 1 : n < 4 ? 2 : 3; }
  function evOk(e) { return e.a < days; }
  function regEvents(name) { return D.events.filter(function (e) { return evOk(e) && e.r.indexOf(name) >= 0; }); }
  function natEvents() { return D.events.filter(function (e) { return evOk(e) && !e.r.length; }); }
  function rname(f) { return EN && f.properties.en ? f.properties.en : f.properties.n; }
  function pl(n){var a=n%100,b=n%10;if(a>10&&a<20)return EN?'events':'событий';if(b===1)return EN?(n===1?'event':'events'):'событие';if(b>1&&b<5)return EN?'events':'события';return EN?'events':'событий';}
  function dd(s) { return s.slice(8, 10) + '.' + s.slice(5, 7); }
  function evHtml(e) {
    return '<div class="km-ev"><small>' + dd(e.d) + '</small><b>' + esc(EN ? e.te : e.t) + '</b><small>' + esc(EN ? e.me : e.m) + '</small>' +
      (e.u ? '<br><a href="' + esc(e.u) + '" target="_blank" rel="noopener nofollow">' + T.src + ': ' + esc(e.s || 'link') + '</a>' : '') + '</div>';
  }
  function open(h) { C.innerHTML = h; sheet.classList.add('on'); sheet.classList.remove('min'); }
  function close() { sheet.classList.remove('on'); }
  sheet.querySelector('.km-x').onclick = close;
  sheet.querySelector('.km-h').onclick = function () { sheet.classList.toggle('min'); };
  function links() { return '<div class="km-links"><a href="' + KM_PRE + '/status/">' + T.status + ' →</a><a href="' + KM_PRE + '/check/">' + T.check + ' →</a></div>'; }
  function gc(p) { try { goatcounter.count({ path: 'karta/' + p, title: 'karta ' + p, event: true }); } catch (e) { } }

  function showRegion(name, label) {
    var L = regEvents(name), N = natEvents();
    var h = '<h2>' + esc(label) + '</h2>' + (L.length ? L.map(evHtml).join('') : '<p>' + T.none + '</p>');
    if (N.length) h += '<h2 style="margin-top:14px;font-size:16px">' + (EN ? 'Nationwide' : 'По всей стране') + '</h2>' + N.map(evHtml).join('');
    open(h + links()); gc('region');
  }
  function styleReg(f) {
    var n = regEvents(f.properties.n).length;
    return { color: '#7c3aed', weight: .6, opacity: .5, fillColor: COL[lv(n)], fillOpacity: n ? .45 : 0 };
  }
  function drawCities() {
    cityLayer.clearLayers();
    D.cities.forEach(function (c) {
      var L = c.e.map(function (i) { return D.events[i]; }).filter(evOk);
      if (!L.length) return;
      L.sort(function (a, b) { return a.a - b.a; });
      var mk = window.L.circleMarker([c.lat, c.lon], { radius: 6 + Math.min(8, L.length * 2), color: '#fff', weight: 2, fillColor: COL[lv(L.length)] === 'transparent' ? '#f6c177' : COL[lv(L.length)], fillOpacity: .95 });
      mk.on('click', function () { open('<h2>' + esc(c.n) + '</h2>' + L.map(evHtml).join('') + links()); gc('city'); });
      mk.bindTooltip(c.n + ' · ' + L.length);
      cityLayer.addLayer(mk);
    });
  }
  function drawZones() {
    zoneLayer.clearLayers();
    D.zones.forEach(function (z) {
      var gps = z.kind === 'gps';
      var c = window.L.circle([z.lat, z.lon], { radius: z.r, color: gps ? '#7c3aed' : '#db2777', weight: 2, dashArray: gps ? '6 6' : null, fillColor: gps ? '#7c3aed' : '#db2777', fillOpacity: .12 });
      c.on('click', function (ev) {
        window.L.DomEvent.stopPropagation(ev);
        open('<h2>' + esc(EN ? z.te : z.t) + '</h2><p><b>' + T.zone + (z.since ? ' · ' + (EN ? 'since ' : 'с ') + z.since : '') + '</b></p><p>' + esc(EN ? z.me : z.m) + '</p>' +
          (z.s || []).map(function (s) { return '<a href="' + esc(s.u) + '" target="_blank" rel="noopener nofollow">' + T.src + ': ' + esc(s.t) + '</a>'; }).join('<br>') + links());
        gc('zone');
      });
      c.bindTooltip(EN ? z.te : z.t);
      zoneLayer.addLayer(c);
    });
  }
  function repaint() { regLayer.setStyle(styleReg); drawCities(); }

  // --- геометрия ---
  function inRing(pt, ring) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
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
      var ll = [p.coords.latitude, p.coords.longitude];
      if (meMarker) map.removeLayer(meMarker);
      meMarker = window.L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map);
      map.flyTo(ll, 11);
      var f = regionAt(ll[1], ll[0]);
      if (f) showRegion(f.properties.n, rname(f));
      gc('locate');
    }, function () { }, { enableHighAccuracy: false, timeout: 10000 });
  };

  // --- маршрут ---
  function routeForm(a, b) {
    sheet.classList.remove('half');
    open('<h2>' + T.route + '</h2><form class="km-form" id="km-rf"><input id="km-a" placeholder="' + T.from + '" value="' + esc(a || '') + '" required><input id="km-b" placeholder="' + T.to + '" value="' + esc(b || '') + '" required>' +
      '<button class="km-b pri" type="submit">' + T.go + '</button></form><p>' + T.tips + '</p><div id="km-rr"></div>');
    document.getElementById('km-rf').onsubmit = function (ev) { ev.preventDefault(); runRoute(document.getElementById('km-a').value, document.getElementById('km-b').value); };
  }
  document.getElementById('km-route').onclick = function () { routeForm(); gc('route-open'); };
  function geocode(q) {
    return fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ru&accept-language=' + (EN ? 'en' : 'ru') + '&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); }).then(function (j) { if (!j.length) throw new Error(T.nf + q); return [parseFloat(j[0].lon), parseFloat(j[0].lat)]; });
  }
  function runRoute(a, b) {
    var out = document.getElementById('km-rr'); out.innerHTML = '<p>' + T.searching + '</p>';
    var A;
    geocode(a).then(function (x) { A = x; return new Promise(function (res) { setTimeout(res, 1100); }); })
      .then(function () { return geocode(b); })
      .then(function (B) {
        return fetch('https://router.project-osrm.org/route/v1/driving/' + A[0] + ',' + A[1] + ';' + B[0] + ',' + B[1] + '?overview=full&geometries=geojson')
          .then(function (r) { return r.json(); });
      })
      .then(function (j) {
        if (!j.routes || !j.routes.length) throw new Error(T.rerr);
        analyze(j.routes[0].geometry.coordinates, out); gc('route');
        try { history.replaceState(null, '', '?from=' + encodeURIComponent(a) + '&to=' + encodeURIComponent(b)); } catch (e) { }
      })
      .catch(function (e) { out.innerHTML = '<p>' + esc(e.message || T.rerr) + '</p>'; });
  }
  function analyze(coords, out) {
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = window.L.layerGroup().addTo(map);
    var segs = [], dist = 0, last = coords[0], cur = null, acc = 0, pts = [];
    function push(f, k) {
      var name = f ? f.properties.n : '';
      if (!cur || cur.n !== name) { cur = { n: name, label: f ? rname(f) : '', s: k, e: k, pts: [] }; segs.push(cur); }
      cur.e = k;
    }
    for (var i = 0; i < coords.length; i++) {
      var c = coords[i]; dist += km(last, c); last = c; acc += 1;
      if (i === 0 || i === coords.length - 1 || acc >= 1 && (pts.length === 0 || km(pts[pts.length - 1], c) > 3)) { pts.push(c); push(regionAt(c[0], c[1]), dist); acc = 0; }
      if (cur) cur.pts.push([c[1], c[0]]);
    }
    var hits = [];
    segs.forEach(function (s) {
      var n = s.n ? regEvents(s.n).length : 0;
      window.L.polyline(s.pts, { color: n ? COL[lv(n)] : '#7c3aed', weight: 6, opacity: .9 }).addTo(routeLayer);
      if (s.n) hits.push({ k: s.s, e: s.e, label: s.label, n: n, ev: regEvents(s.n) });
    });
    // зоны и города рядом с путём
    var near = [];
    D.zones.forEach(function (z) { for (var i = 0; i < pts.length; i++) if (km(pts[i], [z.lon, z.lat]) * 1000 < z.r + 2000) { near.push('<div class="km-step"><i style="background:#7c3aed"></i><div><b>' + esc(EN ? z.te : z.t) + '</b><br><small>' + esc(EN ? z.me : z.m) + '</small></div></div>'); break; } });
    D.cities.forEach(function (c) {
      var L = c.e.map(function (i) { return D.events[i]; }).filter(evOk); if (!L.length) return;
      for (var i = 0; i < pts.length; i++) if (km(pts[i], [c.lon, c.lat]) < 15) { near.push('<div class="km-step"><i style="background:' + COL[lv(L.length)] + '"></i><div><b>' + esc(c.n) + '</b> · ' + L.length + ' ' + pl(L.length) + '<br><small>' + esc(EN ? L[0].te : L[0].t) + '</small></div></div>'); break; }
    });
    sheet.classList.add('half');
    var ph = Math.round(sheet.offsetHeight || 300);
    map.fitBounds(window.L.polyline(coords.map(function (c) { return [c[1], c[0]]; })).getBounds(), { paddingTopLeft: [24, 70], paddingBottomRight: [24, Math.min(ph, innerHeight * .45) + 20] });
    var bad = hits.filter(function (h) { return h.n; });
    var h = '<p><b>' + Math.round(dist) + ' ' + T.km + '</b></p><h2 style="font-size:17px">' + T.onroute + '</h2>';
    h += hits.map(function (s) {
      return '<div class="km-step"><i style="background:' + (s.n ? COL[lv(s.n)] : 'var(--line2)') + '"></i><div><b>' + esc(s.label) + '</b> <small>' + Math.round(s.k) + '-' + Math.round(s.e) + ' ' + T.km + '</small>' +
        (s.n ? '<br><small>' + s.n + ' ' + pl(s.n) + ': ' + esc(EN ? s.ev[0].te : s.ev[0].t) + '</small>' : '') + '</div></div>';
    }).join('');
    h += near.join('');
    if (!bad.length && !near.length) h += '<p>' + T.clean + '</p>';
    out.innerHTML = h + '<p>' + T.note + '</p>';
  }

  // --- период ---
  document.querySelectorAll('.km-b[data-d]').forEach(function (b) {
    b.onclick = function () { days = +b.getAttribute('data-d'); document.querySelectorAll('.km-b[data-d]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); if (D) repaint(); };
  });

  // --- старт ---
  var hdr = document.querySelector('header'); if (hdr) document.getElementById('km').style.setProperty('--hdr', hdr.offsetHeight + 'px');
  map = window.L.map('km-map', { zoomControl: false, worldCopyJump: false, minZoom: 2, maxZoom: 17 }).fitBounds([[43, 27], [66, 62]]);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  window.L.control.zoom({ position: 'bottomright' }).addTo(map);
  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  fetch(KM_PRE.replace('/en', '') + '/karta/data.json?v=' + Date.now().toString().slice(0, 7)).then(function (r) { return r.json(); }).then(function (d) {
    D = d; prepRegions();
    document.querySelector('.km-load').remove();
    regLayer = window.L.geoJSON(D.regions, { style: styleReg, onEachFeature: function (f, l) { l.on('click', function () { showRegion(f.properties.n, rname(f)); }); } }).addTo(map);
    zoneLayer = window.L.layerGroup().addTo(map); cityLayer = window.L.layerGroup().addTo(map);
    drawZones(); drawCities();
    var q = new URLSearchParams(location.search);
    if (q.get('from') && q.get('to')) { routeForm(q.get('from'), q.get('to')); runRoute(q.get('from'), q.get('to')); }
    else if (q.get('route') !== null) routeForm();
  });
})();
