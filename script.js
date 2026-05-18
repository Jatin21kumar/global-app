let STATE_INFO = {};
let CONTINENT_INFO = {};

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

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkOTliMzlhMi00YjM3LTQ5YzgtYjQ3Yy0yMzAyNzdkZmJkZjAiLCJpZCI6MjkxMjYwLCJpYXQiOjE3NDM5MjIxMjd9.F6e2OH8LUMPgc8m89UP5jcINYGXIqBfY0XsvCrxmd5g';

window.addEventListener("DOMContentLoaded", () => {
  initGlobe();
  document.getElementById("closeInfoBox").addEventListener("click", () => {
    document.getElementById("infoBox").style.display = "none";
  });

  document.getElementById("zoomIn").addEventListener("click", () => {
    if (!window.cesiumViewer) return;
    const camera = window.cesiumViewer.camera;
    camera.zoomIn(camera.positionCartographic.height * 0.4);
  });

  document.getElementById("zoomOut").addEventListener("click", () => {
    if (!window.cesiumViewer) return;
    const camera = window.cesiumViewer.camera;
    camera.zoomOut(camera.positionCartographic.height * 0.6);
  });
});

async function initGlobe() {
  const viewer = new Cesium.Viewer("cesiumContainer", {
    // imageryProvider: new Cesium.OpenStreetMapImageryProvider({
    //   url: 'https://a.tile.openstreetmap.org/'
    // }),
    baseLayerPicker: true,
    creditContainer: "creditContainer",
    geocoder: true,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    homeButton: true,
    fullscreenButton: false,
    infoBox: true,
    selectionIndicator: true
  });

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

  // --- Gesture zoom support (wheel + pinch) ---
  // Override wheel events so they always zoom the globe even inside an iframe,
  // preventing the parent page from swallowing scroll gestures.
  const canvas = viewer.canvas;

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const camera = viewer.camera;
    const amount = camera.positionCartographic.height * 0.04;
    if (e.deltaY > 0) {
      camera.zoomOut(amount);
    } else {
      camera.zoomIn(amount);
    }
  }, { passive: false });

  // Pinch-to-zoom on touch devices
  let lastPinchDist = null;
  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist = Math.hypot(dx, dy);
    } else {
      lastPinchDist = null;
    }
  }, { passive: true });

  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && lastPinchDist !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const delta = lastPinchDist - newDist;
      lastPinchDist = newDist;
      const camera = viewer.camera;
      const zoomAmount = camera.positionCartographic.height * Math.abs(delta) * 0.002;
      if (delta > 0) {
        camera.zoomOut(zoomAmount);
      } else {
        camera.zoomIn(zoomAmount);
      }
    }
  }, { passive: false });

  canvas.addEventListener("touchend", () => { lastPinchDist = null; }, { passive: true });
  // --- End gesture zoom ---

  viewer.screenSpaceEventHandler.setInputAction(async function onClick(event) {
    const cartesian = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid);
    if (!cartesian) return;

    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const lon = Cesium.Math.toDegrees(cartographic.longitude);

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, 600000),
      duration: 1.5
    });

    const infoContent = document.getElementById("infoContent");
    const infoBox = document.getElementById("infoBox");
    if (!infoContent || !infoBox) return;

    infoContent.innerHTML = `🔍 Fetching state info...`;
    infoBox.style.display = "block";

    const osmInfo = await getLocationFromOSM(lat, lon);
    const stateName = osmInfo?.state || "";
    const matchedStateKey = Object.keys(STATE_INFO).find(key =>
      key.toLowerCase().includes(stateName.toLowerCase())
    );
    
    if (matchedStateKey) {
      stateData = STATE_INFO[matchedStateKey];
    } else {
      const countryName = osmInfo?.country || "";
    
      let foundCountry = null;
    
      for (const continent in CONTINENT_INFO) {
        if (CONTINENT_INFO[continent][countryName]) {
          foundCountry = CONTINENT_INFO[continent][countryName];
          break;
        }
      }
    
      if (!foundCountry) {
        infoContent.innerHTML = `⚠️ No data available for <b>${stateName || countryName}</b>`;
        return;
      }
    
      stateData = foundCountry;
    }

    const stateData = STATE_INFO[matchedKey];
    const image = stateData.image || stateData.Image || null;
    const tagline = stateData.tagline || "";

    const sections = Object.entries(stateData)
      .filter(([key]) => key !== "image" && key !== "Image" && key !== "tagline")
      .map(([heading, content]) => {
        let bullets = "";

        if (Array.isArray(content)) {
          bullets = content.map(item => {
            const text = typeof item === "object" ? item.text || "" : item;
            const img = typeof item === "object" && item.image
              ? `<br><img src="${item.image}" alt="Image" style="width: 100%; max-width: 100%; max-height: 220px; object-fit: contain; margin: 8px auto; border-radius: 8px; display: block;">`
              : "";
            return `<li>${text}${img}</li>`;
          }).join("");
        } else if (typeof content === "object") {
          bullets = Object.entries(content).map(([label, value]) => {
            if (typeof value === "object") {
              const text = value.text || "";
              const img = value.image
                ? `<br><img src="${value.image}" alt="Image" style="width: 100%; max-width: 100%; max-height: 220px; object-fit: contain; margin: 8px auto; border-radius: 8px; display: block;">`
                : "";
              return `<li><b>${label}</b>: ${text}${img}</li>`;
            } else {
              return `<li><b>${label}</b>: ${value}</li>`;
            }
          }).join("");
        } else {
          bullets = `<li>${content}</li>`;
        }

        return `
          <details style="margin-bottom: 10px;">
            <summary style="font-weight: bold; font-size: 16px;">${heading}</summary>
            <ul style="padding-left: 20px; margin-top: 5px;">${bullets}</ul>
          </details>
        `;
      }).join("");

    infoContent.innerHTML = `
      <h2 style="margin-top: 0; text-align: center;">${stateName}</h2>
      ${tagline ? `<p style="font-style: italic; margin-top: -10px; margin-bottom: 10px; text-align: center;">${tagline}</p>` : ""}
      ${image ? `<img src="${image}" alt="${stateName}" style="width: 100%; max-width: 100%; max-height: 220px; object-fit: contain; margin: 10px auto; border-radius: 8px; display: block;">` : ""}
      ${sections}
    `;
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK); 
}

// Utility functions (unchanged)
async function getLocationFromOSM(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
    const data = await res.json();
    const address = data.address || {};
    return {
      country: address.country,
      state: address.state,
      city: address.city || address.town || address.village
    };
  } catch {
    return {};
  }
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
