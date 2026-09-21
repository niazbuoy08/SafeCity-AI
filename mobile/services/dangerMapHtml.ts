/**
 * Self-contained Leaflet page rendered inside a WebView on the Danger Map
 * screen. Leaflet + OpenStreetMap needs no API key (unlike Google Maps on a
 * standalone Android build). React Native pushes data in by calling
 * window.SC.setData / setUser / focus / setPickMode / setRoute via
 * injectJavaScript; taps on the map (while picking a destination) are sent
 * back to React Native with postMessage.
 *
 * The heat gradient is one hue (light -> dark red): a single-hue ramp reads
 * as "more of one thing" (danger), whereas the usual blue/green/yellow/red
 * rainbow implies unrelated categories. Matches the web dashboard heatmap.
 */
export const DANGER_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #e5e7eb; }
  #err { padding: 24px; font: 14px system-ui, sans-serif; color: #475569; text-align: center; }
  .z { width: 28px; height: 28px; box-sizing: border-box; border-radius: 50%; background: #fff;
       color: #0f1b3d; font: 700 12px system-ui, sans-serif; display: flex; align-items: center;
       justify-content: center; border: 3px solid #e34948; box-shadow: 0 1px 4px rgba(0,0,0,.4); }
  .z.medium { border-color: #c22f2f; }
  .z.high { border-color: #7d1c1c; }
  .leaflet-popup-content { font: 13px system-ui, sans-serif; margin: 10px 12px; }
  .dest { font-size: 28px; line-height: 28px; color: #0f1b3d; text-shadow: 0 0 3px #fff, 0 0 3px #fff; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.heat/0.2.0/leaflet-heat.js"></script>
<script>
(function () {
  if (typeof L === 'undefined' || !L.heatLayer) {
    document.body.innerHTML = '<div id="err">The map could not load. Check your internet connection and reopen this tab.</div>';
    return;
  }

  var map = L.map('map', { zoomControl: true }).setView([23.7808, 90.3995], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  var GRADIENT = { 0.2: '#fbe4e3', 0.4: '#f0a8a4', 0.6: '#e34948', 0.8: '#c22f2f', 1.0: '#7d1c1c' };
  var heat = null;
  var zoneLayer = L.layerGroup().addTo(map);
  var userMarker = null;
  var fitted = false;
  var routeLayer = L.layerGroup().addTo(map);
  var pickMode = false;

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  // While "pick a destination" is on, a tap on the map reports its coordinates.
  map.on('click', function (e) {
    if (pickMode) post({ type: 'pick', latitude: e.latlng.lat, longitude: e.latlng.lng });
  });

  function ll(p) { return [p.latitude, p.longitude]; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // The WebView can report its size after the map is created; re-measure so
  // tiles cover the whole container.
  window.addEventListener('resize', function () { map.invalidateSize(); });
  window.addEventListener('load', function () { map.invalidateSize(); });

  window.SC = {
    setData: function (d) {
      map.invalidateSize();
      if (heat) { map.removeLayer(heat); heat = null; }
      zoneLayer.clearLayers();

      if (d.heatPoints && d.heatPoints.length) {
        heat = L.heatLayer(
          d.heatPoints.map(function (p) { return [p.latitude, p.longitude, p.weight]; }),
          { radius: 45, blur: 30, maxZoom: 15, max: 1.0, minOpacity: 0.35, gradient: GRADIENT }
        ).addTo(map);
      }

      var bounds = [];
      (d.zones || []).forEach(function (z) {
        var icon = L.divIcon({
          className: '',
          html: '<div class="z ' + z.riskLevel + '">' + z.incidentCount + '</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        L.marker([z.latitude, z.longitude], { icon: icon })
          .bindPopup('<b>' + esc(z.name) + '</b><br/>' + z.incidentCount + ' verified incident' +
            (z.incidentCount === 1 ? '' : 's') + '<br/>Risk: ' + esc(z.riskLevel))
          .addTo(zoneLayer);
        bounds.push([z.latitude, z.longitude]);
      });

      if (bounds.length && !fitted) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        fitted = true;
      }
    },

    setUser: function (u) {
      if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
      if (!u) return;
      userMarker = L.circleMarker([u.latitude, u.longitude], {
        radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1
      }).bindPopup('You are here').addTo(map);
    },

    focus: function (lat, lng) {
      map.flyTo([lat, lng], 15, { duration: 0.8 });
    },

    setPickMode: function (on) {
      pickMode = !!on;
      map.getContainer().style.cursor = pickMode ? 'crosshair' : '';
    },

    // r = { destination, direct: [pts], detour: [pts] | null, via: [pts] } or null to clear
    setRoute: function (r) {
      routeLayer.clearLayers();
      if (!r) return;
      var all = [];
      L.polyline(r.direct.map(ll), { color: '#475569', weight: 4, opacity: 0.9, dashArray: '8 8' }).addTo(routeLayer);
      r.direct.forEach(function (p) { all.push(ll(p)); });
      if (r.detour) {
        L.polyline(r.detour.map(ll), { color: '#16a34a', weight: 6, opacity: 0.95 }).addTo(routeLayer);
        r.detour.forEach(function (p) { all.push(ll(p)); });
        (r.via || []).forEach(function (v) {
          L.circleMarker(ll(v), { radius: 6, color: '#ffffff', weight: 2, fillColor: '#16a34a', fillOpacity: 1 })
            .bindPopup('Detour point').addTo(routeLayer);
        });
      }
      L.marker(ll(r.destination), {
        icon: L.divIcon({ className: '', html: '<div class="dest">⚑</div>', iconSize: [28, 28], iconAnchor: [6, 26] })
      }).addTo(routeLayer);
      map.fitBounds(all, { padding: [60, 60], maxZoom: 15 });
    }
  };
})();
</script>
</body>
</html>`;
