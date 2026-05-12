/* =============================================
   App — Main initialization, right-click menu, UI wiring
   ============================================= */

const UI = {
  /** Update route info panel */
  updateRouteInfo(data) {
    const panel = document.getElementById('route-info');
    const exportPanel = document.getElementById('export-panel');

    if (!data) {
      panel.classList.add('hidden');
      exportPanel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    exportPanel.classList.remove('hidden');

    document.getElementById('route-distance').textContent =
      data.distance >= 1000 ? (data.distance / 1000).toFixed(1) + ' km' : Math.round(data.distance) + ' m';

    const mins = Math.round(data.duration / 60);
    document.getElementById('route-duration').textContent =
      mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + ' min';

    document.getElementById('route-ascent').textContent = Math.round(data.ascent) + ' m';
    document.getElementById('route-descent').textContent = Math.round(data.descent) + ' m';

    if (AppState.filters.elevation && AppState.elevationData.length > 0) {
      document.getElementById('elevation-chart-container').style.display = '';
      Overlays.drawElevationChart(AppState.elevationData);
    }
  }
};

/** Neon marker icon factory */
function createMarkerIcon(label, color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background: ${color};
      width: 28px; height: 28px;
      border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: 0 0 12px ${color}, 0 0 24px ${color}44;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: bold; color: #fff;
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

/** Initialize the application */
function initApp() {
  const map = L.map('map', {
    center: [38.9, -77.03],
    zoom: 13,
    zoomControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19
  }).addTo(map);

  AppState.map = map;

  const geocoder = L.Control.Geocoder.nominatim();

  // ── Sidebar toggle (only the ☰ button, NOT panels) ──
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
    setTimeout(() => map.invalidateSize(), 300);
  });

  document.getElementById('mobile-sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    setTimeout(() => map.invalidateSize(), 300);
  });

  // ── Click mode ──
  const startInput = document.getElementById('start-input');
  const endInput = document.getElementById('end-input');
  const clickModeEl = document.getElementById('click-mode');
  const clickModeText = document.getElementById('click-mode-text');
  const calcBtn = document.getElementById('calc-route');

  function enterClickMode(mode) {
    AppState.clickMode = mode;
    clickModeText.textContent = mode === 'start'
      ? '📍 Click the map to set START point'
      : '🏁 Click the map to set END point';
    clickModeEl.classList.remove('hidden');
    map.getContainer().style.cursor = 'crosshair';
  }

  function exitClickMode() {
    AppState.clickMode = null;
    clickModeEl.classList.add('hidden');
    map.getContainer().style.cursor = '';
  }

  startInput.addEventListener('focus', () => enterClickMode('start'));
  endInput.addEventListener('focus', () => enterClickMode('end'));
  document.getElementById('click-mode-cancel').addEventListener('click', exitClickMode);

  // ── Address geocoding on Enter ──
  startInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      geocoder.geocode(startInput.value, (results) => {
        if (results.length > 0) {
          const { lat, lng } = results[0].center;
          setPoint('start', [lat, lng], results[0].name);
          exitClickMode();
        }
      });
    }
  });

  endInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      geocoder.geocode(endInput.value, (results) => {
        if (results.length > 0) {
          const { lat, lng } = results[0].center;
          setPoint('end', [lat, lng], results[0].name);
          exitClickMode();
        }
      });
    }
  });

  // ── Map left-click handler ──
  map.on('click', (e) => {
    const { lat, lng } = e.latlng;

    if (AppState.clickMode === 'start') {
      setPoint('start', [lat, lng]);
      if (AppState.routeMode === 'point-to-point' && !AppState.endCoords) {
        enterClickMode('end');
      } else {
        exitClickMode();
      }
    } else if (AppState.clickMode === 'end') {
      setPoint('end', [lat, lng]);
      exitClickMode();
    } else if (!AppState.startCoords) {
      setPoint('start', [lat, lng]);
      if (AppState.routeMode === 'point-to-point') enterClickMode('end');
      else exitClickMode();
    } else if (AppState.routeMode === 'point-to-point' && !AppState.endCoords) {
      setPoint('end', [lat, lng]);
      exitClickMode();
    }

    calcBtn.disabled = !AppState.canRoute();
    if (AppState.canRoute()) AppState.queueRouteUpdate();
  });

  // ── Right-click context menu ──
  const ctxMenu = document.getElementById('context-menu');

  map.on('contextmenu', (e) => {
    e.originalEvent.preventDefault();
    const { lat, lng } = e.latlng;
    ctxMenu._latlng = { lat, lng };

    // Position the menu at the click point
    const containerPoint = e.containerPoint;
    ctxMenu.style.left = containerPoint.x + 'px';
    ctxMenu.style.top = containerPoint.y + 'px';
    ctxMenu.classList.remove('hidden');
  });

  // Hide context menu on click elsewhere
  map.on('click', () => ctxMenu.classList.add('hidden'));
  document.addEventListener('click', (e) => {
    if (!ctxMenu.contains(e.target)) ctxMenu.classList.add('hidden');
  });

  document.getElementById('ctx-set-start').addEventListener('click', () => {
    const { lat, lng } = ctxMenu._latlng;
    setPoint('start', [lat, lng]);
    ctxMenu.classList.add('hidden');
    calcBtn.disabled = !AppState.canRoute();
    if (AppState.canRoute()) AppState.queueRouteUpdate();
  });

  document.getElementById('ctx-set-end').addEventListener('click', () => {
    const { lat, lng } = ctxMenu._latlng;
    setPoint('end', [lat, lng]);
    // Switch to point-to-point mode when end is set via right-click
    if (AppState.routeMode === 'loop') {
      AppState.routeMode = 'point-to-point';
      document.querySelectorAll('.route-mode-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-mode="point-to-point"]').classList.add('active');
      document.getElementById('end-input-group').classList.remove('hidden');
    }
    ctxMenu.classList.add('hidden');
    calcBtn.disabled = !AppState.canRoute();
    if (AppState.canRoute()) AppState.queueRouteUpdate();
  });

  document.getElementById('ctx-bike-paths').addEventListener('click', () => {
    const toggle = document.getElementById('filter-bike-paths');
    toggle.checked = true;
    AppState.filters.bikePaths = true;
    Overlays.toggleBikePaths(true);
    ctxMenu.classList.add('hidden');
  });

  // ── Set point helper ──
  function setPoint(type, coords, label) {
    const [lat, lng] = coords;
    const displayLabel = label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    if (type === 'start') {
      if (AppState.startMarker) map.removeLayer(AppState.startMarker);
      AppState.startCoords = coords;
      AppState.startMarker = L.marker(coords, {
        icon: createMarkerIcon('S', '#00e5ff'),
        draggable: true
      }).addTo(map).bindPopup('Start: ' + displayLabel);

      AppState.startMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        AppState.startCoords = [pos.lat, pos.lng];
        startInput.value = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
        if (AppState.canRoute()) AppState.queueRouteUpdate();
      });

      startInput.value = displayLabel;
    } else {
      if (AppState.endMarker) map.removeLayer(AppState.endMarker);
      AppState.endCoords = coords;
      AppState.endMarker = L.marker(coords, {
        icon: createMarkerIcon('E', '#ff6b6b'),
        draggable: true
      }).addTo(map).bindPopup('End: ' + displayLabel);

      AppState.endMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        AppState.endCoords = [pos.lat, pos.lng];
        endInput.value = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
        if (AppState.canRoute()) AppState.queueRouteUpdate();
      });

      endInput.value = displayLabel;
    }

    calcBtn.disabled = !AppState.canRoute();
  }

  // ── Calculate button ──
  calcBtn.addEventListener('click', () => {
    if (AppState.canRoute()) Routing.calculateRoute();
  });

  // ── Clear button ──
  document.getElementById('clear-route').addEventListener('click', () => {
    AppState.clearRoute();
    startInput.value = '';
    endInput.value = '';
    calcBtn.disabled = true;
    exitClickMode();
  });

  // ── Initialize modules ──
  Filters.init();
  Export.init();

  // ── Resize handler ──
  window.addEventListener('resize', () => {
    if (AppState.elevationData.length > 0 && AppState.filters.elevation) {
      Overlays.drawElevationChart(AppState.elevationData);
    }
    map.invalidateSize();
  });

  // ── Geolocation ──
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => {}
    );
  }
}

document.addEventListener('DOMContentLoaded', initApp);
