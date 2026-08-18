# 🚲 Bike & Trike (Beta)

**A bike route planner built by a dad who wanted to find safe, fun rides to take his kids on.**

I got tired of guessing which routes were safe for my kids — wondering if the hills were too steep for little legs, if there were bathrooms nearby, or if we'd end up on a busy road with no bike lane. So I built this.

Bike & Trike is a fully interactive, browser-based route planner designed with family cycling in mind. Set a starting point, pick how far you want to ride, and it builds a loop route that brings you right back home. Toggle on family-friendly mode to see nearby parks, playgrounds, restrooms, and water fountains along the way. Dial the elevation down to "flat" so the kids aren't walking their bikes up hills. Check the crime overlay before heading into an unfamiliar neighborhood. It even scores your route on how family-friendly it is.

No accounts. No API keys. No install. Just open `index.html` and go.

---

## ✨ Features

- **🔄 Loop Routes** — Set a start point and a target distance. It plans a loop that brings you back. No need for an endpoint.
- **📍 Point-to-Point** — Switch to A→B mode when you have a specific destination.
- **👨‍👩‍👧‍👦 Family Friendly Mode** — Shows parks, playgrounds, restrooms, and water fountains near your route (real data from OpenStreetMap). Rates your route with a family-friendly score out of 5 stars.
- **⛰️ Elevation Preference** — Slider from Flat to Hilly. Set it to Easy and the router picks gentler grades. The route is color-coded by steepness: green (easy) → orange → red (steep).
- **🚴 Nearby Bike Paths** — Toggle to see real cycleways and bike lanes from OpenStreetMap overlaid on the map.
- **🚨 Crime Overlay** — Click any crime zone to see a popup with top crime types (simulated demo data — clearly labeled).
- **🌙 Dark / Light Mode** — Full dark theme with blue neon route glow. Toggle to light mode anytime.
- **🛣️ Surface Type** — Choose Road, Gravel, Dirt, or Rocky to match your bike and your kids' comfort level.
- **🛡️ Prefer Safer Routes** — Routes along bike paths and lower-traffic roads.
- **🚫 Avoid Highways** — Uses BRouter's safety-focused profile and will not silently fall back to routing that ignores the preference.
- **📍 Local Map Start** — With browser permission, starts the map in your current area.
- **📏 Distance Slider** — Dynamically adjust target distance from 1–100 km.
- **📊 Elevation Profile** — Chart showing elevation along the route with min/max labels.
- **🗺️ Export** — Open your route in Google Maps, or download as KML or GPX.
- **🖱️ Right-Click Menu** — Right-click anywhere on the map to quickly set start/end or show bike paths.
- **📱 Responsive** — Works on desktop and mobile with a collapsible sidebar.

## 🚀 Getting Started

1. Clone the repo
2. Open `index.html` in your browser
3. Click the map to set a starting point
4. A loop route is calculated automatically

That's it. No build step, no dependencies to install, no API keys to configure.

> **Tip:** For best results, serve it from a local server instead of `file://`:
> ```
> python -m http.server 8080
> ```

## 🗂️ Project Structure

```
index.html          Main app shell
css/style.css       Styles, dark mode, neon effects, responsive layout
js/state.js         Central state management
js/app.js           Map initialization, click/right-click handlers, UI
js/routing.js       BRouter + OSRM routing with loop support
js/filters.js       Filter toggles, sliders, collapsible panels
js/overlays.js      Crime zones, crowd, bike paths, family POIs, elevation chart
js/export.js        Google Maps, KML, and GPX export
```

## 🌐 Free Services Used (No API Keys)

| What | Service | Key? |
|------|---------|------|
| Map tiles | CartoDB (dark & light) | None |
| Bike routing | [BRouter](https://brouter.de) | None |
| Fallback routing | [OSRM](https://project-osrm.org) | None |
| Elevation (fallback) | [Open-Elevation](https://open-elevation.com) | None |
| Geocoding | [Nominatim](https://nominatim.org) | None |
| Bike paths & POIs | [Overpass API](https://overpass-api.de) (OpenStreetMap) | None |

## ⚠️ Disclaimers

- **Crime and crowd overlays are simulated demo data** — they are not real safety predictions. Do not rely on them for safety decisions.
- **"Prefer Safer Routes" and "Family Friendly" are routing preferences**, not safety guarantees. Always use your own judgment on road conditions.
- Route coordinates are sent to BRouter/OSRM for calculation and to Overpass for POI data. No personal data is collected or stored.

## 📄 License

MIT

---

*Built with ❤️ and Leaflet.js, because every kid deserves a safe ride.*
