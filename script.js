let STATE_INFO = {};
let CONTINENT_INFO = {};
let COUNTRY_IMAGE_MANIFEST = {};

// Use camera distance limits that still allow useful close zoom on laptops/mobile
// Lowered MIN_ZOOM so users can zoom in closer (meters)
const MIN_ZOOM = 10;
const MAX_ZOOM = 40000000;

fetch('data/indian_states_data.json')
  .then(res => res.json())
  .then(data => {
    STATE_INFO = data;
  });

fetch('data/continents.json')
  .then(res => res.json())
  .then(data => {
    CONTINENT_INFO = data;
  });

fetch('data/country_image_manifest.json')
  .then(res => res.json())
  .then(data => {
    COUNTRY_IMAGE_MANIFEST = data || {};
  })
  .catch(() => {
    COUNTRY_IMAGE_MANIFEST = {};
  });

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkOTliMzlhMi00YjM3LTQ5YzgtYjQ3Yy0yMzAyNzdkZmJkZjAiLCJpZCI6MjkxMjYwLCJpYXQiOjE3NDM5MjIxMjd9.F6e2OH8LUMPgc8m89UP5jcINYGXIqBfY0XsvCrxmd5g';

function clampedZoom(camera, direction, amount) {
  const stepCount = 6;
  const stepAmount = amount / stepCount;

  function runStep(remaining) {
    const currentHeight = camera.positionCartographic.height;

    if (direction === "out") {
      if (currentHeight >= MAX_ZOOM || remaining <= 0) return;
      camera.zoomOut(Math.min(stepAmount, MAX_ZOOM - currentHeight));
    } else {
      if (currentHeight <= MIN_ZOOM || remaining <= 0) return;
      camera.zoomIn(Math.min(stepAmount, currentHeight - MIN_ZOOM));
    }

    if (remaining > 1) {
      requestAnimationFrame(() => runStep(remaining - 1));
    }
  }

  runStep(stepCount);
}

function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

function getCountryImage(countryName) {
  const normalized = normalizeName(countryName).toLowerCase();
  return normalized ? `images/countries/${normalized}.jpg` : "";
}

function getContinentImage(continentName) {
  const normalized = normalizeName(continentName).toLowerCase();
  return normalized ? `images/continents/${normalized}.jpg` : "";
}

function getUniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildImageCandidates({ explicitImage, countryName, continentName, includeFallbacks = true }) {
  const candidates = [explicitImage];

  if (includeFallbacks) {
    candidates.push(
      getCountryImage(countryName),
      getContinentImage(continentName),
      "images/Sparki.png"
    );
  }

  return getUniqueValues(candidates);
}

function getImageCaptionFromPath(imagePath) {
  const filename = String(imagePath || "").split("/").pop() || "Image";
  return filename.replace(/\.[^.]+$/, "").replace(/[_.-]+/g, " ");
}

