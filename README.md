# HMC GeoJSON Viewer

A desktop application specifically designed for HERE Map Content GeoJSON files. This viewer allows you to quickly browse, visualize, query, and highlight large-scale GeoJSON files with support for dynamic map styling, query filtering, and automation.

## 🆕 What's New in v1.1.0

- 📋 **Click-to-copy JSON path** for easy query construction
- 💻 **Keyboard Shortcuts**:
  - `Ctrl+F` to open search
  - `Ctrl+G` auto-focus to geo-coordinates
  - `Ctrl+Enter` to run query
  - `Esc` to close modals
- 🐛 **Minor bug fixes**

---

## 🔧 Requirements

This project is built using [Node.js](https://nodejs.org/) and Electron, with support from several development libraries and modules.

### Required Software:

- Node.js (v18 or later recommended)
- npm (comes with Node.js)

### Required Packages:

These will be installed automatically by `npm install`:

- `electron`
- `electron-builder`
- `webpack`, `webpack-cli`
- `codemirror`
- `style-loader`, `css-loader`
- `concurrently`

If you want to build the application yourself, run:

```bash
npm install
npm run dist
```

---

## ✨ Features

- Folder-based GeoJSON file selection and loading
- Visualization of Point / LineString / Polygon geometries
- Feature popups with JSON property display
- Feature highlighting
- Auto fit-to-layer bounds with toggle switch
- Switchable auto-fit behavior on layer load
- Custom dark-styled OSM basemap
- Beautify and format raw JSON queries
- Powerful search UI with:
  - key-value queries (NoSQL style)
  - regex pattern support
  - `and/or` logical combinations
  - Highlight and export matching features

---

## 🔍 Query Examples

### NoSQL-style Key/Value Query

```json
{
  "attributeOrientation": "FORWARD"
}
```

### Regex Pattern Match

```json
{
  "orientedSegmentRef.0.segmentRef.identifier": {
    "$regex": "^here:cm:segment:831"
  }
}
```

### Combined AND/OR Conditions

```json
{
  "$or": [
    { "attributeOrientation": "FORWARD" },
    {
      "orientedSegmentRef.0.segmentRef.identifier": {
        "$regex": "^here:cm:segment:208"
      }
    }
  ]
}
```

Use the query button in the UI to open the JSON editor and enter your structured query. Results will be highlighted on the map.

### Example: Combined AND Match

```json
{
  "$and": [
    { "properties.trafficMessageChannelCode.locationCode": 52639 },
    {
      "properties.trafficMessageChannelCode.locationDisposition": "EXTERNAL_POSITIVE_DIRECTION"
    }
  ]
}
```

This query finds features where both conditions under `properties.trafficMessageChannelCode` are met.

![](https://i.imgur.com/CVwNq8g.gif)

---

## 🚀 CI/CD Automation

This project includes a GitHub Actions-powered CI/CD pipeline. On tag push, the workflow automatically compiles and packages the Electron app into a portable `.exe` file and uploads it to GitHub Releases.

### ✅ CI/CD Flow

1. Push Git tag (e.g. `v1.0.0`)
2. GitHub Actions triggers `release.yml`
3. Executes:
   - `npm install`
   - `npm run dist` (Webpack + Electron Builder)
   - Uses `softprops/action-gh-release` to upload `.exe` with `GH_PAT`
4. Final executable appears under [Releases](https://github.com/<your-username>/geojson-viewer/releases)

### Setup Instructions

- Config: `.github/workflows/release.yml`
- Requires GitHub secret: `GH_PAT` (fine-grained or classic PAT with repo write permission)
- Uses `portable` build (no installer)

---

## ⚡ Usage

1. Launch the app
2. Choose a folder containing GeoJSON files
3. Visualize geometries and metadata
4. Open the query editor and perform advanced search
5. Highlight results, inspect or export them

---

## 📁 Project Structure

```
.
├─ index.html
├─ main.js           # Electron main process
├─ preload.js        # IPC bridge
├─ renderer.js       # MapLibre + UI logic
├─ style.css
├─ webpack.config.js
├─ dist/             # Webpack output
├─ .github/workflows/release.yml
└─ package.json
```

---

## 🔧 Build Instructions

```bash
npm install
npm run dist
```

> To trigger CI build and release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 🔗 Related Tools

To download and convert HERE Map Content (HMC) files into usable GeoJSON format, you can use the [here_map_content_tools](https://github.com/aquawill/here_map_content_tools) repository. It provides utilities to extract HMC data and convert it to GeoJSON, which can then be visualized using this viewer.

---

## ✅ Roadmap

- Refined interactive search UI and filter chaining
- Build support for `.dmg` and `.AppImage` (macOS & Linux)
- And so on...

---

![](https://i.imgur.com/KPdNV35.jpeg)
![](https://i.imgur.com/GSvj3FA.png)
![](https://i.imgur.com/u2xY3lO.png)
