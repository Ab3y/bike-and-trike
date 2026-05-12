/* =============================================
   Filters — Toggle handlers, distance slider, route mode
   ============================================= */

const Filters = {
  init() {
    // ── Distance slider ──
    const distSlider = document.getElementById('filter-distance');
    const distValue = document.getElementById('distance-value');
    distSlider.addEventListener('input', (e) => {
      const km = parseInt(e.target.value);
      AppState.filters.targetDistance = km;
      distValue.textContent = km >= 100 ? '100+ km' : km + ' km';
    });
    // Recalculate on release (not every pixel drag)
    distSlider.addEventListener('change', () => {
      if (AppState.routeMode === 'loop' && AppState.startCoords) {
        AppState.queueRouteUpdate();
      }
    });

    // ── Route mode toggle ──
    document.querySelectorAll('.route-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.route-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.routeMode = btn.dataset.mode;

        const endGroup = document.getElementById('end-input-group');
        if (AppState.routeMode === 'point-to-point') {
          endGroup.classList.remove('hidden');
        } else {
          endGroup.classList.add('hidden');
        }

        // Update calc button state
        document.getElementById('calc-route').disabled = !AppState.canRoute();

        // Re-route if we have enough data
        if (AppState.canRoute()) AppState.queueRouteUpdate();
      });
    });

    // ── Bike paths toggle ──
    document.getElementById('filter-bike-paths').addEventListener('change', (e) => {
      AppState.filters.bikePaths = e.target.checked;
      Overlays.toggleBikePaths(e.target.checked);
    });

    // ── Family Friendly toggle ──
    document.getElementById('filter-family-friendly').addEventListener('change', (e) => {
      AppState.filters.familyFriendly = e.target.checked;
      Overlays.toggleFamilyPOIs(e.target.checked);
      if (e.target.checked) {
        // Auto-enable safer routes and set elevation to easy
        const kidToggle = document.getElementById('filter-kid-friendly');
        if (!kidToggle.checked) {
          kidToggle.checked = true;
          AppState.filters.kidFriendly = true;
        }
        // Set elevation pref slider towards flat
        const elevSlider = document.getElementById('filter-elev-pref');
        if (parseInt(elevSlider.value) > 30) {
          elevSlider.value = 20;
          AppState.filters.elevationPref = 20;
          Filters._updateElevBadge(20);
        }
        AppState.queueRouteUpdate();
      }
      Overlays.updateFamilyScore();
    });

    // ── Elevation Preference slider ──
    const elevPrefSlider = document.getElementById('filter-elev-pref');
    elevPrefSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      AppState.filters.elevationPref = val;
      Filters._updateElevBadge(val);
    });
    elevPrefSlider.addEventListener('change', () => {
      // Recalculate route with new elevation preference
      if (AppState.canRoute()) AppState.queueRouteUpdate();
      // Re-render gradient overlay
      if (AppState.elevationData.length > 0) {
        Overlays.renderGradientRoute();
      }
    });

    // ── Crime toggle ──
    document.getElementById('filter-crime').addEventListener('change', (e) => {
      AppState.filters.crime = e.target.checked;
      Overlays.toggleCrime(AppState.filters.crime);
    });

    // ── Elevation toggle ──
    document.getElementById('filter-elevation').addEventListener('change', (e) => {
      AppState.filters.elevation = e.target.checked;
      const container = document.getElementById('elevation-chart-container');
      if (AppState.filters.elevation && AppState.elevationData.length > 0) {
        container.style.display = '';
        Overlays.drawElevationChart(AppState.elevationData);
      } else {
        container.style.display = 'none';
      }
    });

    // ── Crowd toggle ──
    document.getElementById('filter-crowd').addEventListener('change', (e) => {
      AppState.filters.crowd = e.target.checked;
      Overlays.toggleCrowd(AppState.filters.crowd);
    });

    // ── Kid-friendly toggle — triggers route recalculation ──
    document.getElementById('filter-kid-friendly').addEventListener('change', (e) => {
      AppState.filters.kidFriendly = e.target.checked;
      AppState.queueRouteUpdate();
    });

    // ── Surface type buttons — triggers route recalculation ──
    document.querySelectorAll('.surface-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.surface-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.filters.surface = btn.dataset.surface;
        AppState.queueRouteUpdate();
      });
    });

    // ── Dark mode toggle ──
    document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
      AppState.darkMode = e.target.checked;
      document.documentElement.setAttribute('data-theme', AppState.darkMode ? 'dark' : 'light');
      if (AppState.map) {
        AppState.map.eachLayer(layer => {
          if (layer instanceof L.TileLayer) AppState.map.removeLayer(layer);
        });
        const tileUrl = AppState.darkMode
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
        L.tileLayer(tileUrl, {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19
        }).addTo(AppState.map);
        Routing.renderRoute();
        Overlays.refreshAll();
      }
      if (AppState.elevationData.length > 0 && AppState.filters.elevation) {
        Overlays.drawElevationChart(AppState.elevationData);
      }
    });

    // ── Collapsible panels ──
    document.querySelectorAll('.panel-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const panel = toggle.closest('.panel');
        const body = panel.querySelector('.panel-body');
        const chevron = toggle.querySelector('.chevron');
        if (body) {
          const collapsed = body.classList.toggle('collapsed');
          if (chevron) chevron.textContent = collapsed ? '▸' : '▾';
        }
      });
    });

    // ── Refresh bike paths when map moves ──
    let bikePathTimer = null;
    AppState.map.on('moveend', () => {
      if (AppState.filters.bikePaths) {
        clearTimeout(bikePathTimer);
        bikePathTimer = setTimeout(() => {
          AppState._bikePathCache = null;
          Overlays.toggleBikePaths(true);
        }, 800);
      }
    });
  },

  /** Update the elevation difficulty badge text and color */
  _updateElevBadge(val) {
    const badge = document.getElementById('elev-difficulty-badge');
    if (!badge) return;
    let label, cls;
    if (val <= 20)      { label = '🟢 Easy (Flat)';    cls = 'easy'; }
    else if (val <= 40) { label = '🟡 Gentle';          cls = 'gentle'; }
    else if (val <= 60) { label = '🟠 Moderate';        cls = 'moderate'; }
    else if (val <= 80) { label = '🔴 Challenging';     cls = 'challenging'; }
    else                { label = '⛰️ Mountain';         cls = 'mountain'; }
    badge.textContent = label;
    badge.className = 'elev-badge ' + cls;
  }
};
