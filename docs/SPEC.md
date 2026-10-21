# Recent Satellite Viewer: Specification

Version 0.1 (prototype spec). Written 20 October 2026.

## 1. Purpose

A simple, free web app. The user types an address or place name, the map jumps there, and the app shows the **most recent clear satellite images** of that spot. The user can step back through earlier passes (for example 2 days ago, 7 days ago, 12 days ago) to see how the place changed.

It is the "Google Maps, but how it looks this week, not last year" idea.

## 2. Goals and non-goals

### Goals
- Search anywhere in the world by address or place name.
- List every recent satellite pass over that spot with date, age ("2 days ago") and cloud percentage.
- Hide cloudy images with a cloud-cover slider.
- Show the chosen image over a normal map, with an opacity slider to compare against the base map.
- Run entirely on the user's own PC, with no paid services and no API keys in v1.
- Work on desktop and phone browsers.

### Non-goals (be honest with users about these)
- Not live. Each place is photographed every few days at best. "Latest" is usually 1 to 5 days old, and longer in cloudy regions.
- Not detailed. Free Sentinel-2 imagery is about 10 m per pixel. Buildings, roads, fields, water, forest and large changes are visible. Cars, people, animals and safari scenes are not.
- No video, no tracking of moving things, no tasking of satellites (that needs a paid provider).

## 3. Users and main journey

One type of user: anyone curious about a place.

1. Opens the app. Sees a world map and a search box.
2. Types "Nairobi National Park" and presses Enter.
3. Map flies to the place. The app searches for recent images and fills a list.
4. User taps the newest entry. The satellite image appears on the map.
5. User taps an older entry to compare. Moves the opacity slider to blend with the street map.
6. User raises or lowers the cloud limit, or extends "days back", to find more images.

## 4. Data sources (all free, no key for v1)

| Need | Service | Notes |
|---|---|---|
| Place name to coordinates | OpenStreetMap Nominatim, with Photon (photon.komoot.io) as an automatic backup | Both free. Nominatim rules: maximum 1 request per second, no bulk use, show OSM attribution. Fine for a personal app. Nominatim can refuse shared or busy connections, which is why the backup exists. |
| Image catalogue (which images exist) | Earth Search STAC API by Element 84 (`https://earth-search.aws.element84.com/v1`) | Free, open, supports filtering by cloud cover and date, and browser requests (CORS) are allowed. Collection: `sentinel-2-l2a`. |
| Image files | Sentinel-2 Cloud Optimised GeoTIFFs on AWS, linked from the catalogue | Free. Asset name `visual` is the ready-made true colour image. |
| Turning the GeoTIFF into map tiles | TiTiler | v1 uses the public demo at `titiler.xyz` (fine for testing, not guaranteed for heavy use). v1.1 should self-host TiTiler on the PC (see section 9). |
| Base map | OpenStreetMap tiles | Free for light use, show attribution. |
| Map library | Leaflet 1.9 | Free, loaded from a CDN. |

Alternative catalogue if Earth Search is ever unavailable: Copernicus Data Space Ecosystem (free registration, official ESA source, STAC API available). Keep the catalogue URL in one config object so it can be swapped.

## 5. Features

