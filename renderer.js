let currentPopup = null;

let beautifyTimer = null;
let lastQueryResult = [];
let currentGeoJSONData = null;
let mapHighlightLayers = [];
let mapHighlightSources = [];

const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
      },
    ],
  },
  center: [0, 0],
  zoom: 0,
});

let geoLayer;

function flattenGeoJSON(input) {
  const features = [];

  function wrapGeometry(geom, props = {}) {
    return {
      type: "Feature",
      geometry: geom,
      properties: props,
    };
  }

  function recurse(obj) {
    if (!obj || typeof obj !== "object") return;

    const type = obj.type;

    if (type === "Feature") {
      if (obj.geometry && obj.geometry.coordinates) {
        features.push(obj);
      } else {
        console.warn("Ignoring invalid feature", obj);
      }
    } else if (type === "FeatureCollection") {
      if (Array.isArray(obj.features)) {
        obj.features.forEach(recurse);
      } else {
        console.warn("FeatureCollection.features is not an array", obj);
      }
    } else if (
      [
        "Point",
        "LineString",
        "Polygon",
        "MultiPoint",
        "MultiLineString",
        "MultiPolygon",
      ].includes(type)
    ) {
      features.push(wrapGeometry(obj));
    } else if (
      obj.geometry &&
      obj.geometry.type &&
      [
        "Point",
        "LineString",
        "Polygon",
        "MultiPoint",
        "MultiLineString",
        "MultiPolygon",
      ].includes(obj.geometry.type)
    ) {
      features.push({
        type: "Feature",
        geometry: obj.geometry,
        properties: obj.properties || {},
      });
    } else {
      console.warn("Unable to identify: ", obj);
    }
  }

  recurse(input);
  return {
    type: "FeatureCollection",
    features,
  };
}

function clearHighlighAndPopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
  }
  mapHighlightLayers.forEach(function (item, index) {
    if (map.getLayer(item)) {
      map.removeLayer(item);
    }
  });
  mapHighlightSources.forEach(function (item, index) {
    if (map.getSource(item)) {
      map.removeSource(item);
    }
  });
  mapHighlightLayers = [];
  mapHighlightSources = [];
}

function getFeaturesBound(features) {
  const bounds = new maplibregl.LngLatBounds();
  features.forEach((f) => {
    if (!f.geometry || !f.geometry.coordinates) {
      console.warn("Ignoring invalid feature", f);
      return;
    }

    const { type, coordinates } = f.geometry;

    try {
      switch (type) {
        case "Point":
          bounds.extend(coordinates);
          break;
        case "MultiPoint":
        case "LineString":
          coordinates.forEach((coord) => bounds.extend(coord));
          break;
        case "MultiLineString":
        case "Polygon":
          coordinates.flat().forEach((coord) => bounds.extend(coord));
          break;
        case "MultiPolygon":
          coordinates.flat(2).forEach((coord) => bounds.extend(coord));
          break;
        default:
          console.warn("Unsupported geometry type: ", type, f);
      }
    } catch (err) {
      console.error("Error calculating bounds: ", err, f);
    }
  });
  return bounds;
}

function loadGeoJSON(filePath) {
  clearHighlighAndPopup();

  try {
    const raw = window.api.readFile(filePath);
    const json = JSON.parse(raw);
    const geojsonData = flattenGeoJSON(json);
    currentGeoJSONData = geojsonData;

    if (map.getSource("geojson")) {
      map.removeLayer("geojson-polygon");
      map.removeLayer("geojson-line");
      map.removeLayer("geojson-point");
      map.removeSource("geojson");
    }

    map.addSource("geojson", {
      type: "geojson",
      data: geojsonData,
    });

    map.addLayer({
      id: "geojson-polygon",
      type: "fill",
      source: "geojson",
      paint: {
        "fill-color": "#08f",
        "fill-opacity": 0.3,
      },
      filter: ["==", "$type", "Polygon"],
    });

    map.addLayer({
      id: "geojson-line",
      type: "line",
      source: "geojson",
      paint: {
        "line-color": "#fff",
        "line-width": 1.5,
      },
      filter: ["==", "$type", "LineString"],
    });

    map.addLayer({
      id: "geojson-point",
      type: "circle",
      source: "geojson",
      paint: {
        "circle-radius": 3,
        "circle-color": "#f80",
      },
      filter: ["==", "$type", "Point"],
    });

    if (!document.getElementById("keepViewCheckbox").checked) {
      map.fitBounds(getFeaturesBound(geojsonData.features), { padding: 20 });
    }
    // setupSearch(geojsonData.features);
  } catch (err) {
    console.error("GeoJSON loading error:", err);
    showErrorBox("Unable to load GeoJSON：" + err.message);
  }
}