function renderImageCard(imagePath, caption) {
  const safeCaption = String(caption || getImageCaptionFromPath(imagePath) || "Image").replace(/"/g, "&quot;");
  const safeSrc = String(imagePath || "").replace(/"/g, "&quot;");

  if (!safeSrc) return "";

  return `
    <figure class="info-image-card">
      <img src="${safeSrc}" alt="${safeCaption}">
      <figcaption>${safeCaption}</figcaption>
    </figure>
  `;
}

function applyImageBehaviors(root) {
  if (!root) return;

  root.querySelectorAll(".info-image-card img").forEach((img) => {
    if (img.dataset.behaviorReady === "true") return;
    img.dataset.behaviorReady = "true";

    img.addEventListener("error", () => {
      const figure = img.closest("figure");
      if (figure) figure.remove();
    });
  });
}

async function getCountryFolder(continentName, countryName) {
  const continentKey = normalizeName(continentName);
  const countryKey = normalizeName(countryName);
  const matchedContinentKey = Object.keys(COUNTRY_IMAGE_MANIFEST || {}).find((key) => normalizeName(key) === continentKey);
  const continentData = matchedContinentKey ? COUNTRY_IMAGE_MANIFEST[matchedContinentKey] : null;

  if (!continentData) return null;

  const matchedCountryEntry = Object.entries(continentData?.countries || {}).find(([key]) => normalizeName(key) === countryKey);
  const countryImages = matchedCountryEntry?.[1];

  if (!Array.isArray(countryImages) || countryImages.length === 0) {
    return null;
  }

  return {
    continentKey: matchedContinentKey,
    countryKey: matchedCountryEntry[0],
    images: countryImages,
    continentImages: Array.isArray(continentData.continentImages) ? continentData.continentImages : []
  };
}

async function loadCountryImages(continentName, countryName) {
  const folder = await getCountryFolder(continentName, countryName);
  return folder?.images || [];
}

function findCountryMatch(countryName) {
  const normalizedCountry = normalizeName(countryName);

  if (!normalizedCountry) return null;

  for (const [continentName, continentData] of Object.entries(CONTINENT_INFO)) {
    const matchedCountryKey = Object.keys(continentData).find((key) => {
      const normalizedKey = normalizeName(key);
      return normalizedKey === normalizedCountry || normalizedKey.includes(normalizedCountry) || normalizedCountry.includes(normalizedKey);
    });

    if (matchedCountryKey) {
      return {
        continentName,
        countryName: matchedCountryKey,
        data: continentData[matchedCountryKey]
      };
    }
  }

  return null;
}

function findStateMatch(stateName) {
  const normalizedState = normalizeName(stateName);

  if (!normalizedState) return null;

  return Object.keys(STATE_INFO).find((key) => {
    const normalizedKey = normalizeName(key);
    return normalizedKey === normalizedState || normalizedKey.includes(normalizedState) || normalizedState.includes(normalizedKey);
  }) || null;
}

function renderContentValue(content, renderImageAlt) {
  if (Array.isArray(content)) {
    return content.map((item) => {
      const text = typeof item === "object" ? item.text || "" : item;
      const imageMarkup = typeof item === "object" && item.image
        ? renderImageCard(item.image, renderImageAlt || text || getImageCaptionFromPath(item.image))
        : "";

      return `<li>${text}${imageMarkup}</li>`;
    }).join("");
  }

  if (typeof content === "object" && content !== null) {
    return Object.entries(content).map(([label, value]) => {
      if (typeof value === "object" && value !== null) {
        const text = value.text || "";
        const imageMarkup = value.image
          ? renderImageCard(value.image, value.text || label || getImageCaptionFromPath(value.image))
          : "";

        return `<li><b>${label}</b>: ${text}${imageMarkup}</li>`;
      }

      return `<li><b>${label}</b>: ${value}</li>`;
    }).join("");
  }

  return `<li>${content}</li>`;
}

function renderLocationInfo(infoContent, location) {
  const title = location.displayName || location.fallbackName || "Unknown location";
  const tagline = location.data.tagline || "";
  const imageMarkup = location.heroImage ? renderImageCard(location.heroImage, title) : "";

  const sections = Object.entries(location.data)
    .filter(([key]) => key !== "image" && key !== "Image" && key !== "tagline")
    .map(([heading, content]) => `
      <details style="margin-bottom: 10px;">
        <summary style="font-weight: bold; font-size: 16px;">${heading}</summary>
        <ul style="padding-left: 20px; margin-top: 5px;">${renderContentValue(content, title)}</ul>
      </details>
    `)
    .join("");

  const galleryImages = Array.isArray(location.galleryImages) ? location.galleryImages : [];
  const gallerySection = galleryImages.length
    ? `
      <details style="margin-bottom: 10px;" open>
        <summary style="font-weight: bold; font-size: 16px;">Image Gallery</summary>
        <div class="info-image-grid">
          ${galleryImages.map((imagePath) => renderImageCard(imagePath, getImageCaptionFromPath(imagePath))).join("")}
        </div>
      </details>
    `
    : "";

  infoContent.innerHTML = `
    <h2 style="margin-top: 0; text-align: center;">${title}</h2>
    ${tagline ? `<p style="font-style: italic; margin-top: -10px; margin-bottom: 10px; text-align: center;">${tagline}</p>` : ""}
    ${imageMarkup}
    ${sections}
    ${gallerySection}
  `;

  applyImageBehaviors(infoContent);
}

async function resolveLocationInfo(osmInfo) {
  const stateName = osmInfo?.state || "";
  const matchedStateKey = findStateMatch(stateName);

  if (matchedStateKey) {
    const stateData = STATE_INFO[matchedStateKey];

    return {
      kind: "state",
      displayName: matchedStateKey,
      fallbackName: stateName,
      data: stateData,
      heroImage: stateData.image || stateData.Image || "",
      galleryImages: []
    };
  }

  const countryName = getEnglishCountryName(osmInfo?.country, osmInfo?.countryCode);
  const countryMatch = findCountryMatch(countryName);

  if (countryMatch) {
    const galleryImages = await loadCountryImages(countryMatch.continentName, countryMatch.countryName);

    return {
      kind: "country",
      displayName: countryMatch.countryName,
      fallbackName: countryName,
      continentName: countryMatch.continentName,
      data: countryMatch.data,
      heroImage: countryMatch.data.image || countryMatch.data.Image || galleryImages[0] || "",
      galleryImages
    };
  }

  return null;
}

window.addEventListener("DOMContentLoaded", () => {
  initGlobe();

  document.getElementById("closeInfoBox").addEventListener("click", () => {
    document.getElementById("infoBox").style.display = "none";
  });

  document.getElementById("zoomIn").addEventListener("click", () => {
    if (!window.cesiumViewer) return;
    const camera = window.cesiumViewer.camera;
    clampedZoom(camera, "in", 3000000);
  });

  document.getElementById("zoomOut").addEventListener("click", () => {
    if (!window.cesiumViewer) return;
    const camera = window.cesiumViewer.camera;
    clampedZoom(camera, "out", 3000000);
  });
});

async function initGlobe() {
  const viewer = new Cesium.Viewer("cesiumContainer", {
    imageryProvider: false,
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    geocoder: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    selectionIndicator: false,
    infoBox: false,
    homeButton: true
  });

  const voyager = new Cesium.UrlTemplateImageryProvider({
    url: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    credit: "© OpenStreetMap contributors © CARTO"
  });

  viewer.imageryLayers.addImageryProvider(voyager);

  viewer.cesiumWidget.creditContainer.style.display = "none";

  // Home button always goes to India
  viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function (e) {
    e.cancel = true;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(78.9629, 22.5937, 3000000),
      duration: 2
    });
  });

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(78.9629, 22.5937, 3000000)
  });

  window.cesiumViewer = viewer;

  // Mobile WebView GPU optimisations and render quality
  const dpr = window.devicePixelRatio || 1;
  viewer.resolutionScale = dpr;
  viewer.scene.globe.maximumScreenSpaceError = 2;
  const controller = viewer.scene.screenSpaceCameraController;

  // Faster wheel/touch zoom response
  controller.zoomFactor = 18.0;

  // Keep zoom enabled
  controller.enableZoom = true;

  // Preserve other interactions
  controller.enableTilt = false;
  controller.enableLook = false;
  controller.enableRotate = true;

  // Smooth movement
  controller.inertiaZoom = 0.7;

  // Better mobile interaction
  controller.maximumMovementRatio = 0.1;

  // Allow both pinch and wheel zoom events
  controller.zoomEventTypes = [Cesium.CameraEventType.PINCH, Cesium.CameraEventType.WHEEL];

  viewer.scene.canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
  }, false);

  viewer.scene.canvas.addEventListener("webglcontextrestored", () => {
    viewer.scene.requestRender();
  }, false);

  // Prevent excessive zooming out/in which can cause black globe on low-end devices
  // Camera limits to prevent black globe and prevent camera going behind globe
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = MIN_ZOOM;
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = MAX_ZOOM;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;

  // Disable lighting and fog that can cause dark rendering on some mobile GPUs
  try {
    viewer.scene.globe.enableLighting = false;
    if (viewer.scene.fog) viewer.scene.fog.enabled = false;
    if (viewer.scene.globe && typeof viewer.scene.globe.showGroundAtmosphere !== 'undefined') {
      viewer.scene.globe.showGroundAtmosphere = false;
    }
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
  } catch (e) {
    console.warn('Error disabling globe lighting/fog (non-fatal):', e);
  }

  // Prevent render loop crashes: log and request a single render when Cesium surfaces an error
  try {
    if (viewer.scene && viewer.scene.renderError && typeof viewer.scene.renderError.addEventListener === 'function') {
      viewer.scene.renderError.addEventListener(function (error) {
        console.error('Cesium render error:', error);
        try { viewer.scene.requestRender(); } catch (e) { /* swallow */ }
      });
    }
  } catch (e) {
    console.warn('Failed to attach renderError handler:', e);
  }

  // Smooth wheel zoom support for touchpads / mice.
  const canvas = viewer.canvas;

  // Ensure the canvas fills viewport for mobile centering
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.touchAction = 'none';

  let wheelZoomFrame = null;

  function smoothZoom(direction, amount) {
    if (wheelZoomFrame) {
      cancelAnimationFrame(wheelZoomFrame);
      wheelZoomFrame = null;
    }

    const camera = viewer.camera;
    let remaining = Math.max(amount, 0);

    function animate() {
      const currentHeight = camera.positionCartographic.height;
      if ((direction === "in" && currentHeight <= MIN_ZOOM) || (direction === "out" && currentHeight >= MAX_ZOOM) || remaining <= 0) {
        wheelZoomFrame = null;
        return;
      }

      const chunk = Math.min(remaining, Math.max(currentHeight * 0.03, 20000));
      if (direction === "in") {
        camera.zoomIn(Math.min(chunk, currentHeight - MIN_ZOOM));
      } else {
        camera.zoomOut(Math.min(chunk, MAX_ZOOM - currentHeight));
      }

      remaining -= chunk;
      wheelZoomFrame = requestAnimationFrame(animate);
    }

    animate();
  }

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();

    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * 40
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaY * canvas.clientHeight
        : event.deltaY;

    if (!delta) return;

    const direction = delta > 0 ? "out" : "in";
    const height = viewer.camera.positionCartographic.height;
    const amount = Math.min(Math.abs(delta) * (height * 0.02), height * 0.5);
    smoothZoom(direction, amount);
  }, { passive: false });

  // Recalculate resolution and aspect on resize / orientation change
  function handleResize() {
    try {
      const newDpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
      viewer.resolutionScale = newDpr;
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      if (viewer.scene && viewer.camera && viewer.camera.frustum) {
        viewer.camera.frustum.aspect = canvas.clientWidth / canvas.clientHeight;
      }
      viewer.scene.requestRender();
    } catch (e) {
      console.warn('Resize handling failed:', e);
    }
  }

  window.addEventListener('resize', () => { handleResize(); }, { passive: true });
  window.addEventListener('orientationchange', () => { setTimeout(handleResize, 200); }, { passive: true });

  // Helper: manage a visible click marker (one at a time)
  if (!window._cesiumClickMarker) window._cesiumClickMarker = { id: null };

  viewer.screenSpaceEventHandler.setInputAction(async function onClick(event) {
    const cartesian = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid);
    if (!cartesian) return;

    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const lon = Cesium.Math.toDegrees(cartographic.longitude);

    // Smooth camera focus while keeping user context
    try {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, Math.min(Math.max(viewer.camera.positionCartographic.height, MIN_ZOOM * 0.8), 1200000)),
        duration: 1.2
      });
    } catch (e) {
      console.warn('Camera flyTo failed:', e);
    }

    const infoContent = document.getElementById("infoContent");
    const infoBox = document.getElementById("infoBox");
    if (!infoContent || !infoBox) return;

    infoContent.innerHTML = `🔍 Fetching location info...`;
    infoBox.style.display = "block";

    const osmInfo = await getLocationFromOSM(lat, lon);
    const locationInfo = await resolveLocationInfo(osmInfo);

    if (!locationInfo) {
      const stateName = osmInfo?.state || "";
      const countryName = getEnglishCountryName(osmInfo?.country, osmInfo?.countryCode);
      infoContent.innerHTML = `⚠️ No data available for <b>${stateName || countryName}</b>`;
      return;
    }

    renderLocationInfo(infoContent, locationInfo);

    // Add a temporary click marker (pin + pulse)
    try {
      // remove previous
      if (window._cesiumClickMarker.id) {
        viewer.entities.removeById(window._cesiumClickMarker.id);
        window._cesiumClickMarker.id = null;
      }

      const markerId = `click-marker-${Date.now()}`;
      const position = Cesium.Cartesian3.fromDegrees(lon, lat, 0);

      const marker = viewer.entities.add({
        id: markerId,
        position: position,
        billboard: {
          image: 'images/pin.png', // optional app pin (falls back if missing)
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 0.8,
          pixelOffset: new Cesium.Cartesian2(0, -8)
        },
        label: {
          text: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new Cesium.Cartesian2(0, -36)
        },
        ellipse: {
          semiMajorAxis: 25000,
          semiMinorAxis: 25000,
          material: Cesium.Color.WHITE.withAlpha(0.12),
          height: 0
        }
      });

      window._cesiumClickMarker.id = markerId;

      // pulse animation: expand ellipse once then reduce opacity
      const start = Date.now();
      const durationMs = 1800;
      const initialSemi = 25000;
      const maxSemi = 90000;

      function animatePulse() {
        const t = (Date.now() - start) / durationMs;
        if (t >= 1) {
          viewer.entities.remove(marker);
          window._cesiumClickMarker.id = null;
          return;
        }
        const semi = initialSemi + (maxSemi - initialSemi) * t;
        const alpha = 0.12 * (1 - t);
        if (marker && marker.ellipse) {
          marker.ellipse.semiMajorAxis = semi;
          marker.ellipse.semiMinorAxis = semi;
          marker.ellipse.material = Cesium.Color.WHITE.withAlpha(alpha);
        }
        viewer.scene.requestRender();
        requestAnimationFrame(animatePulse);
      }

      requestAnimationFrame(animatePulse);
    } catch (e) {
      console.warn('Failed to create click marker:', e);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// Utility functions (unchanged)
async function getLocationFromOSM(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=en&lat=${lat}&lon=${lon}`);
    const data = await res.json();
    const address = data.address || {};
    return {
      country: address.country,
      countryCode: address.country_code,
      state: address.state,
      city: address.city || address.town || address.village
    };
  } catch {
    return {};
  }
}

function getEnglishCountryName(countryName, countryCode) {
  if (countryCode) {
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
      return displayNames.of(countryCode.toUpperCase()) || countryName || "";
    } catch {
      return countryName || countryCode.toUpperCase();
    }
  }

  return countryName || "";
}

async function getGeoNamesInfo(lat, lon) {
  try {
    const res = await fetch(`https://secure.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lon}&username=jatin_kumar`);
    const data = await res.json();
    const place = data.geonames?.[0];
    return place ? {
      name: place.name,
      population: place.population,
      timezone: place.timezone?.timeZoneId
    } : {};
  } catch {
    return {};
  }
}

async function getElevation(lat, lon) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
    const data = await res.json();
    return data?.elevation;
  } catch {
    return null;
  }
}

async function getWeather(lat, lon) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const data = await res.json();
    return data.current_weather ? {
      temperature: data.current_weather.temperature,
      windspeed: data.current_weather.windspeed,
      description: `Code ${data.current_weather.weathercode}`
    } : {};
  } catch {
    return {};
  }
}

function getFlagEmoji(code) {
  return code ? code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(127397 + c.charCodeAt())) : "";
}

const COUNTRY_INFO = {
  "India": { population: "1.4 billion", code: "IN", gdp: "$3.7 trillion" },
  "France": { population: "67 million", code: "FR", gdp: "$3.2 trillion" },
  "United States": { population: "331 million", code: "US", gdp: "$25 trillion" }
};
