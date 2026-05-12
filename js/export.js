/* =============================================
   Export — Google Maps, KML, GPX
   ============================================= */

const Export = {
  init() {
    document.getElementById('export-google').addEventListener('click', () => this.openGoogleMaps());
    document.getElementById('export-kml').addEventListener('click', () => this.downloadKML());
    document.getElementById('export-gpx').addEventListener('click', () => this.downloadGPX());
  },

  /** Open route in Google Maps (approximate — Google re-routes) */
  openGoogleMaps() {
    if (!AppState.startCoords) return;

    const [sLat, sLng] = AppState.startCoords;
    const eLat = AppState.endCoords ? AppState.endCoords[0] : sLat;
    const eLng = AppState.endCoords ? AppState.endCoords[1] : sLng;

    // Add intermediate waypoints for better route approximation
    let waypoints = '';
    if (AppState.routeCoords.length > 2) {
      const step = Math.max(1, Math.floor(AppState.routeCoords.length / 8));
      const wps = [];
      for (let i = step; i < AppState.routeCoords.length - step; i += step) {
        if (wps.length >= 8) break; // Google Maps limit
        wps.push(`${AppState.routeCoords[i][0]},${AppState.routeCoords[i][1]}`);
      }
      if (wps.length) waypoints = `&waypoints=${wps.join('|')}`;
    }

    const url = `https://www.google.com/maps/dir/?api=1&origin=${sLat},${sLng}&destination=${eLat},${eLng}${waypoints}&travelmode=bicycling`;
    window.open(url, '_blank');
  },

  /** Generate and download KML file */
  downloadKML() {
    if (AppState.routeCoords.length === 0) return;

    const coords = AppState.routeCoords
      .map((c, i) => {
        const elev = AppState.elevationData[i] ? AppState.elevationData[i][2] : 0;
        return `${c[1]},${c[0]},${elev}`;
      })
      .join('\n              ');

    const distance = AppState.routeData ? (AppState.routeData.distance / 1000).toFixed(1) + ' km' : 'N/A';

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Bike &amp; Trike Route</name>
    <description>Distance: ${distance} | Surface: ${AppState.filters.surface}</description>
    <Style id="bikeRoute">
      <LineStyle>
        <color>ffffe500</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>Start</name>
      <Point>
        <coordinates>${AppState.startCoords[1]},${AppState.startCoords[0]},0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>End</name>
      <Point>
        <coordinates>${AppState.endCoords[1]},${AppState.endCoords[0]},0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Route</name>
      <styleUrl>#bikeRoute</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>clampToGround</altitudeMode>
        <coordinates>
              ${coords}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

    this._downloadFile(kml, 'bike-trike-route.kml', 'application/vnd.google-earth.kml+xml');
  },

  /** Generate and download GPX file */
  downloadGPX() {
    if (AppState.routeCoords.length === 0) return;

    const trackpoints = AppState.routeCoords
      .map((c, i) => {
        const elev = AppState.elevationData[i] ? AppState.elevationData[i][2] : 0;
        return `      <trkpt lat="${c[0]}" lon="${c[1]}"><ele>${elev}</ele></trkpt>`;
      })
      .join('\n');

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Bike &amp; Trike Route Planner"
     xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Bike &amp; Trike Route</name>
    <desc>Surface: ${AppState.filters.surface}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>Bike Route</name>
    <trkseg>
${trackpoints}
    </trkseg>
  </trk>
</gpx>`;

    this._downloadFile(gpx, 'bike-trike-route.gpx', 'application/gpx+xml');
  },

  /** Helper to trigger file download */
  _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
