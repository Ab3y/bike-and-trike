/* =============================================
   State Management
   ============================================= */

const AppState = {
  // Map
  map: null,
  startMarker: null,
  endMarker: null,
  startCoords: null, // [lat, lng]
  endCoords: null,
  clickMode: null, // 'start' | 'end' | null

  // Route
  routeMode: 'loop', // 'loop' | 'point-to-point'
  routeData: null,
  routeCoords: [],
  routeLayers: [],
  elevationData: [],

  // Filters
  filters: {
    crime: false,
    elevation: true,
    crowd: false,
    kidFriendly: true,
    familyFriendly: true,
    bikePaths: true,
    avoidHighways: false,
    surface: 'road',    // road | gravel | dirt | rocky
    targetDistance: 1.609344, // 1 mile in km
    elevationPref: 20    // 0 = flattest, 100 = hilliest
  },

  // Theme
  darkMode: true,
  units: 'mi', // 'km' | 'mi'

  // Overlays
  crimeLayer: null,    // L.layerGroup of clickable circle markers
  crowdLayer: null,
  bikePathLayer: null,
  familyPOILayer: null, // family-friendly POI markers
  _bikePathCache: null, // cache key + data
  _familyPOICache: null,

  // Debounce
  _routeTimer: null,

  /** Queue a route recalculation with debounce */
  queueRouteUpdate() {
    clearTimeout(this._routeTimer);
    this._routeTimer = setTimeout(() => {
      if (this.canRoute()) {
        Routing.calculateRoute();
      }
    }, 400);
  },

  /** Check if we can calculate a route */
  canRoute() {
    if (this.routeMode === 'loop') return this.startCoords !== null;
    return this.startCoords !== null && this.endCoords !== null;
  },

  /** Clear everything */
  clearRoute() {
    this.routeData = null;
    this.routeCoords = [];
    this.elevationData = [];
    this.routeLayers.forEach(l => this.map.removeLayer(l));
    this.routeLayers = [];
    if (this.startMarker) { this.map.removeLayer(this.startMarker); this.startMarker = null; }
    if (this.endMarker) { this.map.removeLayer(this.endMarker); this.endMarker = null; }
    this.startCoords = null;
    this.endCoords = null;
    Overlays.clearAll();
    Overlays.clearGradientRoute();
    UI.updateRouteInfo(null);
  }
};
