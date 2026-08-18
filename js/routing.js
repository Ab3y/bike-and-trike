/* =============================================
   Routing — BRouter (free, no API key) + OSRM fallback
   Supports both point-to-point and loop routes
   ============================================= */

const Routing = {
  BROUTER_URL: 'https://brouter.de/brouter',
  OSRM_URL: 'https://router.project-osrm.org/route/v1',

  /** Map route preferences to a BRouter profile */
  getBRouterProfile() {
    const elevPref = AppState.filters.elevationPref;
    // Safety constraints take precedence over surface and elevation preferences.
    if (AppState.filters.avoidHighways || AppState.filters.familyFriendly || elevPref <= 15) return 'safety';
    if (AppState.filters.kidFriendly) return 'safety';

    // Low elevation pref → prefer trekking (gentler) over fastbike
    if (elevPref <= 35) {
      switch (AppState.filters.surface) {
        case 'road': return 'trekking';   // trekking avoids steep hills more than fastbike
        default:     return 'trekking';
      }
    }

    // Normal / high elevation pref → standard mapping
    switch (AppState.filters.surface) {
      case 'road':   return 'fastbike';
      case 'gravel': return 'trekking';
      case 'dirt':   return 'mtb';
      case 'rocky':  return 'mtb';
      default:       return 'trekking';
    }
  },

  /**
   * Generate loop waypoints from a start point and target distance.
   * Creates 3 waypoints forming a roughly triangular loop.
   */
  _generateLoopWaypoints(startCoords, targetDistKm) {
    const [lat, lng] = startCoords;
    // Approximate leg distance: each side of the triangle ≈ totalDist / 3
    const legKm = targetDistKm / 3;
    // ~0.009 degrees latitude ≈ 1 km
    const latPerKm = 0.009;
    const lngPerKm = 0.009 / Math.cos(lat * Math.PI / 180);

    // Pick a random-ish base direction using coordinate hash for consistency
    const baseAngle = ((Math.abs(Math.sin(lat * 1000)) * 360) % 360) * (Math.PI / 180);

    const wp1Angle = baseAngle;
    const wp2Angle = baseAngle + (2 * Math.PI / 3);

    const wp1 = [
      lat + Math.sin(wp1Angle) * legKm * latPerKm,
      lng + Math.cos(wp1Angle) * legKm * lngPerKm
    ];
    const wp2 = [
      lat + Math.sin(wp2Angle) * legKm * latPerKm,
      lng + Math.cos(wp2Angle) * legKm * lngPerKm
    ];

    return [startCoords, wp1, wp2, startCoords];
  },

  /** Calculate route — handles both loop and point-to-point */
  async calculateRoute() {
    if (!AppState.canRoute()) return;

    const calcBtn = document.getElementById('calc-route');
    calcBtn.classList.add('loading');
    calcBtn.disabled = true;
    calcBtn.textContent = 'Calculating...';

    try {
      await this._routeViaBRouter();
    } catch (brouterErr) {
      if (AppState.filters.avoidHighways) {
        console.error('BRouter failed with highway avoidance enabled:', brouterErr);
        alert(
          `Route calculation failed.\n\n` +
          `BRouter: ${brouterErr.message}\n\n` +
          `Highway avoidance cannot be guaranteed by the fallback router.`
        );
        return;
      }
      console.warn('BRouter failed, trying OSRM fallback:', brouterErr.message);
      try {
        await this._routeViaOSRM();
      } catch (osrmErr) {
        console.error('All routing engines failed:', osrmErr);
        alert(
          `Route calculation failed.\n\n` +
          `BRouter: ${brouterErr.message}\n` +
          `OSRM: ${osrmErr.message}\n\n` +
          `Check your internet connection or try a shorter route.`
        );
      }
    } finally {
      calcBtn.classList.remove('loading');
      calcBtn.disabled = false;
      calcBtn.textContent = 'Calculate Route';
    }
  },

  /** Build the waypoint list based on route mode */
  _getWaypoints() {
    if (AppState.routeMode === 'loop') {
      return this._generateLoopWaypoints(AppState.startCoords, AppState.filters.targetDistance);
    }
    return [AppState.startCoords, AppState.endCoords];
  },

  /** ── BRouter (primary) ── */
  async _routeViaBRouter() {
    const waypoints = this._getWaypoints();
    const profile = this.getBRouterProfile();

    const lonlats = waypoints.map(([lat, lng]) => `${lng},${lat}`).join('|');
    const url = `${this.BROUTER_URL}?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;

    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(text || `BRouter HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const feature = data.features && data.features[0];
    if (!feature) throw new Error('No route found');

    const coords = feature.geometry.coordinates;
    const props = feature.properties;

    AppState.routeData = {
      distance: parseFloat(props['track-length']) || 0,
      duration: parseFloat(props['total-time']) || 0,
      ascent:  parseFloat(props['filtered ascend']) || 0,
      descent: parseFloat(props['filtered descend']) || 0
    };

    AppState.routeCoords   = coords.map(c => [c[1], c[0]]);
    AppState.elevationData = coords.map(c => [c[1], c[0], c[2] || 0]);

    this.renderRoute();
    UI.updateRouteInfo(AppState.routeData);
    Overlays.refreshAll();
    // Render gradient coloring on top of neon route
    if (AppState.elevationData.length > 0) {
      Overlays.renderGradientRoute();
    }
    this._fitBounds();
  },

  /** ── OSRM (fallback) ── */
  async _routeViaOSRM() {
    const waypoints = this._getWaypoints();
    const coordStr = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');

    const url = `${this.OSRM_URL}/bike/${coordStr}?overview=full&geometries=geojson&steps=false`;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);

    const data = await resp.json();
    if (data.code !== 'Ok' || !data.routes || !data.routes[0]) {
      throw new Error(data.message || 'No route found');
    }

    const route = data.routes[0];
    const coords = route.geometry.coordinates;

    AppState.routeData = {
      distance: route.distance || 0,
      duration: route.duration || 0,
      ascent: 0, descent: 0
    };

    AppState.routeCoords   = coords.map(c => [c[1], c[0]]);
    AppState.elevationData = [];

    this.renderRoute();
    UI.updateRouteInfo(AppState.routeData);
    Overlays.refreshAll();
    this._fitBounds();

    this._fetchElevation(coords);
  },

  /** Fetch elevation from Open-Elevation (free, no key) */
  async _fetchElevation(coords) {
    try {
      const step = Math.max(1, Math.floor(coords.length / 100));
      const locations = [];
      for (let i = 0; i < coords.length; i += step) {
        locations.push({ latitude: coords[i][1], longitude: coords[i][0] });
      }

      const resp = await fetch('https://api.open-elevation.com/api/v1/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations })
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.results) return;

      AppState.elevationData = data.results.map(r => [r.latitude, r.longitude, r.elevation]);

      let ascent = 0, descent = 0;
      for (let i = 1; i < data.results.length; i++) {
        const diff = data.results[i].elevation - data.results[i - 1].elevation;
        if (diff > 0) ascent += diff; else descent += Math.abs(diff);
      }
      AppState.routeData.ascent = Math.round(ascent);
      AppState.routeData.descent = Math.round(descent);

      UI.updateRouteInfo(AppState.routeData);
      Overlays.refreshAll();
      Overlays.renderGradientRoute();
    } catch (e) {
      console.warn('Elevation lookup failed (non-critical):', e.message);
    }
  },

  /** Fit map to route bounds */
  _fitBounds() {
    if (AppState.routeCoords.length > 0) {
      const bounds = L.latLngBounds(AppState.routeCoords);
      AppState.map.fitBounds(bounds, { padding: [60, 60] });
    }
  },

  /** Render route polylines with neon glow effect */
  renderRoute() {
    AppState.routeLayers.forEach(l => AppState.map.removeLayer(l));
    AppState.routeLayers = [];

    if (AppState.routeCoords.length === 0) return;

    const layers = [
      { weight: 14, opacity: 0.15, color: '#00e5ff' },
      { weight: 8,  opacity: 0.3,  color: '#00e5ff' },
      { weight: 4,  opacity: 0.9,  color: '#00e5ff' },
      { weight: 1.5, opacity: 0.7, color: '#b3f5ff' }
    ];

    layers.forEach(cfg => {
      const line = L.polyline(AppState.routeCoords, {
        color: cfg.color, weight: cfg.weight, opacity: cfg.opacity,
        lineCap: 'round', lineJoin: 'round', interactive: false
      }).addTo(AppState.map);
      AppState.routeLayers.push(line);
    });
  }
};
