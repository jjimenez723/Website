if (typeof L !== 'undefined' && document.getElementById('map')) {
  // Define bounds for Newark area
  const newarkBounds = L.latLngBounds(
    [40.70, -74.25],  // Southwest corner
    [40.58, -72.12]   // Northeast corner
  );
  // 1) Initialize map
  const map = L.map('map', {
    minZoom: 13,
    maxZoom: 15,
    center: [40.7357, -74.1724],
    zoom: 13,
    maxBounds: L.latLngBounds([40.68, -74.25], [40.80, -74.10]),
    maxBoundsViscosity: 1.0
  });

  // 2) Base layers
  const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const osmGray = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; OSM & CartoDB'
  });

  // 3) Containers
  let produceHeat, fastFoodHeat, produceCluster, fastFoodCluster;
  let produceHeatDataOriginal = [];
  let fastFoodHeatDataOriginal = [];

  // 4) Load local produce.geojson
  fetch('produce.geojson')
    .then(r => r.json())
    .then(data => {
      // heatmap data
      produceHeatDataOriginal = data.features.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0], 0.5]);
      produceHeat = L.heatLayer(produceHeatDataOriginal, { radius: 40, gradient: {0.4: 'blue', 1: 'cyan'} }).addTo(map);

      // clusters
      produceCluster = L.markerClusterGroup({ chunkedLoading: true });
      data.features.forEach(f => {
        const [lon, lat] = f.geometry.coordinates;
        const m = L.circleMarker([lat, lon], { radius: 6, color: 'blue' })
          .bindPopup(`<strong>${f.properties.name}</strong><br>${f.properties.address}
                      <br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}"
                         target="_blank">Directions</a>`);
        produceCluster.addLayer(m);
      });
      // toggle between produceHeat.addTo(map) or produceCluster.addTo(map)
    });

  // 5) Fetch fast food from Overpass
  const overpassQ = `
    [out:json][timeout:25];
    area[name="Newark"]->.a;
    node["amenity"="fast_food"](area.a);
    out center;
  `;
  fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: overpassQ
  })
    .then(r => r.json())
    .then(osm => {
      fastFoodHeatDataOriginal = [];
      fastFoodCluster = L.markerClusterGroup({ chunkedLoading: true });
      osm.elements.forEach(el => {
        const lat = el.lat || el.center.lat;
        const lon = el.lon || el.center.lon;
        fastFoodHeatDataOriginal.push([lat, lon, 0.5]);
        const name = el.tags.name || 'Fast Food';
        const addr = [el.tags['addr:street'], el.tags['addr:housenumber'], el.tags['addr:city']]
          .filter(Boolean).join(' ');
        const m = L.circleMarker([lat, lon], { radius: 6, color: 'red' })
          .bindPopup(`<strong>${name}</strong><br>${addr}
                      <br><a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}"
                         target="_blank">Directions</a>`);
        fastFoodCluster.addLayer(m);
      });
      fastFoodHeat = L.heatLayer(fastFoodHeatDataOriginal, { radius: 25, gradient: {0.4:'red',1:'orange'} }).addTo(map);
    });

  // 6) Distance filter
  const filterBtn = document.getElementById('filterBtn');
  if (filterBtn) {
    filterBtn.onclick = () => {
      const addr = document.getElementById('address').value;
      const km   = parseFloat(document.getElementById('radius').value);
      if (!addr) return alert('Enter an address.');
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`)
        .then(r => r.json())
        .then(res => {
          if (!res.length) return alert('Address not found.');
          const { lat, lon } = res[0];
          const center = L.latLng(lat, lon);
          map.setView(center, 14);
          L.circle(center, { radius: km*1000, color: '#333', dashArray: '4' }).addTo(map);
          [produceCluster, fastFoodCluster].forEach(cl => {
            cl.clearLayers();
            cl.eachLayer(m => {
              if (center.distanceTo(m.getLatLng()) <= km*1000) {
                cl.addLayer(m);
              }
            });
          });
        });
    };
  }

  // 7) Accessibility toggle
  const accessToggle = document.getElementById('accessToggle');
  if (accessToggle) {
    accessToggle.onchange = e => {
      if (e.target.checked) {
        map.removeLayer(osmStandard);
        osmGray.addTo(map);
        produceHeat.setOptions({ gradient: {0.4:'#00429d',1:'#73a2c6'} });
        fastFoodHeat.setOptions({ gradient: {0.4:'#b10026',1:'#f4a582'} });
      } else {
        map.removeLayer(osmGray);
        osmStandard.addTo(map);
        produceHeat.setOptions({ gradient: {0.4:'blue',1:'cyan'} });
        fastFoodHeat.setOptions({ gradient: {0.4:'red',1:'orange'} });
      }
    };
  }

  // After your map and layers are initialized...

  // 1. Get the slider element
  const intensitySlider = document.getElementById('intensitySlider');
  const sizeSlider = document.getElementById('sizeSlider');

  // Helper to set heatmap canvas opacity
  function setHeatmapCanvasOpacity(opacity) {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) return;
    // Find all canvas elements inside the leaflet-overlay-pane (where Leaflet.heat draws)
    const canvases = mapDiv.querySelectorAll('div.leaflet-overlay-pane > canvas');
    canvases.forEach(canvas => {
      canvas.style.opacity = opacity;
    });
  }

  // MutationObserver to re-apply opacity when heatmap canvas is added/replaced
  function observeHeatmapCanvas(intensity) {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) return;
    const overlayPane = mapDiv.querySelector('div.leaflet-overlay-pane');
    if (!overlayPane) return;
    const observer = new MutationObserver(() => {
      setHeatmapCanvasOpacity(intensity);
    });
    observer.observe(overlayPane, { childList: true, subtree: false });
    // Store observer for later disconnect if needed
    window._heatmapObserver = observer;
  }
  function disconnectHeatmapObserver() {
    if (window._heatmapObserver) {
      window._heatmapObserver.disconnect();
      window._heatmapObserver = null;
    }
  }

  // Helper to update heatmap options if visible
  function updateHeatmapOptions() {
    if (!showHeatmap) return;
    const intensity = intensitySlider ? parseFloat(intensitySlider.value) : 1;
    const size = sizeSlider ? parseInt(sizeSlider.value, 10) : 6;
    // Update produce heatmap
    if (produceHeat && produceHeatDataOriginal.length > 0) {
      produceHeat.setLatLngs(produceHeatDataOriginal);
      produceHeat.setOptions({ radius: size });
    }
    // Update fast food heatmap
    if (fastFoodHeat && fastFoodHeatDataOriginal.length > 0) {
      fastFoodHeat.setLatLngs(fastFoodHeatDataOriginal);
      fastFoodHeat.setOptions({ radius: size });
    }
    // Set canvas opacity for both heatmaps
    setTimeout(() => {
      setHeatmapCanvasOpacity(intensity);
      disconnectHeatmapObserver();
      observeHeatmapCanvas(intensity);
    }, 0);
  }

  // Also re-apply opacity after map events that could redraw the heatmap
  if (typeof map !== 'undefined') {
    map.on('layeradd layerremove zoomend moveend', () => {
      if (showHeatmap && intensitySlider) {
        setTimeout(() => setHeatmapCanvasOpacity(parseFloat(intensitySlider.value)), 0);
      }
    });
  }

  // 2. Add an event listener for input changes
  if (intensitySlider) {
    intensitySlider.addEventListener('input', function() {
      updateHeatmapOptions();
    });
  }

  // 3. Add an event listener for the size slider
  if (sizeSlider) {
    sizeSlider.addEventListener('input', function() {
      updateHeatmapOptions();
    });
  }

  // 3. Add an event listener for the size slider
  // 1. Add Leaflet legend control
  const legendControl = L.control({ position: 'bottomleft' });
  legendControl.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = `
      <div><span class="legend-color" style="background:#2563eb"></span> Fresh Food (marker/heat)</div>
      <div><span class="legend-color" style="background:#e11d48"></span> Fast Food (marker/heat)</div>
      <div><span class="legend-line" style="border-color:#008000"></span> Newark boundary</div>
      <div><span class="legend-circle"></span> Filter radius</div>
      <div><span class="legend-cluster"></span> Cluster: Multiple locations</div>
    `;
    return div;
  };
  legendControl.addTo(map);

  // Remove html2canvas export button and logic
  const exportImgLegendBtn = document.getElementById('exportImgLegendBtn');
  if (exportImgLegendBtn) exportImgLegendBtn.remove();

  // 4. Update size slider to control heatmap radius
  // This block is now redundant as sizeSlider is handled by updateHeatmapOptions
  // if (sizeSlider) {
  //   sizeSlider.addEventListener('input', function() {
  //     const value = parseInt(this.value, 10);
  //     // Update heatmap radius
  //     if (produceHeat) produceHeat.setOptions({ radius: value });
  //     if (fastFoodHeat) fastFoodHeat.setOptions({ radius: value });
  //     // Helper to update cluster
  //     function updateCluster(cluster, color) {
  //       if (!cluster) return;
  //       const newMarkers = [];
  //       cluster.eachLayer(marker => {
  //         if (marker instanceof L.CircleMarker) {
  //           const latlng = marker.getLatLng();
  //           const popup = marker.getPopup();
  //           const newMarker = L.circleMarker(latlng, {
  //             radius: value,
  //             color: color,
  //             fillOpacity: marker.options.fillOpacity,
  //             opacity: marker.options.opacity
  //           });
  //           if (popup) newMarker.bindPopup(popup.getContent());
  //           newMarkers.push(newMarker);
  //         }
  //       });
  //       cluster.clearLayers();
  //       newMarkers.forEach(m => cluster.addLayer(m));
  //     }
  //     updateCluster(produceCluster, 'blue');
  //     updateCluster(fastFoodCluster, 'red');
  //   });
  // }

  // 8) Display Newark border from municipal boundaries GeoJSON

  // 9) Layer toggles for checkboxes
  const produceToggle = document.getElementById('produceToggle');
  const fastfoodToggle = document.getElementById('fastfoodToggle');

  function updateProduceLayer() {
    if (!produceHeat || !produceCluster) return;
    if (produceToggle && produceToggle.checked) {
      produceHeat.addTo(map);
      produceCluster.addTo(map);
    } else {
      map.removeLayer(produceHeat);
      map.removeLayer(produceCluster);
    }
  }
  function updateFastFoodLayer() {
    if (!fastFoodHeat || !fastFoodCluster) return;
    if (fastfoodToggle && fastfoodToggle.checked) {
      fastFoodHeat.addTo(map);
      fastFoodCluster.addTo(map);
    } else {
      map.removeLayer(fastFoodHeat);
      map.removeLayer(fastFoodCluster);
    }
  }
  if (produceToggle) produceToggle.addEventListener('change', updateProduceLayer);
  if (fastfoodToggle) fastfoodToggle.addEventListener('change', updateFastFoodLayer);

  // Ensure layers are updated after data loads
  function tryInitLayerToggles() {
    updateProduceLayer();
    updateFastFoodLayer();
  }
  // After produce loads
  fetch('produce.geojson')
    .then(r => r.json())
    .then(data => {
      // ... existing code ...
      tryInitLayerToggles();
    });
  // After fast food loads
  fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: overpassQ
  })
    .then(r => r.json())
    .then(osm => {
      // ... existing code ...
      tryInitLayerToggles();
    });

  // Center/Radius Filter Logic
  const addressInput = document.getElementById('addressInput');
  const latInput = document.getElementById('latInput');
  const lngInput = document.getElementById('lngInput');
  const radiusInput = document.getElementById('radiusInput');
  const centerFilterBtn = document.getElementById('centerFilterBtn');
  let radiusCircle = null;
  let newarkPolygon = null;

  // Helper: Check if a point is inside Newark polygon
  function isInNewark(lat, lng) {
    if (!newarkPolygon) return true; // fallback: allow all if not loaded
    return leafletPip.pointInLayer([lng, lat], newarkPolygon).length > 0;
  }

  // Helper: Filter and update layers
  function filterLocations(center, radiusKm) {
    // Remove previous circle
    if (radiusCircle) map.removeLayer(radiusCircle);
    radiusCircle = L.circle(center, { radius: radiusKm * 1000, color: '#333', dashArray: '4' }).addTo(map);

    // Filter clusters
    if (produceCluster) {
      produceCluster.clearLayers();
      produceHeat.setLatLngs([]);
      fetch('produce.geojson')
        .then(r => r.json())
        .then(data => {
          const filtered = data.features.filter(f => {
            const [lon, lat] = f.geometry.coordinates;
            return center.distanceTo([lat, lon]) <= radiusKm * 1000 && isInNewark(lat, lon);
          });
          filtered.forEach(f => {
            const [lon, lat] = f.geometry.coordinates;
            const m = L.circleMarker([lat, lon], { radius: 6, color: 'blue' })
              .bindPopup(`<strong>${f.properties.name}</strong><br>${f.properties.address}`);
            produceCluster.addLayer(m);
          });
          // Update heatmap
          const pHeat = filtered.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0], 0.5]);
          produceHeat.setLatLngs(pHeat);
        });
    }
    if (fastFoodCluster) {
      fastFoodCluster.clearLayers();
      fastFoodHeat.setLatLngs([]);
      // Re-fetch fast food data
      fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: overpassQ
      })
        .then(r => r.json())
        .then(osm => {
          const filtered = osm.elements.filter(el => {
            const lat = el.lat || el.center.lat;
            const lon = el.lon || el.center.lon;
            return center.distanceTo([lat, lon]) <= radiusKm * 1000 && isInNewark(lat, lon);
          });
          filtered.forEach(el => {
            const lat = el.lat || el.center.lat;
            const lon = el.lon || el.center.lon;
            const name = el.tags.name || 'Fast Food';
            const addr = [el.tags['addr:street'], el.tags['addr:housenumber'], el.tags['addr:city']].filter(Boolean).join(' ');
            const m = L.circleMarker([lat, lon], { radius: 6, color: 'red' })
              .bindPopup(`<strong>${name}</strong><br>${addr}`);
            fastFoodCluster.addLayer(m);
          });
          // Update heatmap
          const ffHeatData = filtered.map(el => [el.lat || el.center.lat, el.lon || el.center.lon, 0.5]);
          fastFoodHeat.setLatLngs(ffHeatData);
        });
    }
  }

  // Load Newark polygon for boundary filter
  fetch('NJ_Municipal_Boundaries_3424_8056533496047524149.geojson')
    .then(r => r.json())
    .then(geojson => {
      const newarkFeature = geojson.features.find(f =>
        f.properties && f.properties.NAME && f.properties.NAME.toLowerCase() === 'newark'
      );
      if (newarkFeature) {
        newarkPolygon = L.geoJSON(newarkFeature, { style: { opacity: 0 } }).addTo(map);
      }
    });

  // Center/Filter button logic
  if (centerFilterBtn) {
    centerFilterBtn.onclick = () => {
      let center = null;
      if (latInput.value && lngInput.value) {
        center = L.latLng(parseFloat(latInput.value), parseFloat(lngInput.value));
        map.setView(center, 14);
      } else if (addressInput.value) {
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput.value)}`)
          .then(r => r.json())
          .then(res => {
            if (!res.length) return alert('Address not found.');
            center = L.latLng(res[0].lat, res[0].lon);
            map.setView(center, 14);
            filterLocations(center, parseFloat(radiusInput.value));
          });
        return;
      } else {
        alert('Enter an address or latitude/longitude.');
        return;
      }
      filterLocations(center, parseFloat(radiusInput.value));
    };
  }

  // leaflet-pip for point-in-polygon
  // Add leaflet-pip library via CDN in map.html:
  // <script src="https://unpkg.com/leaflet-pip/leaflet-pip.min.js"></script>

  // Layer/Border Toggle Logic
  const layerModeBtn = document.getElementById('layerModeBtn');
  const borderToggleBtn = document.getElementById('borderToggleBtn');
  let showHeatmap = true;
  let showBorder = true;
  let newarkBorderLayer = null;

  // Helper: Show/hide heatmap or clusters
  function updateLayerMode() {
    if (showHeatmap) {
      if (produceHeat) produceHeat.addTo(map); else {}
      if (fastFoodHeat) fastFoodHeat.addTo(map); else {}
      if (produceCluster) map.removeLayer(produceCluster);
      if (fastFoodCluster) map.removeLayer(fastFoodCluster);
      if (layerModeBtn) layerModeBtn.textContent = 'Switch to Cluster View';
      updateHeatmapOptions(); // <-- Ensure heatmap reflects current slider values
    } else {
      if (produceCluster) produceCluster.addTo(map);
      if (fastFoodCluster) fastFoodCluster.addTo(map);
      if (produceHeat) map.removeLayer(produceHeat);
      if (fastFoodHeat) map.removeLayer(fastFoodHeat);
      if (layerModeBtn) layerModeBtn.textContent = 'Switch to Heatmap View';
    }
  }

  // Helper: Show/hide Newark border
  function updateBorder() {
    if (showBorder) {
      if (newarkBorderLayer) newarkBorderLayer.addTo(map);
      if (borderToggleBtn) borderToggleBtn.textContent = 'Hide Newark Border';
    } else {
      if (newarkBorderLayer) map.removeLayer(newarkBorderLayer);
      if (borderToggleBtn) borderToggleBtn.textContent = 'Show Newark Border';
    }
  }

  // Load Newark border for toggling
  fetch('NJ_Municipal_Boundaries_3424_8056533496047524149.geojson')
    .then(r => r.json())
    .then(geojson => {
      const newarkFeature = geojson.features.find(f =>
        f.properties && f.properties.NAME && f.properties.NAME.toLowerCase() === 'newark'
      );
      if (newarkFeature) {
        newarkBorderLayer = L.geoJSON(newarkFeature, {
          style: {
            color: '#008000',
            weight: 3,
            fillOpacity: 0.05
          }
        });
        if (showBorder) newarkBorderLayer.addTo(map);
      }
    });

  if (layerModeBtn) {
    layerModeBtn.onclick = () => {
      showHeatmap = !showHeatmap;
      updateLayerMode();
    };
  }
  if (borderToggleBtn) {
    borderToggleBtn.onclick = () => {
      showBorder = !showBorder;
      updateBorder();
    };
  }
  // Initial state
  updateLayerMode();
  updateBorder();

  // Export/Share/Print Logic
  const exportImgBtn = document.getElementById('exportImgBtn');
  const shareLinkBtn = document.getElementById('shareLinkBtn');
  const printBtn = document.getElementById('printBtn');

  if (exportImgBtn) {
    exportImgBtn.onclick = () => {
      // Save current state
      const prevShowHeatmap = showHeatmap;
      const prevShowBorder = showBorder;
      // Switch to heatmap and show border
      showHeatmap = true;
      showBorder = true;
      updateLayerMode();
      updateBorder();
      // Wait a tick for map to update
      setTimeout(() => {
        window.leafletImage(map, function(err, canvas) {
          // Restore previous state
          showHeatmap = prevShowHeatmap;
          showBorder = prevShowBorder;
          updateLayerMode();
          updateBorder();
          if (err) {
            alert('Error exporting map image.');
            return;
          }
          const link = document.createElement('a');
          link.download = 'map.png';
          link.href = canvas.toDataURL();
          link.click();
        });
      }, 400); // 400ms to allow map to redraw
    };
  }
  if (shareLinkBtn) {
    shareLinkBtn.onclick = () => {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({ title: document.title, url });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          alert('Map link copied to clipboard!');
        }, () => {
          prompt('Copy this link:', url);
        });
      } else {
        prompt('Copy this link:', url);
      }
    };
  }
  // Improve print centering
  if (printBtn) {
    printBtn.onclick = () => {
      const prevShowHeatmap = showHeatmap;
      const prevShowBorder = showBorder;
      const prevCenter = map.getCenter();
      const prevZoom = map.getZoom();
      showHeatmap = true;
      showBorder = true;
      updateLayerMode();
      updateBorder();
      // Use far right center and zoom for print
      const printCenter = [40.7357, -734.13]; // Much further east
      const printZoom = 13;
      setTimeout(() => {
        map.setView(printCenter, printZoom, { animate: false });
        map.invalidateSize();
        document.getElementById('map').scrollIntoView({ behavior: 'instant', block: 'start' });
        setTimeout(() => {
          window.print();
          setTimeout(() => {
            showHeatmap = prevShowHeatmap;
            showBorder = prevShowBorder;
            map.setView(prevCenter, prevZoom, { animate: false });
           updateLayerMode();
            updateBorder();
          }, 1000);
        }, 400);
      }, 200);
    };
  }
}
