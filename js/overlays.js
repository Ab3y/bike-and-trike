/* =============================================
   Overlays — Crime (clickable), Crowd, Bike Paths, Elevation Chart
   ============================================= */

const Overlays = {

  // ── Crime types for realistic popups ──
  CRIME_TYPES: [
    { type: 'Theft / Larceny', icon: '🔓', weight: 30 },
    { type: 'Vehicle Break-in', icon: '🚗', weight: 20 },
    { type: 'Assault', icon: '⚠️', weight: 12 },
    { type: 'Robbery', icon: '💰', weight: 10 },
    { type: 'Vandalism', icon: '🎨', weight: 15 },
    { type: 'Burglary', icon: '🏠', weight: 8 },
    { type: 'Drug Offense', icon: '💊', weight: 10 },
    { type: 'Disorderly Conduct', icon: '📢', weight: 12 },
    { type: 'Trespassing', icon: '🚧', weight: 8 },
    { type: 'Fraud / Scam', icon: '📋', weight: 5 }
  ],

  /** Pick weighted-random crime types for a zone */
  _pickCrimes(seed, count) {
    // Deterministic pseudo-random from seed
    let s = Math.abs(Math.sin(seed * 9301 + 49297)) * 233280;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

    const pool = [];
    this.CRIME_TYPES.forEach(c => {
      for (let i = 0; i < c.weight; i++) pool.push(c);
    });

    const picked = [];
    const seen = new Set();
    while (picked.length < count && picked.length < this.CRIME_TYPES.length) {
      const item = pool[Math.floor(rng() * pool.length)];
      if (!seen.has(item.type)) {
        seen.add(item.type);
        const incidents = Math.floor(rng() * 18) + 2;
        picked.push({ ...item, incidents });
      }
    }
    return picked.sort((a, b) => b.incidents - a.incidents);
  },

  /** Build popup HTML for a crime zone */
  _crimePopupHTML(lat, lng, crimes) {
    const rows = crimes.map(c =>
      `<tr><td>${c.icon}</td><td>${c.type}</td><td style="text-align:right;font-weight:600">${c.incidents}</td></tr>`
    ).join('');
    return `
      <div style="min-width:200px;font-family:sans-serif;font-size:13px;">
        <div style="font-weight:700;margin-bottom:6px;font-size:14px;">
          🚨 Crime Zone <span style="font-size:11px;color:#888;">(Demo)</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="color:#888;font-size:11px;">
            <th></th><th style="text-align:left;">Type</th><th style="text-align:right;">Reports</th>
          </tr>
          ${rows}
        </table>
        <div style="margin-top:6px;font-size:10px;color:#999;">
          📍 ${lat.toFixed(4)}, ${lng.toFixed(4)} · Simulated data
        </div>
      </div>`;
  },

  /** Generate crime zone data along route */
  generateCrimeZones(routeCoords) {
    const zones = [];
    const step = Math.max(1, Math.floor(routeCoords.length / 25));
    for (let i = 0; i < routeCoords.length; i += step) {
      const [lat, lng] = routeCoords[i];
      const density = Math.abs(Math.sin(lat * 100) * Math.cos(lng * 100));
      if (density < 0.15) continue; // skip low-crime areas

      const severity = density > 0.6 ? 'high' : density > 0.35 ? 'medium' : 'low';
      const crimeCount = severity === 'high' ? 5 : severity === 'medium' ? 3 : 2;
      const offsetLat = (Math.sin(i * 7.3) * 0.003);
      const offsetLng = (Math.cos(i * 5.1) * 0.003);
      const zLat = lat + offsetLat;
      const zLng = lng + offsetLng;

      zones.push({
        lat: zLat, lng: zLng,
        severity,
        radius: severity === 'high' ? 280 : severity === 'medium' ? 200 : 140,
        crimes: this._pickCrimes(lat * 1000 + lng * 1000 + i, crimeCount)
      });
    }
    return zones;
  },

  /** Show/hide clickable crime overlay */
  toggleCrime(show) {
    if (AppState.crimeLayer) {
      AppState.map.removeLayer(AppState.crimeLayer);
      AppState.crimeLayer = null;
    }
    if (show && AppState.routeCoords.length > 0) {
      const zones = this.generateCrimeZones(AppState.routeCoords);
      const group = L.layerGroup();

      const colors = { high: '#ff1744', medium: '#ff9100', low: '#ffd600' };
      const fillOpacities = { high: 0.25, medium: 0.18, low: 0.12 };

      zones.forEach(z => {
        const circle = L.circle([z.lat, z.lng], {
          radius: z.radius,
          color: colors[z.severity],
          weight: 1.5,
          opacity: 0.6,
          fillColor: colors[z.severity],
          fillOpacity: fillOpacities[z.severity],
          className: 'crime-zone-circle'
        });
        circle.bindPopup(this._crimePopupHTML(z.lat, z.lng, z.crimes), {
          maxWidth: 280, className: 'crime-popup'
        });
        group.addLayer(circle);
      });

      group.addTo(AppState.map);
      AppState.crimeLayer = group;
    }
  },

  /** Generate simulated crowd density points */
  generateCrowdData(routeCoords) {
    const points = [];
    const hour = new Date().getHours();
    const timeFactor = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18) ? 1.5 : 0.7;
    const step = Math.max(1, Math.floor(routeCoords.length / 30));
    for (let i = 0; i < routeCoords.length; i += step) {
      const [lat, lng] = routeCoords[i];
      const density = Math.abs(Math.cos(lat * 200 + lng * 300)) * timeFactor;
      const count = Math.floor(density * 4) + 1;
      for (let j = 0; j < count; j++) {
        const offsetLat = (Math.random() - 0.5) * 0.006;
        const offsetLng = (Math.random() - 0.5) * 0.006;
        points.push([lat + offsetLat, lng + offsetLng, 0.3 + Math.random() * 0.5]);
      }
    }
    return points;
  },

  /** Show/hide crowd overlay */
  toggleCrowd(show) {
    if (AppState.crowdLayer) {
      AppState.map.removeLayer(AppState.crowdLayer);
      AppState.crowdLayer = null;
    }
    if (show && AppState.routeCoords.length > 0) {
      const data = this.generateCrowdData(AppState.routeCoords);
      AppState.crowdLayer = L.heatLayer(data, {
        radius: 20, blur: 18, maxZoom: 17,
        gradient: { 0.2: '#004b23', 0.4: '#006400', 0.6: '#38b000', 0.8: '#ffff3f', 1.0: '#ff6700' }
      }).addTo(AppState.map);
    }
  },

  // ── Bike Paths via Overpass API (free, no key) ──

  /** Fetch nearby bike paths from OpenStreetMap via Overpass */
  async toggleBikePaths(show) {
    if (AppState.bikePathLayer) {
      AppState.map.removeLayer(AppState.bikePathLayer);
      AppState.bikePathLayer = null;
    }
    if (!show) return;

    const bounds = AppState.map.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

    // Cache check — avoid re-fetching same area
    if (AppState._bikePathCache && AppState._bikePathCache.bbox === bbox) {
      AppState.bikePathLayer = AppState._bikePathCache.layer;
      AppState.bikePathLayer.addTo(AppState.map);
      return;
    }

    const query = `
      [out:json][timeout:15];
      (
        way["highway"="cycleway"](${bbox});
        way["bicycle"="designated"](${bbox});
        way["cycleway"~"track|lane|shared_lane"](${bbox});
      );
      out body geom;
    `;

    try {
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query)
      });
      if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
      const data = await resp.json();

      const group = L.layerGroup();
      (data.elements || []).forEach(el => {
        if (!el.geometry || el.geometry.length < 2) return;
        const latlngs = el.geometry.map(p => [p.lat, p.lon]);
        const name = el.tags?.name || el.tags?.highway || 'Bike Path';
        const surfaceTag = el.tags?.surface || 'unknown';

        const line = L.polyline(latlngs, {
          color: '#39ff14', weight: 3, opacity: 0.7,
          dashArray: '8 4', interactive: true
        });
        line.bindPopup(`
          <div style="font-family:sans-serif;font-size:13px;">
            <b>🚴 ${name}</b><br>
            Surface: ${surfaceTag}<br>
            <span style="font-size:11px;color:#888;">OSM Way #${el.id}</span>
          </div>
        `);
        group.addLayer(line);
      });

      group.addTo(AppState.map);
      AppState.bikePathLayer = group;
      AppState._bikePathCache = { bbox, layer: group };
    } catch (e) {
      console.warn('Bike path fetch failed:', e.message);
    }
  },

  /** Draw elevation chart on canvas */
  drawElevationChart(elevationData) {
    const canvas = document.getElementById('elevation-chart');
    if (!canvas || elevationData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 120 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 120;
    const padding = { top: 10, bottom: 20, left: 5, right: 5 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    const elevations = elevationData.map(p => p[2] || 0);
    const minE = Math.min(...elevations);
    const maxE = Math.max(...elevations);
    const range = maxE - minE || 1;

    ctx.clearRect(0, 0, w, h);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.3)');
    grad.addColorStop(1, 'rgba(0, 229, 255, 0.02)');

    ctx.beginPath();
    for (let i = 0; i < elevations.length; i++) {
      const x = padding.left + (i / (elevations.length - 1)) * plotW;
      const y = padding.top + plotH - ((elevations[i] - minE) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(padding.left + plotW, h - padding.bottom);
    ctx.lineTo(padding.left, h - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    for (let i = 0; i < elevations.length; i++) {
      const x = padding.left + (i / (elevations.length - 1)) * plotW;
      const y = padding.top + plotH - ((elevations[i] - minE) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Labels
    ctx.fillStyle = AppState.darkMode ? '#8b949e' : '#656d76';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(Filters.formatElev(maxE), padding.left + 2, padding.top + 10);
    ctx.fillText(Filters.formatElev(minE), padding.left + 2, h - padding.bottom - 4);
  },

  /** Refresh all active overlays */
  refreshAll() {
    this.toggleCrime(AppState.filters.crime);
    this.toggleCrowd(AppState.filters.crowd);
    if (AppState.filters.bikePaths) this.toggleBikePaths(true);
    if (AppState.filters.familyFriendly) this.toggleFamilyPOIs(true);
    if (AppState.filters.elevation && AppState.elevationData.length > 0) {
      this.drawElevationChart(AppState.elevationData);
    }
    this.updateFamilyScore();
  },

  /** Clear all overlays */
  clearAll() {
    this.toggleCrime(false);
    this.toggleCrowd(false);
    this.toggleBikePaths(false);
    this.toggleFamilyPOIs(false);
    const canvas = document.getElementById('elevation-chart');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  },

  // ── Family-friendly POIs via Overpass (parks, restrooms, playgrounds, water) ──

  POI_CONFIG: {
    playground:  { icon: '🛝', label: 'Playground', color: '#ff6b6b' },
    park:        { icon: '🌳', label: 'Park',       color: '#3fb950' },
    toilets:     { icon: '🚻', label: 'Restroom',   color: '#58a6ff' },
    drinking_water: { icon: '🚰', label: 'Water Fountain', color: '#00e5ff' },
    picnic_table: { icon: '🧺', label: 'Picnic Area', color: '#f0883e' },
    bench:       { icon: '🪑', label: 'Bench / Rest', color: '#8b949e' }
  },

  async toggleFamilyPOIs(show) {
    if (AppState.familyPOILayer) {
      AppState.map.removeLayer(AppState.familyPOILayer);
      AppState.familyPOILayer = null;
    }
    if (!show) return;

    // Build a bounding box from the route or current view
    let bbox;
    if (AppState.routeCoords.length > 0) {
      const bounds = L.latLngBounds(AppState.routeCoords).pad(0.15);
      bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    } else {
      const bounds = AppState.map.getBounds();
      bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    }

    // Cache check
    if (AppState._familyPOICache && AppState._familyPOICache.bbox === bbox) {
      AppState.familyPOILayer = AppState._familyPOICache.layer;
      AppState.familyPOILayer.addTo(AppState.map);
      return;
    }

    const query = `
      [out:json][timeout:15];
      (
        node["leisure"="playground"](${bbox});
        node["leisure"="park"](${bbox});
        way["leisure"="park"](${bbox});
        node["amenity"="toilets"](${bbox});
        node["amenity"="drinking_water"](${bbox});
        node["leisure"="picnic_table"](${bbox});
      );
      out center 200;
    `;

    try {
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query)
      });
      if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
      const data = await resp.json();

      const group = L.layerGroup();
      const counts = {};

      (data.elements || []).forEach(el => {
        const lat = el.lat || el.center?.lat;
        const lon = el.lon || el.center?.lon;
        if (!lat || !lon) return;

        // Determine POI type
        let poiType = null;
        if (el.tags?.leisure === 'playground') poiType = 'playground';
        else if (el.tags?.leisure === 'park') poiType = 'park';
        else if (el.tags?.amenity === 'toilets') poiType = 'toilets';
        else if (el.tags?.amenity === 'drinking_water') poiType = 'drinking_water';
        else if (el.tags?.leisure === 'picnic_table') poiType = 'picnic_table';
        if (!poiType) return;

        const cfg = this.POI_CONFIG[poiType];
        counts[poiType] = (counts[poiType] || 0) + 1;
        const name = el.tags?.name || cfg.label;

        const marker = L.marker([lat, lon], {
          icon: L.divIcon({
            className: 'family-poi-icon',
            html: `<div class="poi-marker" style="background:${cfg.color};">${cfg.icon}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        });

        marker.bindPopup(`
          <div style="font-family:sans-serif;font-size:13px;">
            <b>${cfg.icon} ${name}</b><br>
            <span style="font-size:11px;color:#888;">Type: ${cfg.label}</span>
          </div>
        `);
        group.addLayer(marker);
      });

      group.addTo(AppState.map);
      AppState.familyPOILayer = group;
      AppState._familyPOICache = { bbox, layer: group };

      // Store POI counts for family score
      AppState._familyPOICounts = counts;
      this.updateFamilyScore();
    } catch (e) {
      console.warn('Family POI fetch failed:', e.message);
    }
  },

  /** Compute and display a family-friendly score */
  updateFamilyScore() {
    const display = document.getElementById('family-score-display');
    const starsEl = document.getElementById('family-score-stars');
    const textEl = document.getElementById('family-score-text');
    if (!display) return;

    if (!AppState.filters.familyFriendly || !AppState.routeData) {
      display.classList.add('hidden');
      return;
    }

    let score = 0;
    const reasons = [];

    // Elevation factor (lower ascent per km = more family-friendly)
    const distKm = (AppState.routeData.distance || 1) / 1000;
    const ascentPerKm = (AppState.routeData.ascent || 0) / distKm;
    if (ascentPerKm < 10) { score += 2; reasons.push('Very flat'); }
    else if (ascentPerKm < 25) { score += 1.5; reasons.push('Gentle slopes'); }
    else if (ascentPerKm < 50) { score += 1; reasons.push('Moderate hills'); }
    else { score += 0; reasons.push('Steep climbs'); }

    // Distance factor
    if (distKm <= 8) { score += 1; reasons.push('Short distance'); }
    else if (distKm <= 20) { score += 0.5; reasons.push('Medium distance'); }
    else { reasons.push('Long distance'); }

    // POI factor
    const counts = AppState._familyPOICounts || {};
    const totalPOIs = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalPOIs >= 8) { score += 1; reasons.push(`${totalPOIs} amenities nearby`); }
    else if (totalPOIs >= 3) { score += 0.5; reasons.push(`${totalPOIs} amenities nearby`); }
    else { reasons.push('Few amenities'); }

    // Surface factor
    const surface = AppState.filters.surface;
    if (surface === 'road') { score += 0.5; reasons.push('Paved surface'); }
    else if (surface === 'gravel') { score += 0.25; }

    // Clamp to 5 stars
    score = Math.min(5, Math.round(score * 10) / 10);
    const fullStars = Math.floor(score);
    const halfStar = score - fullStars >= 0.4;
    let stars = '★'.repeat(fullStars);
    if (halfStar) stars += '½';
    stars += '☆'.repeat(5 - fullStars - (halfStar ? 1 : 0));

    const label = score >= 4 ? 'Great for families!' :
                  score >= 2.5 ? 'Moderately family-friendly' :
                  'Challenging for young riders';

    starsEl.textContent = stars;
    starsEl.style.color = score >= 4 ? '#3fb950' : score >= 2.5 ? '#f0883e' : '#f85149';
    textEl.textContent = `${score}/5 — ${label}`;
    display.classList.remove('hidden');
  },

  /** Render route colored by elevation gradient steepness */
  renderGradientRoute() {
    if (AppState.elevationData.length < 2) return;

    // Remove existing gradient overlay (tagged layers)
    if (AppState._gradientLayers) {
      AppState._gradientLayers.forEach(l => AppState.map.removeLayer(l));
    }
    AppState._gradientLayers = [];

    const data = AppState.elevationData;
    // Compute distances between consecutive points for gradient %
    for (let i = 0; i < data.length - 1; i++) {
      const [lat1, lng1, elev1] = data[i];
      const [lat2, lng2, elev2] = data[i + 1];

      // Haversine approximation for segment distance (meters)
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      const elevDiff = elev2 - elev1;
      const gradientPct = dist > 0 ? Math.abs(elevDiff / dist) * 100 : 0;

      // Color by gradient severity
      let color;
      if (gradientPct < 3) color = '#3fb950';       // green — easy
      else if (gradientPct < 6) color = '#f0883e';   // orange — moderate
      else if (gradientPct < 10) color = '#f85149';   // red — steep
      else color = '#a40e26';                          // dark red — very steep

      const segment = L.polyline([[lat1, lng1], [lat2, lng2]], {
        color, weight: 5, opacity: 0.85,
        lineCap: 'round', lineJoin: 'round', interactive: false
      }).addTo(AppState.map);
      AppState._gradientLayers.push(segment);
    }
  },

  /** Remove gradient color overlay */
  clearGradientRoute() {
    if (AppState._gradientLayers) {
      AppState._gradientLayers.forEach(l => AppState.map.removeLayer(l));
      AppState._gradientLayers = [];
    }
  }
};