document.getElementById("chooseDir").addEventListener("click", async () => {
  console.log("👆 點了按鈕");
  const files = await window.api.selectDirectory();
  const select = document.getElementById("fileSelect");
  select.innerHTML = "";
  files.forEach((file) => {
    const opt = document.createElement("option");
    opt.value = file;
    opt.textContent = file.split(/[/\\]/).pop();
    select.appendChild(opt);
  });
  if (files.length > 0) loadGeoJSON(files[0]);
});

document.getElementById("fileSelect").addEventListener("change", (e) => {
  loadGeoJSON(e.target.value);
});

function highlightFeatures(features) {
  for (let index = 0; index < features.length; index++) {
    const element = features[index];
    // console.log(element);

    map.addSource("highlight-feature-" + index, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [element],
      },
    });

    mapHighlightSources.push("highlight-feature-" + index);

    let geometry;

    if (element._geometry) {
      geometry = element._geometry;
    } else {
      geometry = element.geometry;
    }

    if (geometry.type == "LineString") {
      map.addLayer({
        id: "highlight-layer-" + index,
        type: "line",
        source: "highlight-feature-" + index,
        paint: {
          "line-color": "#FFD700",
          "line-width": 6,
          "line-blur": 0.5,
        },
      });
    } else if (geometry.type == "Point") {
      map.addLayer({
        id: "highlight-layer-" + index,
        type: "circle",
        source: "highlight-feature-" + index,
        paint: {
          "circle-color": "#FFD700",
          "circle-radius": 6,
          "circle-opacity": 0.5,
        },
      });
    } else if (geometry.type == "Polygon") {
      map.addLayer({
        id: "highlight-layer-" + index,
        type: "fill",
        source: "highlight-feature-" + index,
        paint: {
          "fill-outline-color": "#FFD700",
          "fill-opacity": 0.3,
          "fill-color": "#FFD700",
        },
      });
    }

    mapHighlightLayers.push("highlight-layer-" + index);
  }
}

map.on("click", (e) => {
  let width = 10;
  let height = 10;
  const features = map.queryRenderedFeatures(
    [
      [e.point.x - width / 2, e.point.y - height / 2],
      [e.point.x + width / 2, e.point.y + height / 2],
    ],
    {
      layers: ["geojson-point", "geojson-line", "geojson-polygon"],
    }
  );

  clearHighlighAndPopup();

  if (!features.length) {
    clearHighlighAndPopup();
    return;
  }

  highlightFeatures(features);

  const html = features
    .map((f, i) => {
      const cleaned = cleanProperties(f.properties);
      const jsonText = JSON.stringify(cleaned, null, 2);
      const highlighted = syntaxHighlight(cleaned);

      return `
    <div class="feature-block">
      <details open>
        <summary>Feature ${i + 1} | Type: ${f.geometry.type}</summary>
        <button class="copy-btn" data-json='${encodeURIComponent(
          jsonText
        )}'>📋 Copy JSON</button>
        <pre class="json-container">${highlighted}</pre>
      </details>
    </div>`;
    })
    .join("");

  currentPopup = new maplibregl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(`<div class="popup-scroll">${html}</div>`)
    .setMaxWidth(1000)
    .addTo(map);
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("copy-btn")) {
    const encoded = e.target.getAttribute("data-json");
    const json = decodeURIComponent(encoded);
    navigator.clipboard.writeText(json).then(() => {
      e.target.textContent = "Copied!";
      setTimeout(() => (e.target.textContent = "Copy JSON"), 1500);
    });
  }
  if (e.target.classList.contains("json-value")) {
    const path = e.target.getAttribute("data-path");
    const rawVal = e.target.getAttribute("data-value");

    try {
      const val = JSON.parse(rawVal);
      const obj = {};
      path.split(".").reduce((acc, key, idx, arr) => {
        if (idx === arr.length - 1) {
          acc[key] = val;
        } else {
          acc[key] = {};
        }
        return acc[key];
      }, obj);

      const text = JSON.stringify(obj, null, 2);
      navigator.clipboard.writeText(text).then(() => {
        showErrorBox(`📋 Copied: ${path}`);
      });
    } catch {
      showErrorBox("❌ Failed to copy value.");
    }
  }
});