### v1 (the prototype delivered with this spec)
1. Search box with Enter-to-search, using Nominatim (top 1 result, flies to it).
2. Leaflet map with OSM base layer.
3. "Find images" action using the **map centre point**: queries Earth Search for Sentinel-2 L2A scenes that contain that point, within the chosen days-back window and under the chosen cloud limit, newest first, up to 50.
4. Result list: date and time (shown in the browser's local time), relative age, cloud percentage, tile ID.
5. Selecting an item draws that scene on the map, zooms nothing, and outlines the scene footprint.
6. Controls: days back (14 / 30 / 60 / 90 / 180), maximum cloud % (0 to 100), opacity slider, tiler URL in a config object.
7. Status and error messages in plain words (no results, network error, search failed).
8. Required attribution: "Contains modified Copernicus Sentinel data (year)" plus OSM and the tiler provider.

### v1.1 (next, small)
- Shareable URL (`#lat,lon,zoom,date`) so a view can be bookmarked.
- Auto re-search when the user pans far from the last search point.
- Date stepper buttons (previous pass / next pass) and keyboard arrows.
- Side-by-side or swipe comparison of two dates.
- Self-hosted TiTiler on the PC (removes the demo-server dependency).

### v2 (ideas)
- Mosaic several scenes so a view that crosses a scene edge has no gaps.
- Landsat 8/9 (`landsat-c2-l2`, 30 m) as an extra source for cloud-free fallback.
- Sentinel-1 radar (sees through cloud, not pretty, but always gives something).
- Other visualisations: false colour, vegetation index (NDVI), burn and water indices.
- Optional paid sources (Planet, Maxar via a reseller such as SkyWatch) behind a clear "paid" switch.
- Saved places, email or push alert when a new clear image appears.

## 6. How it works (data flow)

1. User searches. App calls Nominatim: `GET https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=<text>`. Takes `lat`, `lon`.
2. Map flies to the point at zoom 12.
3. App calls the catalogue: `POST https://earth-search.aws.element84.com/v1/search` with a JSON body:
   - `collections`: `["sentinel-2-l2a"]`
   - `intersects`: GeoJSON Point of the map centre (longitude first)
   - `datetime`: `"<start ISO>/<end ISO>"`
   - `query`: `{ "eo:cloud_cover": { "lt": <limit> } }`
   - `sortby`: `[{ "field": "properties.datetime", "direction": "desc" }]`
   - `limit`: 50
4. Each returned feature gives: `properties.datetime`, `properties["eo:cloud_cover"]`, `bbox`, and `assets.visual.href` (and `assets.thumbnail.href`).
5. When the user selects a feature, the app adds a Leaflet tile layer whose URL is the tiler template with the encoded `visual` href inserted. The tiler reads only the needed parts of the file, so no big download.
6. Layer is limited to the scene `bbox` so Leaflet does not ask for tiles outside the image.

## 7. Screens and layout

Single page.
- **Top bar:** app name, search box, Search button.
- **Left panel (desktop) / bottom sheet (phone):**
  - Days back selector, cloud limit slider with value, Opacity slider.
  - "Find images here" button.
  - Status line.
  - Results list (scrollable). Selected item highlighted.
- **Map:** fills the rest of the screen.
- **Footer line:** attribution text.

Light and dark colour schemes follow the system setting. Touch targets at least 44 px.

## 8. Rules, limits and licensing

- **Imagery licence:** Copernicus Sentinel data is free and open, including commercial use, with attribution: "Contains modified Copernicus Sentinel data [year]".
- **Nominatim:** 1 request per second maximum, no automated bulk geocoding, a visible OSM credit. For a public app with many users, switch to a paid or self-hosted geocoder.
- **OSM tiles:** fine for personal use. A busy public app needs its own tile provider.
- **titiler.xyz:** a public demo, may rate limit or change. Self-host before sharing the app widely.
- **Earth Search:** free and open, no key. No guaranteed service level, so show a friendly error if it is down.
- Do not claim the images are live or real time anywhere in the interface. Show the real acquisition date and time.
- Re-check each provider's current terms before launching publicly. They change.

## 9. Running on the user's PC

### Prototype (no install)
Needs only a browser and either Python or Node.

```
cd recent-satellite-viewer
python -m http.server 8080
```
Then open `http://localhost:8080`. (Opening the file by double-click may also work, but a local server avoids browser restrictions.)

### Self-hosting the tiler (v1.1)
Run TiTiler locally (Docker is the easiest way; follow the TiTiler project documentation for the current image name and port). Then change `CONFIG.tiler` to the local address, keeping the same `{z}/{x}/{y}` and `url` parameters. This removes the demo-server dependency and costs nothing.

### Suggested project structure for the build-out
```
recent-satellite-viewer/
  index.html          (prototype, single file)
  SPEC.md             (this file)
  src/                (after moving to Vite + TypeScript)
    config.ts         (service URLs, defaults)
    geocode.ts        (Nominatim)
    stac.ts           (catalogue search)
    map.ts            (Leaflet layers)
    ui.ts             (panel, list, controls)
  tests/
```
Recommended path: keep the single file until the behaviour is right, then move to Vite + TypeScript with the same module boundaries.

## 10. Acceptance criteria for v1

1. Searching "Paris" moves the map to Paris and fills the list within about 5 seconds on a normal connection.
2. List shows newest first, with correct relative ages and cloud percentages.
3. Moving the cloud slider to 10 and pressing "Find images here" shows only scenes at or below 10 percent.
4. Selecting a result shows imagery over the area, aligned with the base map; opacity slider blends it.
5. Selecting a different result swaps the layer without leaving the old one behind.
6. A place with no clear images in the window shows a clear message and a hint to widen days back or raise the cloud limit.
7. Network failure shows a readable error, not a blank screen.
8. Works at 375 px wide (phone) and 1440 px wide (desktop).
9. Attribution text always visible.

## 11. Known risks and how to handle them

| Risk | Handling |
|---|---|
| Scene covers only part of the screen (scene edge) | Outline the footprint; v2 adds mosaics. |
| Several scenes for one point on the same day (overlapping orbits) | List shows both, tile ID distinguishes them. |
| titiler.xyz slow or rate limited | Config switch to a self-hosted tiler. |
| Imagery looks dark or washed out | Use the `visual` asset (already colour balanced); allow tiler rescale options in v1.1. |
| Very high latitudes in polar night | Show "no images" message; mention season in the hint. |
| Provider changes an API | All URLs and field names live in `CONFIG` and one function per service. |
| Prototype tested in one browser only | The page was run in a headless Chrome against the live services: search for "Paris", image list, picking an image, and 6 imagery tiles drawn on the map. Not yet tested on other browsers, other places, or with the quick-preview option. Leaflet is built into the file, so it needs no CDN. |

## 12. Hand-off prompt for Claude Code

Paste this into Claude Code in the project folder, with this file and `index.html` present:

> Read SPEC.md and index.html. Run the app locally, test it against the live services in a browser, and fix anything that does not work (tiler URL format, asset names, CORS, mobile layout). Then implement the v1.1 items one at a time, committing after each. Keep all service URLs in one config object. Do not add paid services or API keys. Ask me before changing the architecture.