function syntaxHighlight(json, path = "") {
  if (typeof json !== "object" || json === null) {
    return highlightValue(json, path);
  }

  if (Array.isArray(json)) {
    return (
      "[\n" +
      json
        .map((item, i) => "  " + syntaxHighlight(item, `${path}.${i}`))
        .join(",\n") +
      "\n]"
    );
  }

  return (
    "{\n" +
    Object.entries(json)
      .map(([key, value]) => {
        const subPath = path ? `${path}.${key}` : key;
        return `  <span class="json-key">"${key}"</span>: ${syntaxHighlight(
          value,
          subPath
        )}`;
      })
      .join(",\n") +
    "\n}"
  );
}

function highlightValue(value, path) {
  const type = typeof value;
  const display = JSON.stringify(value);
  const cls =
    type === "string"
      ? "string"
      : type === "number"
      ? "number"
      : type === "boolean"
      ? "boolean"
      : value === null
      ? "null"
      : "";

  return `<span class="json-value json-${cls}" data-path="${path}" data-value='${display}'>${display}</span>`;
}

function cleanProperties(obj) {
  const cleaned = {};

  for (const key in obj) {
    const value = obj[key];

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);

        if (typeof parsed === "object" && parsed !== null) {
          cleaned[key] = cleanProperties(parsed);
        } else {
          cleaned[key] = value;
        }
      } catch {
        cleaned[key] = value;
      }
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = cleanProperties(value);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

function refreshMapCenter() {
  const center = map.getCenter();
  const zoom = map.getZoom().toFixed(2);
  const lat = center.lat.toFixed(6);
  const lng = center.lng.toFixed(6);

  document.getElementById(
    "mapStatusOverlay"
  ).textContent = `Lat: ${lat}, Lng: ${lng}, Zoom: ${zoom}`;
}

map.on("move", () => {
  refreshMapCenter();
});

map.on("load", () => {
  refreshMapCenter();
});

function queryMatchesFeature(feature, query) {
  const matchObject = (data, query) => {
    if ("$or" in query) {
      return query["$or"].some((sub) => matchObject(data, sub));
    }
    if ("$and" in query) {
      return query["$and"].every((sub) => matchObject(data, sub));
    }
    return Object.entries(query).every(([key, value]) => {
      const dataValue = getValueByPath(data, key);
      if (typeof value === "object" && value !== null && "$regex" in value) {
        try {
          return new RegExp(value.$regex).test(dataValue);
        } catch {
          return false;
        }
      }
      return dataValue === value || dataValue?.toString() === value?.toString();
    });
  };

  const getValueByPath = (obj, path) => {
    return path
      .split(".")
      .reduce(
        (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
        obj
      );
  };

  return matchObject(feature.properties, query);
}

function showErrorBox(message) {
  const info = document.createElement("div");
  info.textContent = message;
  info.style.position = "fixed";
  info.style.top = "20px";
  info.style.left = "50%";
  info.style.transform = "translateX(-50%)";
  info.style.background = "#ff4444";
  info.style.color = "white";
  info.style.padding = "10px 20px";
  info.style.borderRadius = "6px";
  info.style.zIndex = 9999;
  info.style.boxShadow = "0 0 5px #000";
  document.body.appendChild(info);
  setTimeout(() => info.remove(), 2500);
}

// === 新增互動控制 ===
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("queryModal");
  document
    .getElementById("openQuery")
    .addEventListener("click", () => modal.classList.remove("hidden"));
  document
    .getElementById("closeQuery")
    .addEventListener("click", () => modal.classList.add("hidden"));

  document.getElementById("runQuery").addEventListener("click", () => {
    modal.classList.add("hidden");
    const raw = editor.getValue().trim();
    // console.log(raw);
    if (!raw) return;
    let query;
    try {
      query = JSON.parse(raw);
    } catch (err) {
      showErrorBox("Invalid NoSQL JSON.");
      return;
    }
    const matched = currentGeoJSONData.features.filter((f) =>
      queryMatchesFeature(f, query)
    );
    console.log(matched);
    clearHighlighAndPopup();
    highlightFeatures(matched);
    if (!document.getElementById("keepViewCheckbox").checked) {
      map.fitBounds(getFeaturesBound(matched), { padding: 80 });
    }
    lastQueryResult = matched;
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    if (!lastQueryResult || lastQueryResult.length === 0) {
      showErrorBox("Export Failuer, no valid result.");
      return;
    }
    const blob = new Blob(
      [
        JSON.stringify(
          { type: "FeatureCollection", features: lastQueryResult },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "query_result.geojson";
    link.click();
    URL.revokeObjectURL(url);
  });
});

function setupSearch(features) {
  document.getElementById("openQuery").addEventListener("click", () => {
    clearHighlighAndPopup();
    const raw = editor.getValue().trim();
    query = JSON.parse(raw);
    console.log(query);
    if (!query) return;

    matched = [];

    features.forEach((feature) => {
      if (queryMatchesFeature(feature, query)) {
        matched.push(feature);
      }
    });

    console.log(matched);

    if (matched.length > 0) {
      highlightFeatures(matched);
      if (!document.getElementById("keepViewCheckbox").checked) {
        map.fitBounds(getFeaturesBound(matched), { padding: 80 });
      }
    }
  });
}

import CodeMirror from "codemirror";
import "codemirror/mode/javascript/javascript.js";
import "codemirror/lib/codemirror.css";

let editor = null;
document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("queryInput");
  if (textarea) {
    editor = CodeMirror.fromTextArea(textarea, {
      mode: { name: "javascript", json: true },
      lineNumbers: false,
      tabSize: 2,
      autoCloseBrackets: true,
      matchBrackets: true,
      theme: "default",
    });
    editor.setValue("{}");
  }
});

// 熱鍵設定
document.addEventListener("keydown", (e) => {
  // 搜尋框 JSON 語法排版
  if (e.key === "b" && e.ctrlKey && editor) {
    try {
      const raw = editor.getValue();
      const parsed = JSON.parse(raw);
      editor.setValue(JSON.stringify(parsed, null, 2));
    } catch {
      showErrorBox("Unable to beautify, invalid JSON.");
    }
    e.preventDefault();
  }

  const modal = document.getElementById("queryModal");
  const gotoModal = document.getElementById("gotoModal");

  // Ctrl+F 開啟搜尋框
  if (e.key === "f" && e.ctrlKey) {
    e.preventDefault();
    document.getElementById("queryModal").classList.remove("hidden");
    editor?.focus();
  }
  // Ctrl+G 開啟經緯度輸入框
  if (e.key === "g" && e.ctrlKey) {
    e.preventDefault();
    const lat = map.getCenter().lat.toFixed(6);
    const lng = map.getCenter().lng.toFixed(6);
    gotoModal.classList.remove("hidden");
    const input = document.getElementById("gotoInput");
    input.value = `${lat},${lng}`;
    input.focus();
  }

  // ESC 隱藏所有輸入框
  if (e.key === "Escape") {
    modal.classList.add("hidden");
    gotoModal.classList.add("hidden");
  } else if (
    e.key === "Enter" &&
    e.ctrlKey &&
    editor &&
    document.activeElement === editor.getInputField()
  ) {
    try {
      const raw = editor.getValue().trim();
      const query = JSON.parse(raw);
      document.getElementById("runQuery").click();
    } catch {
      showErrorBox("Invalid NoSQL JSON.");
    }
    e.preventDefault();
  } else if (
    e.key === "Enter" &&
    document.activeElement === document.getElementById("gotoInput")
  ) {
    document.getElementById("gotoBtn").click();
    e.preventDefault();
  }

  if (!modal || modal.classList.contains("hidden")) return;
});

// 輸入經緯度移動地圖中心點
document.getElementById("gotoBtn").addEventListener("click", () => {
  const raw = document.getElementById("gotoInput").value.trim();
  const parts = raw.split(/[, ]+/).map(parseFloat);

  if (
    parts.length === 2 &&
    parts.every((n) => !isNaN(n)) &&
    parts[0] >= -90 &&
    parts[0] <= 90 && // 緯度
    parts[1] >= -180 &&
    parts[1] <= 180 // 經度
  ) {
    map.setCenter([parts[1], parts[0]]);
    map.setZoom(map.getZoom()); // 保持目前 zoom
    document.getElementById("gotoModal").classList.add("hidden");
  } else {
    showErrorBox(
      "❌ Invalid coordinates (format: lat,lng, range: -90~90, -180~180)"
    );
  }
});
